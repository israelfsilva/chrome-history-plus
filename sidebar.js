/**
 * History Plus - Visualização, Busca, Seletor de Data e Desfazer Exclusão
 */

/**
 * Internacionalização (chrome.i18n): os textos vêm de _locales/<idioma>/messages.json
 */
function t(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || key;
}

// Idioma das mensagens efetivamente carregadas, para formatar datas no mesmo idioma dos textos
const UI_LOCALE = t('locale');

/**
 * Aplica as traduções aos elementos estáticos do HTML:
 * - data-i18n="chave" define o texto do elemento
 * - data-i18n-attr="atributo:chave, outro:chave2" define atributos (placeholder, aria-label, title)
 */
function applyStaticTranslations() {
  document.documentElement.lang = UI_LOCALE;
  document.title = t('panelTitle');

  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of document.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of el.dataset.i18nAttr.split(',')) {
      const [attr, key] = pair.split(':').map((part) => part.trim());
      el.setAttribute(attr, t(key));
    }
  }

  // Iniciais dos dias da semana, começando no domingo (1º de janeiro de 2023 foi um domingo)
  const weekdayFormat = new Intl.DateTimeFormat(UI_LOCALE, { weekday: 'narrow' });
  const weekdaysContainer = document.querySelector('.calendar-weekdays');
  weekdaysContainer.textContent = '';
  for (let i = 0; i < 7; i++) {
    const span = document.createElement('span');
    span.textContent = weekdayFormat.format(new Date(2023, 0, 1 + i));
    weekdaysContainer.appendChild(span);
  }
}

applyStaticTranslations();

