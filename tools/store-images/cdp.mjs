// Utilitário: abre o Chrome for Testing com uma extensão e devolve helpers de CDP
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
// ID de extensão descompactada: sha256 do caminho absoluto, 32 primeiros hex mapeados para a-p
export const unpackedId = dir => [...createHash('sha256').update(realpathSync(dir)).digest('hex').slice(0, 32)].map(c => String.fromCharCode(97 + parseInt(c, 16))).join('');
export async function launch({ chromeBin, extDir, profileDir, lang, port = 9340 }) {
  rmSync(profileDir, { recursive: true, force: true });
  mkdirSync(profileDir + '/Default', { recursive: true });
  writeFileSync(profileDir + '/Default/Preferences', JSON.stringify({ intl: { app_locale: lang, accept_languages: lang } }));
  writeFileSync(profileDir + '/Local State', JSON.stringify({ intl: { app_locale: lang } }));
  const proc = spawn(chromeBin, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`,
    `--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`, `--lang=${lang}`, `--accept-lang=${lang}`,
    '--no-first-run', '--hide-scrollbars', '--force-color-profile=srgb', 'about:blank'],
    { stdio: 'ignore', env: { ...process.env, LANG: lang.replace('-', '_') + '.UTF-8' } });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const base = `http://127.0.0.1:${port}`;
  let ts = [];
  for (let i = 0; i < 60; i++) { try { ts = await (await fetch(base + '/json/list')).json(); if (ts.some(t => t.type === 'service_worker' && t.url.includes(unpackedId(extDir)))) break; } catch {} await sleep(250); }
  return { proc, base, sleep, extIds: [unpackedId(extDir)], close: async () => { proc.kill(); await sleep(500); } };
}
export async function openPage(base, url) {
  const t = await (await fetch(`${base}/json/new?${url || 'about:blank'}`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pending = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description; };
  return { send, evaluate, ws, url, close: () => ws.close() };
}
