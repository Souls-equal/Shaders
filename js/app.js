import { CATEGORIES, PACKS } from './config.js';
import { loadShader } from './shader-loader.js';
import { attachFileDrag, getDragSupport } from './drag-drop.js';
import { initI18n, t, formatSize, number, packText, categoryText, onLanguageChange } from './i18n.js';

const $ = id => document.getElementById(id);
const dialog = $('pack-dialog');
const support = getDragSupport();
let selectedPack = null;
let preparedFile = null;
let controller = null;
let generation = 0;
let downloadURL = null;
let downloadTimer = null;
let activeCategory = CATEGORIES[0].id;
let messageState = { key: '', tone: 'info', params: {} };
let progressState = { received: 0, percent: 0, phase: 'fetching' };

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function icon(name) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  node.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(node.namespaceURI, 'use');
  use.setAttribute('href', `#i-${name}`);
  node.append(use);
  return node;
}
function packTitle(pack) { return `${pack.name} · ${pack.version}${pack.font ? ` · ${pack.font}` : ''}`; }
function message(key = '', tone = 'info', params = {}) {
  messageState = { key, tone, params };
  renderMessage();
}
function renderMessage() {
  $('app-message').textContent = messageState.key ? t(messageState.key, messageState.params) : '';
  $('app-message').dataset.tone = messageState.tone;
  $('app-message').hidden = !messageState.key;
}
function renderProgress() {
  const { received, percent, phase } = progressState;
  if (percent === null) $('load-progress').removeAttribute('value');
  else $('load-progress').value = percent;
  $('progress-value').textContent = percent === null ? formatSize(received) : `${number(percent)} %`;
  $('progress-label').textContent = received === 0 ? t('progress.fetching') : phase === 'checking' ? t('progress.checking') : t('progress.received', { size: formatSize(received) });
}
function revokeDownload() {
  clearTimeout(downloadTimer);
  downloadTimer = null;
  if (downloadURL) URL.revokeObjectURL(downloadURL);
  downloadURL = null;
}
function renderTransfer() {
  const busy = !!controller;
  const ready = !!preparedFile;
  $('download-button').disabled = busy;
  $('download-label').textContent = busy ? t('download.busy') : t('download.idle');
  $('prepare-button').disabled = busy || ready || !support.supported;
  $('prepare-button').textContent = ready ? t('prepare.ready') : busy ? t('prepare.busy') : t('prepare.idle');
  $('clear-button').disabled = !busy && !ready;
  $('clear-button').querySelector('span').textContent = busy ? t('clear.busy') : t('clear.idle');
  $('progress-section').hidden = !busy;
  $('memory-label').textContent = busy ? t('memory.busy') : ready ? t('memory.ready', { size: formatSize(preparedFile.size) }) : t('memory.idle');
  $('drag-zone').draggable = ready && support.supported;
  $('drag-zone').setAttribute('aria-disabled', String(!ready || !support.supported));
  $('drag-zone').classList.remove('is-dragging');
  $('drag-title').textContent = ready ? t('drag.ready') : t('drag.idle');
  $('drag-subtitle').textContent = ready ? `${preparedFile.name} · ${formatSize(preparedFile.size)}` : t('drag.noDisk');
}
function clearFile(announce = false) {
  generation++;
  const loading = !!controller;
  controller?.abort();
  controller = null;
  preparedFile = null;
  revokeDownload();
  renderTransfer();
  message(announce ? loading ? 'status.cancelled' : 'status.cleared' : '');
}