// Ícone SVG padrão (Globo) para fallback quando o favicon não estiver disponível
const FALLBACK_FAVICON = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#747775"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>'
)}`;

// Referências dos elementos do DOM - Busca e Lista
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const historyList = document.getElementById('historyList');
const emptyState = document.getElementById('emptyState');
const emptyTitle = document.getElementById('emptyTitle');
const emptySubtitle = document.getElementById('emptySubtitle');
const loadingState = document.getElementById('loadingState');
const contentContainer = document.querySelector('.content-container');
const resultsCount = document.getElementById('resultsCount');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');

// Referências do Seletor de Data e Calendário
const dateSelectorBar = document.querySelector('.date-selector-bar');
const dateTriggerBtn = document.getElementById('dateTriggerBtn');
const dateTriggerLabel = document.getElementById('dateTriggerLabel');
const clearDateBtn = document.getElementById('clearDateBtn');
const prevDayBtn = document.getElementById('prevDayBtn');
const nextDayBtn = document.getElementById('nextDayBtn');

const calendarPopover = document.getElementById('calendarPopover');
const modeSingleBtn = document.getElementById('modeSingleBtn');
const modeRangeBtn = document.getElementById('modeRangeBtn');
const rangeSummaryBar = document.getElementById('rangeSummaryBar');
const rangeStartSlot = document.getElementById('rangeStartSlot');
const rangeEndSlot = document.getElementById('rangeEndSlot');
const rangeStartText = document.getElementById('rangeStartText');
const rangeEndText = document.getElementById('rangeEndText');
const calendarMonthLabel = document.getElementById('calendarMonthLabel');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');
const calendarGrid = document.getElementById('calendarGrid');
const calendarClearBtn = document.getElementById('calendarClearBtn');
const calendarTodayBtn = document.getElementById('calendarTodayBtn');

// Referências do Snackbar de Desfazer
const undoSnackbar = document.getElementById('undoSnackbar');
const undoMessage = document.getElementById('undoMessage');
const undoBtn = document.getElementById('undoBtn');
const dismissSnackbarBtn = document.getElementById('dismissSnackbarBtn');

// Estado de Busca e Filtro de Data
let debounceTimer = null;
let currentSearchQuery = '';
let activeRequestId = 0;

// Estado do Seletor de Data
let selectedStartDate = null; // Date (00:00:00 local)
let selectedEndDate = null;   // Date (00:00:00 local)
let calendarMode = 'single';  // 'single' | 'range'
let rangeDraftStart = null;   // Date durante seleção do 2º clique no modo período

// Indica se a última busca atingiu o limite de resultados da API
let resultsTruncated = false;

// Estado de Exclusão com Desfazer (Undo)
let pendingDeletion = null; // { url, linkElements, groupContainers, timerId }

const initialNow = new Date();
let viewYear = initialNow.getFullYear();
let viewMonth = initialNow.getMonth();

/**
 * Utilitários de Data (sempre em fuso horário local)
 */
function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 0, 0, 0, 0);
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function capitalizeFirst(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function isDateFilterActive() {
  return selectedStartDate !== null && selectedEndDate !== null;
}

/**
 * Formata uma data curta para o botão principal e cabeçalhos
 */
function formatShortDate(date, includeYearIfDiff = true) {
  if (!date) return '';
  const now = startOfDay(new Date());
  const target = startOfDay(date);
  const yesterday = addDays(now, -1);

  const dayMonth = target.toLocaleDateString(UI_LOCALE, {
    day: '2-digit',
    month: 'short'
  }).replace('.', '');

  if (isSameDay(target, now)) {
    return t('todayShort', dayMonth);
  }
  if (isSameDay(target, yesterday)) {
    return t('yesterdayShort', dayMonth);
  }

  if (includeYearIfDiff && target.getFullYear() !== now.getFullYear()) {
    return target.toLocaleDateString(UI_LOCALE, {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).replace('.', '');
  }

  return dayMonth;
}

/**
 * Atualiza o rótulo e estado visual da barra do seletor de data
 */
function updateDateSelectorUI() {
  const today = startOfDay(new Date());
  const hasDate = isDateFilterActive();

  dateSelectorBar.classList.toggle('has-active-date', hasDate);
  clearDateBtn.hidden = !hasDate;

  if (!hasDate) {
    dateTriggerLabel.textContent = t('allDates');
    nextDayBtn.disabled = true;
  } else if (isSameDay(selectedStartDate, selectedEndDate)) {
    dateTriggerLabel.textContent = formatShortDate(selectedStartDate, true);
    nextDayBtn.disabled = startOfDay(selectedEndDate).getTime() >= today.getTime();
  } else {
    const startStr = selectedStartDate.toLocaleDateString(UI_LOCALE, { day: '2-digit', month: 'short' }).replace('.', '');
    const endStr = selectedEndDate.toLocaleDateString(UI_LOCALE, { day: '2-digit', month: 'short' }).replace('.', '');
    dateTriggerLabel.textContent = `${startStr} – ${endStr}`;
    nextDayBtn.disabled = startOfDay(selectedEndDate).getTime() >= today.getTime();
  }

  // Atualiza barra de resumo do modo período se estiver visível
  rangeSummaryBar.hidden = calendarMode !== 'range';
  if (calendarMode === 'range') {
    const displayStart = rangeDraftStart || selectedStartDate;
    const displayEnd = rangeDraftStart ? null : selectedEndDate;

    rangeStartText.textContent = displayStart
      ? displayStart.toLocaleDateString(UI_LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' })
      : t('rangeSelect');
    rangeEndText.textContent = displayEnd
      ? displayEnd.toLocaleDateString(UI_LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' })
      : t('rangeSelect');

    rangeStartSlot.classList.toggle('pending', !displayStart);
    rangeEndSlot.classList.toggle('pending', Boolean(displayStart && !displayEnd));
  }
}

/**
 * Renderiza o calendário do mês (viewYear, viewMonth)
 */
function renderCalendar() {
  const today = startOfDay(new Date());
  const monthDate = new Date(viewYear, viewMonth, 1);

  const rawMonthLabel = monthDate.toLocaleDateString(UI_LOCALE, {
    month: 'long',
    year: 'numeric'
  });
  calendarMonthLabel.textContent = capitalizeFirst(rawMonthLabel);

  // Desabilita avanço de mês além do mês atual
  const isCurrentOrFutureMonth =
    viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth >= today.getMonth());
  nextMonthBtn.disabled = isCurrentOrFutureMonth;

  calendarGrid.innerHTML = '';

  const firstDayWeek = monthDate.getDay(); // 0 (Dom) a 6 (Sáb)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  // Determina limites para destaque visual no calendário
  const activeStart = rangeDraftStart || selectedStartDate;
  const activeEnd = rangeDraftStart ? rangeDraftStart : selectedEndDate;
  const startMs = activeStart ? startOfDay(activeStart).getTime() : null;
  const endMs = activeEnd ? startOfDay(activeEnd).getTime() : null;

  const totalCells = 42; // 6 semanas completas para altura consistente
  for (let i = 0; i < totalCells; i++) {
    let cellDate;
    let isOutsideMonth = false;

    if (i < firstDayWeek) {
      const dayNum = prevMonthDays - firstDayWeek + i + 1;
      cellDate = new Date(viewYear, viewMonth - 1, dayNum);
      isOutsideMonth = true;
    } else if (i >= firstDayWeek + daysInMonth) {
      const dayNum = i - (firstDayWeek + daysInMonth) + 1;
      cellDate = new Date(viewYear, viewMonth + 1, dayNum);
      isOutsideMonth = true;
    } else {
      const dayNum = i - firstDayWeek + 1;
      cellDate = new Date(viewYear, viewMonth, dayNum);
    }

    const cellMs = startOfDay(cellDate).getTime();
    const isFuture = cellMs > today.getTime();

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'calendar-day';
    btn.disabled = isFuture;
    btn.setAttribute(
      'aria-label',
      cellDate.toLocaleDateString(UI_LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    );

    const numSpan = document.createElement('span');
    numSpan.className = 'day-num';
    numSpan.textContent = String(cellDate.getDate());
    btn.appendChild(numSpan);

    if (isOutsideMonth) {
      btn.classList.add('outside-month');
    }

    if (isSameDay(cellDate, today)) {
      btn.classList.add('today');
    }

    let isPressed = false;
    if (startMs !== null && endMs !== null) {
      if (calendarMode === 'single' || startMs === endMs) {
        if (cellMs === startMs) {
          btn.classList.add('selected');
          isPressed = true;
        }
      } else {
        if (cellMs === startMs) {
          btn.classList.add('range-start');
          isPressed = true;
        } else if (cellMs === endMs) {
          btn.classList.add('range-end');
          isPressed = true;
        } else if (cellMs > startMs && cellMs < endMs) {
          btn.classList.add('in-range');
          isPressed = true;
        }
      }
    }
    btn.setAttribute('aria-pressed', isPressed ? 'true' : 'false');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleCalendarDayClick(cellDate);
    });

    calendarGrid.appendChild(btn);
  }
}

/**
 * Trata o clique em um dia no calendário
 */
function handleCalendarDayClick(clickedDate) {
  const normalized = startOfDay(clickedDate);

  // Se clicou em um dia de outro mês visível na grade, sincroniza a visualização
  viewYear = normalized.getFullYear();
  viewMonth = normalized.getMonth();

  if (calendarMode === 'single') {
    selectedStartDate = normalized;
    selectedEndDate = normalized;
    rangeDraftStart = null;
    updateDateSelectorUI();
    renderCalendar();
    closeCalendarPopover();
    loadHistory(searchInput.value);
    return;
  }

  // Modo Período ('range')
  if (!rangeDraftStart) {
    // 1º clique do período: define início e já atualiza a listagem para o dia inicial
    rangeDraftStart = normalized;
    selectedStartDate = normalized;
    selectedEndDate = normalized;
    updateDateSelectorUI();
    renderCalendar();
    loadHistory(searchInput.value);
  } else {
    // 2º clique do período: ordena início e fim, aplica filtro e fecha o popover
    if (normalized.getTime() < rangeDraftStart.getTime()) {
      selectedStartDate = normalized;
      selectedEndDate = rangeDraftStart;
    } else {
      selectedStartDate = rangeDraftStart;
      selectedEndDate = normalized;
    }
    rangeDraftStart = null;
    updateDateSelectorUI();
    renderCalendar();
    closeCalendarPopover();
    loadHistory(searchInput.value);
  }
}

/**
 * Abre / Fecha o Popover de Calendário
 */
function openCalendarPopover() {
  const focusDate = selectedStartDate || new Date();
  viewYear = focusDate.getFullYear();
  viewMonth = focusDate.getMonth();
  rangeDraftStart = null;

  updateDateSelectorUI();
  renderCalendar();

  calendarPopover.hidden = false;
  dateTriggerBtn.setAttribute('aria-expanded', 'true');
}

function closeCalendarPopover() {
  if (calendarPopover.hidden) return;
  rangeDraftStart = null;
  calendarPopover.hidden = true;
  dateTriggerBtn.setAttribute('aria-expanded', 'false');
  updateDateSelectorUI();
}

function toggleCalendarPopover() {
  if (calendarPopover.hidden) {
    openCalendarPopover();
  } else {
    closeCalendarPopover();
  }
}

/**
 * Alterna entre modo "Dia específico" e "Período"
 */
function setCalendarMode(mode) {
  calendarMode = mode;
  rangeDraftStart = null;

  const isSingle = mode === 'single';
  modeSingleBtn.classList.toggle('active', isSingle);
  modeSingleBtn.setAttribute('aria-selected', isSingle ? 'true' : 'false');
  modeRangeBtn.classList.toggle('active', !isSingle);
  modeRangeBtn.setAttribute('aria-selected', !isSingle ? 'true' : 'false');

  if (isSingle && selectedStartDate && selectedEndDate && !isSameDay(selectedStartDate, selectedEndDate)) {
    selectedStartDate = selectedEndDate;
    loadHistory(searchInput.value);
  }

  updateDateSelectorUI();
  renderCalendar();
}

/**
 * Navega 1 dia para trás ou para frente nos botões `<` e `>`
 */
function stepSelectedDay(deltaDays) {
  const today = startOfDay(new Date());

  if (!isDateFilterActive()) {
    if (deltaDays < 0) {
      selectedStartDate = today;
      selectedEndDate = today;
    } else {
      return;
    }
  } else {
    const nextStart = addDays(selectedStartDate, deltaDays);
    const nextEnd = addDays(selectedEndDate, deltaDays);

    if (nextEnd.getTime() > today.getTime()) {
      return;
    }
    selectedStartDate = nextStart;
    selectedEndDate = nextEnd;
  }

  viewYear = selectedStartDate.getFullYear();
  viewMonth = selectedStartDate.getMonth();
  updateDateSelectorUI();
  if (!calendarPopover.hidden) {
    renderCalendar();
  }
  loadHistory(searchInput.value);
}

/**
 * Limpa apenas o filtro de data (volta para "Todas as datas")
 */
function clearDateFilter() {
  selectedStartDate = null;
  selectedEndDate = null;
  rangeDraftStart = null;
  updateDateSelectorUI();
  if (!calendarPopover.hidden) {
    renderCalendar();
  }
  closeCalendarPopover();
  loadHistory(searchInput.value);
}

/**
 * Retorna a URL oficial do Favicon gerada pelo Chrome MV3
 */
function getFaviconUrl(pageUrl, size = 32) {
  try {
    const url = new URL(chrome.runtime.getURL('/_favicon/'));
    url.searchParams.set('pageUrl', pageUrl);
    url.searchParams.set('size', size.toString());
    return url.toString();
  } catch {
    return FALLBACK_FAVICON;
  }
}

/**
 * Formata o timestamp de visita para exibição amigável (HH:MM)
 */
function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString(UI_LOCALE, { timeStyle: 'short' });
}

/**
 * Agrupa datas para separadores de seção (Hoje, Ontem, ou data completa)
 */
function getDateGroupLabel(timestamp) {
  if (!timestamp) return t('groupOlder');
  const itemDate = startOfDay(new Date(timestamp));
  const now = startOfDay(new Date());
  const yesterday = addDays(now, -1);

  const formattedDate = itemDate.toLocaleDateString(UI_LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(itemDate.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {})
  });

  if (isSameDay(itemDate, now)) {
    return t('groupToday', formattedDate);
  }
  if (isSameDay(itemDate, yesterday)) {
    return t('groupYesterday', formattedDate);
  }

  return formattedDate;
}

/**
 * Simplifica a URL para exibição limpa (remove protocolo e www)
 */
function formatDisplayUrl(rawUrl) {
  try {
    const urlObj = new URL(rawUrl);
    const domain = urlObj.hostname.replace(/^www\./, '');
    const path = urlObj.pathname === '/' ? '' : urlObj.pathname;
    return `${domain}${path}`;
  } catch {
    return rawUrl || '';
  }
}

/**
 * Normaliza texto para busca insensível a maiúsculas/minúsculas e acentos
 */
function normalizeSearchText(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Verifica se o item corresponde a todos os termos da busca
 */
function matchesQuery(item, rawQuery) {
  const trimmed = rawQuery.trim();
  if (!trimmed) return true;

  const terms = normalizeSearchText(trimmed).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const haystack = `${normalizeSearchText(item.title)} ${normalizeSearchText(item.url)}`;
  return terms.every((term) => haystack.includes(term));
}

/**
 * Promisifica chrome.history.search
 */
function queryChromeHistory(params) {
  return new Promise((resolve) => {
    if (!chrome.history?.search) {
      resolve([]);
      return;
    }
    chrome.history.search(params, (results) => {
      resolve(results || []);
    });
  });
}

/**
 * Promisifica chrome.history.getVisits
 */
function getUrlVisits(url) {
  return new Promise((resolve) => {
    if (!chrome.history?.getVisits) {
      resolve([]);
      return;
    }
    chrome.history.getVisits({ url }, (visits) => {
      resolve(visits || []);
    });
  });
}

/**
 * Executa `mapper` sobre os itens com no máximo `limit` chamadas simultâneas
 */
async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index]);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

// Limites de resultados por consulta à API de histórico
const MAX_RESULTS_ALL_DATES = 500;
const MAX_RESULTS_DATE_RANGE = 2000;
const GET_VISITS_CONCURRENCY = 16;

/**
 * Consulta a API de histórico do Chrome com precisão real de visitas no período selecionado.
 * Retorna { items, truncated }, onde `truncated` indica que o limite da API foi atingido.
 */
async function searchHistory(query = '') {
  const trimmedQuery = query.trim();
  const hasDate = isDateFilterActive();

  if (!hasDate) {
    const results = await queryChromeHistory({
      text: trimmedQuery,
      startTime: 0,
      endTime: Date.now(),
      maxResults: MAX_RESULTS_ALL_DATES
    });
    const truncated = results.length >= MAX_RESULTS_ALL_DATES;

    if (trimmedQuery && results.length < 50) {
      const recentAll = await queryChromeHistory({
        text: '',
        startTime: 0,
        endTime: Date.now(),
        maxResults: 1000
      });
      const seenUrls = new Set(results.map((r) => r.url));
      for (const item of recentAll) {
        if (item.url && !seenUrls.has(item.url) && matchesQuery(item, trimmedQuery)) {
          results.push(item);
          seenUrls.add(item.url);
        }
      }
    }

    const items = results
      .filter((item) => item.url && item.url !== pendingDeletion?.url && matchesQuery(item, trimmedQuery))
      .sort((a, b) => (b.lastVisitTime || 0) - (a.lastVisitTime || 0));
    return { items, truncated };
  }

  const startTime = startOfDay(selectedStartDate).getTime();
  const endTime = Math.min(endOfDay(selectedEndDate).getTime(), Date.now());

  const rawItems = await queryChromeHistory({
    text: '',
    startTime,
    endTime,
    maxResults: MAX_RESULTS_DATE_RANGE
  });
  const truncated = rawItems.length >= MAX_RESULTS_DATE_RANGE;

  const matchingItems = rawItems.filter(
    (item) => item.url && item.url !== pendingDeletion?.url && matchesQuery(item, trimmedQuery)
  );

  const isSingleDay = isSameDay(selectedStartDate, selectedEndDate);

  const resolvedEntries = await mapWithConcurrency(
    matchingItems,
    GET_VISITS_CONCURRENCY,
    async (item) => {
      const lastVisit = item.lastVisitTime || 0;

      if (isSingleDay && lastVisit >= startTime && lastVisit <= endTime) {
        return [{ ...item, lastVisitTime: lastVisit }];
      }

      const visits = await getUrlVisits(item.url);
      const visitsInRange = visits.filter(
        (v) => v.visitTime && v.visitTime >= startTime && v.visitTime <= endTime
      );

      if (visitsInRange.length === 0) {
        if (lastVisit >= startTime && lastVisit <= endTime) {
          return [{ ...item, lastVisitTime: lastVisit }];
        }
        return [];
      }

      const latestPerDay = new Map();
      for (const v of visitsInRange) {
        const dayKey = toDateKey(new Date(v.visitTime));
        const prevTime = latestPerDay.get(dayKey) || 0;
        if (v.visitTime > prevTime) {
          latestPerDay.set(dayKey, v.visitTime);
        }
      }

      const entries = [];
      for (const visitTime of latestPerDay.values()) {
        entries.push({
          ...item,
          lastVisitTime: visitTime
        });
      }
      return entries;
    }
  );

  const items = resolvedEntries
    .flat()
    .sort((a, b) => (b.lastVisitTime || 0) - (a.lastVisitTime || 0));
  return { items, truncated };
}

/**
 * Conta os itens visíveis na lista (descontando item oculto aguardando confirmação/desfazer)
 */
function getVisibleHistoryItemCount() {
  return historyList.querySelectorAll('.history-item:not([hidden])').length;
}

/**
 * Atualiza o texto da barra de status e o botão de limpar filtros
 */
function updateStatusBar(count) {
  const hasFilter = isDateFilterActive() || currentSearchQuery.trim() !== '';
  clearFiltersBtn.hidden = !hasFilter;

  if (count === 0) {
    resultsCount.textContent = t('resultsNone');
  } else if (count === 1) {
    resultsCount.textContent = t('resultsOne');
  } else {
    resultsCount.textContent = t('resultsMany', String(count));
  }

  if (resultsTruncated && count > 0) {
    resultsCount.textContent += t('resultsTruncatedSuffix');
    resultsCount.title = t('resultsTruncatedHint');
  } else {
    resultsCount.title = '';
  }
}

/**
 * Efetiva a exclusão pendente no histórico do Chrome
 */
async function commitPendingDeletion() {
  if (!pendingDeletion) return;

  const { url, linkElements, groupContainers, timerId } = pendingDeletion;
  clearTimeout(timerId);
  pendingDeletion = null;
  undoSnackbar.hidden = true;

  try {
    await chrome.history.deleteUrl({ url });
    linkElements.forEach((el) => el.remove());
    for (const group of groupContainers) {
      if (group.querySelectorAll('.history-item').length === 0) {
        group.remove();
      }
    }
  } catch (err) {
    console.warn('Erro ao remover URL do histórico:', err);
  }
}

/**
 * Cancela a exclusão pendente e restaura o item na lista
 */
function undoPendingDeletion() {
  if (!pendingDeletion) return;

  const { linkElements, groupContainers, timerId } = pendingDeletion;
  clearTimeout(timerId);
  pendingDeletion = null;
  undoSnackbar.hidden = true;

  // Se a lista foi recarregada durante a espera, os elementos guardados não estão mais
  // no DOM (e a nova lista omitiu a URL): recarrega para que o item volte a aparecer.
  if (!linkElements.some((el) => el.isConnected)) {
    loadHistory(currentSearchQuery, { silent: true });
    return;
  }

  groupContainers.forEach((group) => { group.hidden = false; });
  linkElements.forEach((el) => { el.hidden = false; });
  emptyState.hidden = true;
  updateStatusBar(getVisibleHistoryItemCount());
}

/**
 * Agenda a exclusão de um item com opção de Desfazer por 5 segundos
 */
async function scheduleItemDeletion(item) {
  // Se já havia uma exclusão pendente, confirma ela antes de iniciar a nova
  if (pendingDeletion) {
    await commitPendingDeletion();
  }

  // deleteUrl remove todas as visitas da URL, então oculta todas as ocorrências dela
  // (no modo Período a mesma URL pode aparecer em vários dias)
  const linkElements = Array.from(historyList.querySelectorAll('.history-item'))
    .filter((el) => el.dataset.url === item.url);
  const groupContainers = new Set(
    linkElements.map((el) => el.closest('.date-group')).filter(Boolean)
  );

  linkElements.forEach((el) => { el.hidden = true; });
  for (const group of groupContainers) {
    if (!group.querySelector('.history-item:not([hidden])')) {
      group.hidden = true;
    }
  }

  const remainingCount = getVisibleHistoryItemCount();
  updateStatusBar(remainingCount);
  if (remainingCount === 0) {
    emptyState.hidden = false;
  }

  const domain = formatDisplayUrl(item.url).split('/')[0] || t('snackbarFallbackItem');
  undoMessage.textContent = isDateFilterActive()
    ? t('snackbarRemovedAllVisits', domain)
    : t('snackbarRemoved', domain);
  undoSnackbar.hidden = false;

  const timerId = setTimeout(() => {
    commitPendingDeletion();
  }, 5000);

  pendingDeletion = {
    url: item.url,
    linkElements,
    groupContainers,
    timerId
  };
}

/**
 * Renderiza os itens de histórico agrupados por dia
 */
function renderHistoryItems(items) {
  historyList.innerHTML = '';
  updateStatusBar(items.length);

  if (!items || items.length === 0) {
    emptyState.hidden = false;
    if (currentSearchQuery.trim()) {
      emptyTitle.textContent = t('emptySearchTitle', currentSearchQuery.trim());
      emptySubtitle.textContent = t('emptySearchSubtitle');
    } else if (isDateFilterActive()) {
      emptyTitle.textContent = t('emptyDateTitle');
      emptySubtitle.textContent = t('emptyDateSubtitle');
    } else {
      emptyTitle.textContent = t('emptyAllTitle');
      emptySubtitle.textContent = t('emptyAllSubtitle');
    }
    return;
  }

  emptyState.hidden = true;

  // Agrupa os itens por dia
  const groups = new Map();
  for (const item of items) {
    if (!item.url) continue;
    const label = getDateGroupLabel(item.lastVisitTime);
    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label).push(item);
  }

  const fragment = document.createDocumentFragment();

  for (const [groupLabel, groupItems] of groups.entries()) {
    const groupContainer = document.createElement('section');
    groupContainer.className = 'date-group';

    const header = document.createElement('h2');
    header.className = 'date-header';
    header.textContent = groupLabel;
    groupContainer.appendChild(header);

    for (const item of groupItems) {
      const itemElement = createHistoryItemElement(item);
      groupContainer.appendChild(itemElement);
    }

    fragment.appendChild(groupContainer);
  }

  historyList.appendChild(fragment);
}

/**
 * Cria o elemento DOM para uma única entrada do histórico
 */
function createHistoryItemElement(item) {
  const link = document.createElement('a');
  link.className = 'history-item';
  link.dataset.url = item.url;
  link.href = item.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.title = `${item.title || item.url}\n${item.url}`;

  // Container do Favicon
  const faviconWrapper = document.createElement('div');
  faviconWrapper.className = 'favicon-container';

  const faviconImg = document.createElement('img');
  faviconImg.className = 'favicon-img';
  faviconImg.alt = '';
  faviconImg.loading = 'lazy';
  faviconImg.src = getFaviconUrl(item.url, 32);

  faviconImg.onerror = () => {
    faviconImg.onerror = null;
    faviconImg.src = FALLBACK_FAVICON;
  };

  faviconWrapper.appendChild(faviconImg);

  // Detalhes textuais (Título e URL)
  const details = document.createElement('div');
  details.className = 'item-details';

  const title = document.createElement('span');
  title.className = 'item-title';
  title.textContent = item.title || item.url;

  const urlSpan = document.createElement('span');
  urlSpan.className = 'item-url';
  urlSpan.textContent = formatDisplayUrl(item.url);

  details.appendChild(title);
  details.appendChild(urlSpan);

  // Hora da visita
  const time = document.createElement('time');
  time.className = 'item-time';
  time.textContent = formatTime(item.lastVisitTime);

  // Botão de excluir item do histórico
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'item-delete-btn';
  deleteBtn.type = 'button';
  deleteBtn.title = t('deleteItemTitle');
  deleteBtn.setAttribute('aria-label', t('deleteItemLabel'));
  deleteBtn.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
  `;

  deleteBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    scheduleItemDeletion(item);
  });

  // Abertura em nova aba através de chrome.tabs (Ctrl/Cmd+clique abre em segundo plano)
  link.addEventListener('click', (event) => {
    if (event.target.closest('.item-delete-btn')) return;
    event.preventDefault();
    chrome.tabs.create({ url: item.url, active: !(event.ctrlKey || event.metaKey) });
  });

  link.appendChild(faviconWrapper);
  link.appendChild(details);
  link.appendChild(time);
  link.appendChild(deleteBtn);

  return link;
}

