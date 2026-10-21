// Composição das imagens da loja (somente para gerar screenshots/tiles)
const params = new URLSearchParams(location.search);
const scene = params.get('scene') || 'list';
const lang = (chrome.i18n.getMessage('locale') || 'en-US').startsWith('pt') ? 'pt' : 'en';
if (params.get('theme') === 'dark') document.body.classList.add('dark');

const COPY = {
  en: {
    list: { h: 'Your history, right in the <em>side panel</em>', s: 'Browse the pages you visited grouped by day, reopen them with a click and remove what you don’t need — without leaving the tab you’re on.', chips: ['Grouped by day', 'One-click reopen', 'Undo delete'] },
    range: { h: 'Filter by a <em>day</em> or a <em>date range</em>', s: 'Pick dates on the calendar or step through days with the arrows, and see exactly what you visited — and when.', chips: ['Single day', 'Date range', 'Exact visit times'] },
    search: { h: 'Fast search, in <em>light</em> or <em>dark</em>', s: 'Find pages by title or address. Accents and capitalization don’t matter, and the panel follows your Chrome theme.', chips: ['Accent-insensitive', 'Search + dates', 'Dark mode'] },
    day: { h: 'What did you see <em>two days ago</em>?', s: 'Jump back one day at a time with the arrows next to the date. Every visit shows its exact time.', chips: ['Day-by-day', 'Exact times'] },
    tag: 'Your browsing history in the side panel, with search and date filters.',
  },
  pt: {
    list: { h: 'Seu histórico, direto no <em>painel lateral</em>', s: 'Veja as páginas visitadas agrupadas por dia, reabra com um clique e remova o que não precisa — sem sair da aba em que você está.', chips: ['Agrupado por dia', 'Reabrir com um clique', 'Desfazer exclusão'] },
    range: { h: 'Filtre por <em>um dia</em> ou por <em>um período</em>', s: 'Escolha as datas no calendário ou avance dia a dia com as setas, e veja exatamente o que você visitou — e quando.', chips: ['Dia específico', 'Período', 'Horário exato da visita'] },
    search: { h: 'Busca rápida, no tema <em>claro</em> ou <em>escuro</em>', s: 'Encontre páginas pelo título ou endereço. Acentos e maiúsculas não importam, e o painel acompanha o tema do Chrome.', chips: ['Ignora acentos', 'Busca + datas', 'Modo escuro'] },
    day: { h: 'O que você viu <em>anteontem</em>?', s: 'Volte um dia de cada vez com as setas ao lado da data. Cada visita mostra o horário exato.', chips: ['Dia a dia', 'Horário exato'] },
    tag: 'Seu histórico de navegação no painel lateral, com busca e filtro por data.',
  },
}[lang];

const ICON = 'icons/icon-128.png';
const stage = document.getElementById('stage');
const puzzle = '<svg viewBox="0 0 24 24"><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4c-1.1 0-2 .9-2 2v3.8h1.5c1.5 0 2.7 1.2 2.7 2.7S5 16.2 3.5 16.2H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.5 1.2-2.7 2.7-2.7s2.7 1.2 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z"/></svg>';
const close = '<svg viewBox="0 0 24 24"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';

if (scene === 'tile-small' || scene === 'tile-marquee') {
  const marquee = scene === 'tile-marquee';
  stage.innerHTML = `<div class="tile ${scene}"><div class="brand"><span class="badge"><img src="${ICON}" alt=""></span>History Plus</div><p class="tag">${COPY.tag}</p>
    ${marquee ? '<div class="tile-panel"><iframe src="sidebar.html#scene=list"></iframe></div>' : ''}</div>`;
  if (marquee) {
    const frame = stage.querySelector('iframe');
    const poll = setInterval(() => {
      if (frame.contentDocument?.documentElement?.dataset.ready === '1') { clearInterval(poll); document.documentElement.dataset.ready = '1'; }
    }, 100);
  } else {
    document.documentElement.dataset.ready = '1';
  }
} else {
  const c = COPY[scene];
  stage.innerHTML = `
    <section class="copy">
      <div class="brand"><img src="${ICON}" alt="">History Plus</div>
      <h1 class="headline">${c.h}</h1>
      <p class="sub">${c.s}</p>
      <div class="chips">${c.chips.map(x => `<span class="chip">${x}</span>`).join('')}</div>
    </section>
    <section class="window">
      <div class="toolbar">
        <div class="dots"><i></i><i></i><i></i></div>
        <div class="omnibox">${lang === 'pt' ? 'pt.wikipedia.org/wiki/Lisboa' : 'en.wikipedia.org/wiki/Lisbon'}</div>
        <span class="tb-icon active"><img src="${ICON}" alt=""></span>
        <span class="tb-icon">${puzzle}</span>
      </div>
      <div class="body">
        <div class="page">
          <div class="sk hero"></div>
          <div class="sk l w9"></div><div class="sk l w7"></div><div class="sk l w8"></div><div class="sk l w5"></div>
          <div class="sk row"><div class="sk card"></div><div class="sk card"></div></div>
          <div class="sk l w9"></div><div class="sk l w7"></div>
        </div>
        <aside class="panel">
          <div class="panel-head"><img src="${ICON}" alt="">History Plus<span class="sp"></span>${close}</div>
          <iframe src="sidebar.html#scene=${scene}"></iframe>
        </aside>
      </div>
    </section>`;
  const frame = stage.querySelector('iframe');
  const poll = setInterval(() => {
    if (frame.contentDocument?.documentElement?.dataset.ready === '1') { clearInterval(poll); document.documentElement.dataset.ready = '1'; }
  }, 100);
}