function renderPackDetails(pack) {
  $('dialog-title').textContent = packTitle(pack);
  $('ui-pack-note').hidden = pack.category !== 'ui';
  $('ui-pack-note').textContent = pack.category === 'ui' ? `${t('ui.versionNote')} ${t(pack.font === 'font-pixel' ? 'ui.pixelNote' : 'ui.normalNote')}` : '';
  $('dialog-meta').textContent = `${pack.author || t('details.unknownAuthor')} · ZIP · ${formatSize(pack.expectedSizeBytes)}${pack.apiVersion ? ` · API ${pack.apiVersion}` : ''}`;
  $('dialog-preview').hidden = !pack.preview;
  if (pack.preview) {
    $('dialog-preview-image').src = pack.preview.src;
    $('dialog-preview-image').alt = packText(pack, 'alt');
    $('dialog-preview-label').textContent = t(pack.preview.type === 'screenshot' ? 'preview.capture' : 'preview.disclaimer');
  } else {
    $('dialog-preview-image').removeAttribute('src');
    $('dialog-preview-image').alt = '';
  }
  const list = $('file-metadata');
  list.replaceChildren();
  for (const [key, value] of [
    ['details.author', pack.author || t('details.unknownAuthor')], ['details.version', pack.version],
    ...(pack.font ? [['details.font', pack.font], ['details.scope', t('ui.scope')]] : []),
    ...(pack.apiVersion ? [['details.api', String(pack.apiVersion)]] : []),
    ['details.file', pack.filename], ['details.size', t('details.bytes', { count: number(pack.expectedSizeBytes) })],
    ['details.source', new URL(pack.url, document.baseURI).href], ['SHA-256', pack.sha256 || t('details.noHash')],
  ]) list.append(element('dt', '', key === 'SHA-256' ? key : t(key)), element('dd', '', value));
}
function showPack(pack) {
  clearFile();
  selectedPack = pack;
  renderPackDetails(pack);
  $('experimental-options').open = false;
  $('file-metadata').parentElement.open = false;
  if (!support.supported) message('status.unsupported');
  dialog.showModal();
  $('download-button').focus({ preventScroll: true });
}

function makeCard(pack) {
  const card = element('article', `pack-card${pack.featured ? ' featured' : ''}${pack.preview ? ' with-preview' : ''}`);
  card.dataset.packId = pack.id;
  if (pack.preview) {
    const art = element('div', 'shader-art');
    art.dataset.previewUnavailable = t('preview.unavailable');
    const image = element('img');
    image.src = pack.preview.src;
    image.alt = packText(pack, 'alt');
    image.width = pack.preview.width || 1280;
    image.height = pack.preview.height || 720;
    image.loading = pack.featured ? 'eager' : 'lazy';
    image.fetchPriority = pack.featured ? 'high' : 'auto';
    image.decoding = 'async';
    image.addEventListener('error', () => art.classList.add('preview-unavailable'));
    const top = element('div', 'art-top');
    const badge = element('span', 'art-badge', pack.featured ? t('badge.featured') : packText(pack, 'theme') || t('badge.shader'));
    badge.prepend(icon('spark'));
    top.append(badge, element('span', 'zip-badge', pack.version));
    const bottom = element('div', 'art-bottom');
    const wordmark = element('span', 'art-wordmark', pack.name.toUpperCase());
    wordmark.append(element('span', '', packText(pack, 'tagline') || t('preview.tagline')));
    bottom.append(wordmark, element('span', 'preview-label', pack.preview.type === 'screenshot' ? t('preview.capture') : t('preview.illustration')));
    art.append(image, top, bottom);
    card.append(art);
  }
  const body = element('div', 'pack-body');
  const top = element('div', 'pack-topline');
  const badge = element('span', 'category-badge', pack.featured ? t('badge.featured') : pack.archived ? t('badge.archive') : t('badge.community'));
  top.append(badge, element('span', 'pack-version', pack.version));
  if (!pack.preview) {
    const cube = element('span', 'archive-icon');
    cube.append(icon('cube'));
    body.append(cube);
  }
  body.append(top, element('h3', '', pack.name), element('p', 'author', t('pack.by', { author: pack.author || t('details.unknownAuthor'), api: pack.apiVersion ? ` · API ${pack.apiVersion}` : '' })), element('p', 'pack-description', packText(pack, 'description')));
  const bottom = element('div', 'pack-bottom');
  const specs = element('span', 'pack-size', `ZIP · ${formatSize(pack.expectedSizeBytes)}`);
  const button = element('button', pack.featured ? 'get-pack primary-button' : 'get-pack secondary-button', t('pack.get'));
  button.type = 'button';
  button.setAttribute('aria-label', t('pack.getAria', { pack: packTitle(pack) }));
  button.append(icon('arrow'));
  button.addEventListener('click', () => showPack(pack));
  bottom.append(specs, button);
  body.append(bottom);
  card.append(body);
  return card;
}