/**
 * Carrega e exibe os itens de histórico (protegido contra condições de corrida)
 */
async function loadHistory(query = '', { silent = false } = {}) {
  currentSearchQuery = query;
  const requestId = ++activeRequestId;

  // Recargas silenciosas (ex.: nova visita) não mostram o spinner e preservam a rolagem
  if (!silent) {
    loadingState.hidden = false;
  }
  historyList.setAttribute('aria-busy', 'true');
  const previousScrollTop = contentContainer.scrollTop;

  try {
    const { items, truncated } = await searchHistory(query);
    if (requestId !== activeRequestId) return;
    resultsTruncated = truncated;
    renderHistoryItems(items);
    if (silent) {
      contentContainer.scrollTop = previousScrollTop;
    }
  } catch (error) {
    if (requestId !== activeRequestId) return;
    console.error('Erro ao buscar histórico:', error);
    historyList.innerHTML = '';
    emptyTitle.textContent = t('errorTitle');
    emptySubtitle.textContent = t('errorSubtitle');
    emptyState.hidden = false;
    resultsTruncated = false;
    updateStatusBar(0);
  } finally {
    if (requestId === activeRequestId) {
      loadingState.hidden = true;
      historyList.setAttribute('aria-busy', 'false');
    }
  }
}

/**
 * Trata digitação com debounce para filtro em tempo real
 */
