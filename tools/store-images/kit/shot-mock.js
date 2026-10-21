// Somente para gerar imagens da loja: histórico fictício + favicons de letra + roteiro da cena
(function () {
  const scene = new URLSearchParams(location.hash.slice(1)).get('scene') || 'list';
  const lang = (chrome.i18n.getMessage('locale') || 'en-US').startsWith('pt') ? 'pt' : 'en';
  const H = 36e5, now = new Date(2026, 9, 21, 16, 40).getTime();
  const day = (d, h, m) => new Date(2026, 9, 21 - d, h, m).getTime();
  const E = (url, en, pt, ...times) => ({ url, title: lang === 'pt' ? pt : en, times });
  const data = [
    E('https://github.com/israelfsilva/chrome-history-plus', 'israelfsilva/chrome-history-plus: History Plus for the side panel', 'israelfsilva/chrome-history-plus: History Plus no painel lateral', day(0,16,32), day(2,10,5)),
    E(lang==='pt'?'https://developer.mozilla.org/pt-BR/docs/Web/CSS/color-scheme':'https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme', 'color-scheme - CSS | MDN', 'color-scheme - CSS | MDN', day(0,15,48)),
    E('https://m3.material.io/foundations/design-tokens/overview', 'Design tokens – Material Design 3', 'Design tokens – Material Design 3', day(0,15,20), day(3,11,2)),
    E(lang==='pt'?'https://pt.wikipedia.org/wiki/Lisboa':'https://en.wikipedia.org/wiki/Lisbon', 'Lisbon - Wikipedia', 'Lisboa – Wikipédia, a enciclopédia livre', day(0,13,4)),
    E('https://www.timeanddate.com/weather/portugal/lisbon', 'Weather for Lisbon, Portugal', 'Clima em Lisboa, Portugal', day(0,12,51), day(1,8,2)),
    E('https://news.ycombinator.com/', 'Hacker News', 'Hacker News', day(0,9,15), day(1,9,40), day(2,9,3), day(4,8,50)),
    E('https://www.smashingmagazine.com/category/design/', 'Design — Smashing Magazine', 'Design — Smashing Magazine', day(1,18,22)),
    E(lang==='pt'?'https://pt.wikipedia.org/wiki/Material_Design':'https://en.wikipedia.org/wiki/Material_Design', 'Material Design - Wikipedia', 'Material Design – Wikipédia, a enciclopédia livre', day(1,17,45)),
    E('https://stackoverflow.com/questions/tagged/google-chrome-extension', "Newest 'google-chrome-extension' Questions - Stack Overflow", "Perguntas mais recentes 'google-chrome-extension' - Stack Overflow", day(1,14,10)),
    E('https://dribbble.com/tags/calendar_design', 'Calendar Design designs, themes, templates', 'Calendar Design: designs, temas e modelos', day(2,20,31)),
    E('https://web.dev/articles/building/a-side-panel', 'Building a side panel component | web.dev', 'Criando um componente de painel lateral | web.dev', day(2,16,12)),
    E('https://www.recipetineats.com/pastel-de-nata/', 'Pastel de Nata (Portuguese Custard Tarts)', 'Pastel de nata (tortinhas portuguesas)', day(3,19,40)),
    E('https://unsplash.com/s/photos/lisbon', 'Lisbon pictures | Download free images', 'Fotos de Lisboa | Baixe imagens gratuitas', day(4,21,5)),
  ];
  const rows = () => data.map(d => ({ url: d.url, title: d.title, lastVisitTime: Math.max(...d.times) }));
  const search = (p, cb) => setTimeout(() => cb(rows().filter(r => data.find(d => d.url === r.url).times.some(t => t >= p.startTime && t <= p.endTime)).slice(0, p.maxResults)), 10);
  const getVisits = ({ url }, cb) => setTimeout(() => cb((data.find(d => d.url === url)?.times || []).map(visitTime => ({ visitTime }))), 5);
  Object.defineProperty(chrome.history, 'search', { value: search });
  Object.defineProperty(chrome.history, 'getVisits', { value: getVisits });
  const RealDate = Date;
  globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return now; } };

  // Favicons de letra (evita depender de rede e de logotipos de terceiros)
  const palette = ['#1a73e8', '#d93025', '#188038', '#e37400', '#9334e6', '#007b83', '#b06000', '#c5221f'];
  const letterIcon = (host) => {
    const name = host.replace(/^www\./, '');
    let hsh = 0; for (const c of name) hsh = (hsh * 31 + c.charCodeAt(0)) >>> 0;
    const bg = palette[hsh % palette.length];
    return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${bg}"/><text x="16" y="23.5" font-family="-apple-system,Helvetica,Arial" font-size="21" font-weight="700" fill="#fff" text-anchor="middle">${name[0].toUpperCase()}</text></svg>`);
  };
  const desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    get() { return desc.get.call(this); },
    set(v) { if (String(v).includes('/_favicon/')) { try { v = letterIcon(new URL(new URL(v).searchParams.get('pageUrl')).hostname); } catch {} } desc.set.call(this, v); }
  });

  // Roteiro de cada cena
  const wait = ms => new Promise(r => setTimeout(r, ms));
  window.addEventListener('load', async () => {
    await wait(300);
    const $ = id => document.getElementById(id);
    if (scene === 'range') {
      $('dateTriggerBtn').click(); $('modeRangeBtn').click();
      const days = [...document.querySelectorAll('.calendar-day:not(:disabled)')];
      const today = document.querySelector('.calendar-day.today');
      days[days.indexOf(today) - 4].click(); await wait(200);
      document.querySelector('.calendar-day.today').click(); await wait(300);
      $('dateTriggerBtn').click();
    } else if (scene === 'search') {
      const input = $('searchInput'); input.value = 'design'; input.dispatchEvent(new Event('input'));
    } else if (scene === 'day') {
      for (let i = 0; i < 3; i++) { $('prevDayBtn').click(); await wait(80); }
    }
    if (scene !== 'search') document.activeElement?.blur();
    await wait(700);
    document.documentElement.dataset.ready = '1';
  });
})();