function makeUICard(variants) {
  const pack = variants[0];
  const card = element('article', 'pack-card ui-card');
  card.dataset.uiFamily = pack.family;
  card.style.setProperty('--ui-accent', pack.color);
  const body = element('div', 'pack-body');
  const top = element('div', 'pack-topline');
  top.append(element('span', 'category-badge', t('ui.badge')), element('span', 'pack-version', pack.version));
  const swatch = element('div', 'ui-swatch');
  swatch.setAttribute('aria-hidden', 'true');
  swatch.append(icon('layers'), element('span', '', 'Aa'), element('span', 'ui-swatch-lines', '≡'));
  body.append(top, swatch, element('h3', '', pack.name), element('p', 'pack-description', packText(pack, 'description')));
  const choices = element('div', 'ui-choices');
  for (const variant of variants) {
    const button = element('button', 'get-pack secondary-button ui-choice');
    button.type = 'button';
    button.dataset.packId = variant.id;
    button.setAttribute('aria-label', t('pack.getAria', { pack: packTitle(variant) }));
    button.append(element('span', '', variant.font), element('span', 'pack-size', `ZIP · ${formatSize(variant.expectedSizeBytes)}`), icon('arrow'));
    button.addEventListener('click', () => showPack(variant));
    choices.append(button);
  }
  body.append(choices, element('p', 'ui-caption', t('ui.swatch')));
  card.append(body);
  return card;
}

function selectCategory(id, { focus = false } = {}) {
  activeCategory = id;
  const category = CATEGORIES.find(item => item.id === id);
  for (const tab of $('category-tabs').children) {
    const selected = tab.id === `tab-${id}`;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  }
  $('catalog-panel').setAttribute('aria-labelledby', `tab-${id}`);
  $('category-description').textContent = categoryText(category, 'description');
  const packs = PACKS.filter(pack => pack.category === id)
    .sort((a, b) => Number(!!a.archived) - Number(!!b.archived));
  const grid = $('pack-grid');
  grid.replaceChildren();
  let archivesLabelled = false;
  const renderedFamilies = new Set();
  for (const pack of packs) {
    if (pack.family && pack.category === 'ui') {
      if (!renderedFamilies.has(pack.family)) {
        grid.append(makeUICard(packs.filter(item => item.family === pack.family)));
        renderedFamilies.add(pack.family);
      }
      continue;
    }
    if (pack.archived && !archivesLabelled) {
      const heading = element('div', 'catalog-divider');
      heading.append(element('h3', '', t('archives.title')), element('span', '', t('archives.text')));
      grid.append(heading);
      archivesLabelled = true;
    }
    grid.append(makeCard(pack));
  }
  if (!packs.length) {
    const empty = element('div', 'empty-state');
    const emptyIcon = element('span', 'empty-icon');
    emptyIcon.append(icon(category.icon));
    empty.append(emptyIcon, element('h3', '', t('empty.title')), element('p', '', t(id === 'schems' ? 'empty.schems' : id === 'ui' ? 'empty.ui' : 'empty.t-packs')), element('span', 'empty-caption', t('empty.caption')));
    grid.append(empty);
  }
  if (id === 'ui' && renderedFamilies.size) {
    $('library-status').textContent = t('ui.count', { themes: number(renderedFamilies.size), count: number(packs.length) });
    return;
  }
  $('library-status').textContent = t(packs.length === 1 ? 'catalog.one' : 'catalog.many', { count: number(packs.length), category: categoryText(category, 'label') });
}
for (const category of CATEGORIES) {
  const tab = element('button', 'category-tab');
  tab.type = 'button';
  tab.id = `tab-${category.id}`;
  tab.setAttribute('role', 'tab');
  tab.setAttribute('aria-controls', 'catalog-panel');
  tab.append(icon(category.icon), element('span', 'category-label', categoryText(category, 'label')), element('span', 'count-badge', String(PACKS.filter(pack => pack.category === category.id).length).padStart(2, '0')));
  tab.addEventListener('click', () => selectCategory(category.id));
  tab.addEventListener('keydown', event => {
    const index = CATEGORIES.findIndex(item => item.id === activeCategory);
    const next = event.key === 'ArrowRight' ? (index + 1) % CATEGORIES.length : event.key === 'ArrowLeft' ? (index + CATEGORIES.length - 1) % CATEGORIES.length : event.key === 'Home' ? 0 : event.key === 'End' ? CATEGORIES.length - 1 : null;
    if (next !== null) {
      event.preventDefault();
      selectCategory(CATEGORIES[next].id, { focus: true });
    }
  });
  $('category-tabs').append(tab);
}
selectCategory(activeCategory);