function handleSearchInput(event) {
  const query = event.target.value;
  clearSearchBtn.hidden = query.length === 0;

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    loadHistory(query);
  }, 140);
}

/**
 * Limpa a caixa de pesquisa e recarrega os itens
 */
function handleClearSearch() {
  searchInput.value = '';
  clearSearchBtn.hidden = true;
  searchInput.focus();
  loadHistory('');
}

/**
 * Redefine todos os filtros (data e pesquisa de texto)
 */
function resetAllFilters() {
  searchInput.value = '';
  clearSearchBtn.hidden = true;
  selectedStartDate = null;
  selectedEndDate = null;
  rangeDraftStart = null;
  updateDateSelectorUI();
  closeCalendarPopover();
  loadHistory('');
}

// Event Listeners do Seletor de Data e Calendário
dateTriggerBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleCalendarPopover();
});

clearDateBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  clearDateFilter();
});

prevDayBtn.addEventListener('click', () => {
  stepSelectedDay(-1);
});

nextDayBtn.addEventListener('click', () => {
  stepSelectedDay(1);
});

modeSingleBtn.addEventListener('click', () => {
  setCalendarMode('single');
});

modeRangeBtn.addEventListener('click', () => {
  setCalendarMode('range');
});

prevMonthBtn.addEventListener('click', () => {
  viewMonth -= 1;
  if (viewMonth < 0) {
    viewMonth = 11;
    viewYear -= 1;
  }
  renderCalendar();
});

