// Gera screenshots e tiles da loja para um idioma, a partir de uma cópia da extensão com o kit de cenas
import { launch } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
const [,, chromeBin, extDir, profileDir, outDir, langTag] = process.argv;
mkdirSync(outDir, { recursive: true });
const jobs = [
  { name: 'screenshot-1-list', scene: 'list', theme: 'light', w: 1280, h: 800 },
  { name: 'screenshot-2-range', scene: 'range', theme: 'light', w: 1280, h: 800 },
  { name: 'screenshot-3-search-dark', scene: 'search', theme: 'dark', w: 1280, h: 800 },
  { name: 'screenshot-4-day', scene: 'day', theme: 'light', w: 1280, h: 800 },
  { name: 'promo-small-440x280', scene: 'tile-small', theme: 'light', w: 440, h: 280 },
  { name: 'promo-marquee-1400x560', scene: 'tile-marquee', theme: 'light', w: 1400, h: 560 },
];
const b = await launch({ chromeBin, extDir, profileDir, lang: langTag });
const id = b.extIds[0];
for (const j of jobs) {
  // Abre a página já na URL da extensão (navegar de about:blank para chrome-extension:// é bloqueado)
  const t = await (await fetch(`${b.base}/json/new?chrome-extension://${id}/store-shot.html?scene=${j.scene}%26theme=${j.theme}`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let n = 0; const pend = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}) => new Promise(r => { const i = ++n; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Emulation.setDeviceMetricsOverride', { width: j.w, height: j.h, deviceScaleFactor: 2, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: j.theme }] });
  await send('Page.reload', { ignoreCache: true });
  let ready = false;
  for (let i = 0; i < 60 && !ready; i++) {
    await b.sleep(200);
    const r = await send('Runtime.evaluate', { expression: 'document.documentElement.dataset.ready', returnByValue: true });
    ready = r.result?.result?.value === '1';
  }
  await b.sleep(500);
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: j.w, height: j.h, scale: 1 } });
  writeFileSync(`${outDir}/${j.name}@2x.png`, Buffer.from(shot.result.data, 'base64'));
  console.log(j.name, ready ? 'ok' : 'NOT READY');
  ws.close();
}
await b.close();