function errorKey(error) {
  if (error.name === 'AbortError') return 'status.cancelled';
  if (error.code === 'HTTP' && /404/.test(error.message)) return 'error.404';
  const codes = ['HTTP', 'NETWORK', 'SIZE', 'FORMAT', 'MIME', 'INTEGRITY', 'TIMEOUT', 'MEMORY', 'SOURCE', 'CONFIG', 'EXTENSION', 'UNSUPPORTED'];
  return codes.includes(error.code) ? `error.${error.code}` : 'error.unknown';
}
async function obtain(method) {
  if (!selectedPack || controller) return;
  const pack = selectedPack;
  const current = ++generation;
  const request = new AbortController();
  controller = request;
  message();
  progressState = { received: 0, percent: 0, phase: 'fetching' };
  renderProgress();
  renderTransfer();
  try {
    const file = preparedFile || await loadShader(pack, {
      signal: request.signal,
      onProgress: ({ received, percent, phase }) => {
        if (generation !== current) return;
        progressState = { received, percent, phase };
        renderProgress();
      },
    });
    if (generation !== current || request.signal.aborted) return;
    preparedFile = file;
    controller = null;
    renderTransfer();
    if (method === 'download') {
      // Only this explicitly requested path writes a download. Opening a pack,
      // preparing a File, or dragging never invokes this link.
      revokeDownload();
      downloadURL = URL.createObjectURL(file);
      const link = element('a');
      link.href = downloadURL;
      link.download = pack.filename;
      document.body.append(link);
      link.click();
      link.remove();
      downloadTimer = setTimeout(revokeDownload, 60000);
      message('status.download');
    } else message('status.prepared');
  } catch (error) {
    if (generation !== current) return;
    controller = null;
    preparedFile = null;
    renderTransfer();
    message(errorKey(error), 'error');
  }
}
$('download-button').addEventListener('click', () => obtain('download'));
$('prepare-button').addEventListener('click', () => obtain('drag'));
$('clear-button').addEventListener('click', () => clearFile(true));
function closeDialog() {
  const returnId = selectedPack?.id;
  clearFile();
  selectedPack = null;
  if (dialog.open) dialog.close();
  if (returnId) document.querySelector(`[data-pack-id="${CSS.escape(returnId)}"].get-pack, [data-pack-id="${CSS.escape(returnId)}"] .get-pack`)?.focus({ preventScroll: true });
}
$('close-dialog').addEventListener('click', closeDialog);
dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
dialog.addEventListener('close', () => {
  // Ignore a delayed close event if another pack has already been opened.
  if (!dialog.open) { clearFile(); selectedPack = null; }
});
// Backdrop click closes; clicks in content never do. Escape is handled natively.
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog();
});
attachFileDrag($('drag-zone'), {
  getFile: () => preparedFile,
  onStart: () => message('status.dragStart'),
  onEnd: () => { if (preparedFile) message('status.dragEnd'); },
  onError: () => message('status.dragError', 'error'),
});
$('drag-zone').addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    message('status.keyboard');
    $('download-button').focus();
  }
});
window.addEventListener('pagehide', closeDialog);
renderTransfer();

// Translation is a view update only: do not clear, refetch or redownload a pack.
onLanguageChange(() => {
  for (const category of CATEGORIES) {
    $(`tab-${category.id}`).querySelector('.category-label').textContent = categoryText(category, 'label');
  }
  selectCategory(activeCategory);
  if (selectedPack) renderPackDetails(selectedPack);
  renderTransfer();
  renderMessage();
  renderProgress();
});
initI18n();