nextMonthBtn.addEventListener('click', () => {
  const today = new Date();
  if (viewYear === today.getFullYear() && viewMonth >= today.getMonth()) return;
  viewMonth += 1;
  if (viewMonth > 11) {
    viewMonth = 0;
    viewYear += 1;
  }
  renderCalendar();
});

calendarClearBtn.addEventListener('click', () => {
  clearDateFilter();
});

calendarTodayBtn.addEventListener('click', () => {
  const today = startOfDay(new Date());
  selectedStartDate = today;
  selectedEndDate = today;
  rangeDraftStart = null;
  viewYear = today.getFullYear();
  viewMonth = today.getMonth();
  updateDateSelectorUI();
  renderCalendar();
  closeCalendarPopover();
  loadHistory(searchInput.value);
});

// Event Listeners do Snackbar de Desfazer
undoBtn.addEventListener('click', () => {
  undoPendingDeletion();
});

dismissSnackbarBtn.addEventListener('click', () => {
  commitPendingDeletion();
});

// Garante que qualquer exclusão pendente seja efetivada caso a barra lateral seja fechada
window.addEventListener('pagehide', () => {
  if (pendingDeletion) {
    chrome.history.deleteUrl({ url: pendingDeletion.url });
  }
});

// Fecha o popover ao clicar fora ou pressionar Escape
document.addEventListener('click', (event) => {
  if (!calendarPopover.hidden && !event.target.closest('.date-selector-wrapper')) {
    closeCalendarPopover();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !calendarPopover.hidden) {
    closeCalendarPopover();
    dateTriggerBtn.focus();
  }
});

// Event Listeners da busca e redefinição
clearFiltersBtn.addEventListener('click', resetAllFilters);
searchInput.addEventListener('input', handleSearchInput);
clearSearchBtn.addEventListener('click', handleClearSearch);

// Atualização automática (silenciosa e agrupada) quando uma nova página for visitada
let visitRefreshTimer = null;
if (chrome.history?.onVisited) {
  chrome.history.onVisited.addListener(() => {
    clearTimeout(visitRefreshTimer);
    visitRefreshTimer = setTimeout(() => {
      if (!searchInput.value.trim() && !isDateFilterActive() && !pendingDeletion) {
        loadHistory('', { silent: true });
      }
    }, 500);
  });
}

// Inicialização ao abrir a barra lateral
document.addEventListener('DOMContentLoaded', () => {
  updateDateSelectorUI();
  loadHistory('');
  searchInput.focus();
});
