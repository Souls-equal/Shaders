import { CATEGORIES, PACKS } from './config.js';
import { formatBytes, loadShader } from './shader-loader.js';
import { attachFileDrag, getDragSupport } from './drag-drop.js';

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
function packTitle(pack) { return `${pack.name} · ${pack.version}`; }
function message(text = '', tone = 'info') {
  $('app-message').textContent = text;
  $('app-message').dataset.tone = tone;
  $('app-message').hidden = !text;
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
  $('download-label').textContent = busy ? 'Vérification du fichier…' : 'Télécharger le ZIP';
  $('prepare-button').disabled = busy || ready || !support.supported;
  $('prepare-button').textContent = ready ? 'Fichier prêt en mémoire' : busy ? 'Préparation…' : 'Préparer en mémoire';
  $('clear-button').disabled = !busy && !ready;
  $('clear-button').querySelector('span').textContent = busy ? 'Annuler le chargement' : 'Libérer le fichier';
  $('progress-section').hidden = !busy;
  $('memory-label').textContent = busy ? 'Chargement en cours…' : ready ? `${formatBytes(preparedFile.size)} en mémoire` : 'Aucun fichier chargé';
  $('drag-zone').draggable = ready && support.supported;
  $('drag-zone').setAttribute('aria-disabled', String(!ready || !support.supported));
  $('drag-zone').classList.remove('is-dragging');
  $('drag-title').textContent = ready ? 'Glisser ce fichier — sans garantie de transfert' : 'Préparez d’abord le fichier';
  $('drag-subtitle').textContent = ready ? `${preparedFile.name} · ${formatBytes(preparedFile.size)}` : 'Aucun enregistrement sur disque';
}
function clearFile(announce = false) {
  generation++;
  const loading = !!controller;
  controller?.abort();
  controller = null;
  preparedFile = null;
  revokeDownload();
  renderTransfer();
  message(announce ? loading ? 'Chargement annulé. Aucun téléchargement n’a été lancé.' : 'Références au fichier et URL temporaires libérées.' : '');
}

function showPack(pack) {
  clearFile();
  selectedPack = pack;
  $('dialog-title').textContent = packTitle(pack);
  $('dialog-meta').textContent = `${pack.author} · ZIP · ${formatBytes(pack.expectedSizeBytes)}`;
  $('experimental-options').open = false;
  const list = $('file-metadata');
  list.replaceChildren();
  for (const [key, value] of [
    ['Fichier', pack.filename], ['Taille publiée', `${pack.expectedSizeBytes.toLocaleString('fr-FR')} octets`],
    ['Source', new URL(pack.url, document.baseURI).href], ['SHA-256', pack.sha256 || 'Non configuré'],
  ]) list.append(element('dt', '', key), element('dd', '', value));
  $('file-metadata').parentElement.open = false;
  if (!support.supported) message('Ce navigateur ne permet pas le glisser-déposer d’un fichier en mémoire. Le téléchargement reste disponible.');
  dialog.showModal();
  // Focus the explicit, recommended choice, not the experimental method.
  $('download-button').focus({ preventScroll: true });
}

function makeCard(pack) {
  const card = element('article', `pack-card${pack.featured ? ' featured' : ''}`);
  card.dataset.packId = pack.id;
  if (pack.featured) {
    const art = element('div', 'shader-art');
    const image = element('img');
    image.src = 'assets/aurora-landscape.webp';
    image.alt = 'Vallée en blocs au coucher du soleil : illustration, pas une capture du shader en jeu.';
    image.width = 1536;
    image.height = 1024;
    image.fetchPriority = 'high';
    const top = element('div', 'art-top');
    const badge = element('span', 'art-badge', 'À LA UNE');
    badge.prepend(icon('spark'));
    top.append(badge, element('span', 'zip-badge', 'NOUVELLE VERSION'));
    const bottom = element('div', 'art-bottom');
    const wordmark = element('span', 'art-wordmark', pack.name.toUpperCase());
    wordmark.append(element('span', '', 'Une autre atmosphère. Le même monde.'));
    bottom.append(wordmark, element('span', 'preview-label', 'Illustration'));
    art.append(image, top, bottom);
    card.append(art);
  }
  const body = element('div', 'pack-body');
  const top = element('div', 'pack-topline');
  const badge = element('span', 'category-badge', pack.featured ? 'À LA UNE' : pack.archived ? 'ARCHIVE' : 'PACK COMMUNAUTAIRE');
  top.append(badge, element('span', 'pack-version', pack.version));
  if (!pack.featured) {
    const cube = element('span', 'archive-icon');
    cube.append(icon('cube'));
    body.append(cube);
  }
  body.append(top, element('h3', '', pack.name), element('p', 'author', `par ${pack.author}`), element('p', 'pack-description', pack.description));
  const bottom = element('div', 'pack-bottom');
  const specs = element('span', 'pack-size', `ZIP · ${formatBytes(pack.expectedSizeBytes)}`);
  const button = element('button', pack.featured ? 'get-pack primary-button' : 'get-pack secondary-button', 'Obtenir le pack');
  button.type = 'button';
  button.setAttribute('aria-label', `Obtenir ${packTitle(pack)}`);
  button.append(icon('arrow'));
  button.addEventListener('click', () => showPack(pack));
  bottom.append(specs, button);
  body.append(bottom);
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
  $('category-description').textContent = category.description;
  const packs = PACKS.filter(pack => pack.category === id);
  const grid = $('pack-grid');
  grid.replaceChildren(...packs.map(makeCard));
  grid.classList.toggle('has-featured', packs.some(pack => pack.featured));
  if (!packs.length) {
    const empty = element('div', 'empty-state');
    const emptyIcon = element('span', 'empty-icon');
    emptyIcon.append(icon(category.icon));
    empty.append(emptyIcon, element('h3', '', 'Une collection à construire.'), element('p', '', `Aucun ${id === 'schems' ? 'schematic' : 'texture pack'} disponible pour le moment.`), element('span', 'empty-caption', 'Les prochains packs publiés apparaîtront ici, avec les mêmes options de récupération.'));
    grid.append(empty);
  }
  $('library-status').textContent = `${packs.length} ${packs.length === 1 ? 'pack disponible' : 'packs disponibles'} dans la catégorie ${category.label}.`;
}
for (const category of CATEGORIES) {
  const tab = element('button', 'category-tab');
  tab.type = 'button';
  tab.id = `tab-${category.id}`;
  tab.setAttribute('role', 'tab');
  tab.setAttribute('aria-controls', 'catalog-panel');
  tab.append(icon(category.icon), element('span', '', category.label), element('span', 'count-badge', String(PACKS.filter(pack => pack.category === category.id).length).padStart(2, '0')));
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

const errorMessages = {
  HTTP: 'Le serveur n’a pas pu fournir cette archive.', NETWORK: 'Chargement impossible : vérifiez le réseau, HTTPS et la politique CORS du serveur.',
  SIZE: 'Le fichier dépasse la taille autorisée.', FORMAT: 'Cette archive ZIP est invalide ou non prise en charge.', MIME: 'Le serveur n’a pas renvoyé un fichier ZIP.',
  INTEGRITY: 'Le fichier ne correspond pas à la taille ou à l’empreinte publiée. Aucun téléchargement lancé.',
  TIMEOUT: 'Le serveur a mis trop de temps à répondre. Réessayez.', MEMORY: 'Mémoire insuffisante. Fermez quelques onglets ou essayez un fichier plus petit.',
  SOURCE: 'La provenance du fichier n’est pas autorisée ou une redirection a été refusée.',
};
async function obtain(method) {
  if (!selectedPack || controller) return;
  const pack = selectedPack;
  const current = ++generation;
  const request = new AbortController();
  controller = request;
  message();
  $('load-progress').value = 0;
  $('progress-value').textContent = '0 %';
  $('progress-label').textContent = 'Récupération et vérification…';
  renderTransfer();
  try {
    const file = preparedFile || await loadShader(pack, {
      signal: request.signal,
      onProgress: ({ received, percent, phase }) => {
        if (generation !== current) return;
        if (percent === null) $('load-progress').removeAttribute('value');
        else $('load-progress').value = percent;
        $('progress-value').textContent = percent === null ? formatBytes(received) : `${percent} %`;
        $('progress-label').textContent = phase === 'checking' ? 'Contrôle du ZIP et de son intégrité…' : `${formatBytes(received)} reçus`;
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
      message('Téléchargement demandé. Sélectionnez ensuite ce ZIP dans l’importeur de Bloxd.io. Si le navigateur demande une confirmation, autorisez l’enregistrement. L’import en jeu n’est pas vérifié.');
    } else message('Vrai fichier prêt en mémoire. Attention : le navigateur peut perdre ce fichier pendant le glisser-déposer. Vérifiez le résultat dans la page de destination ; le téléchargement est l’option recommandée.');
  } catch (error) {
    if (generation !== current) return;
    controller = null;
    preparedFile = null;
    renderTransfer();
    message(error.name === 'AbortError' ? 'Chargement annulé.' : error.code === 'HTTP' && /404/.test(error.message) ? 'Le serveur ne trouve pas cette archive (HTTP 404).' : errorMessages[error.code] || `Impossible de préparer le fichier : ${error.message}`, 'error');
  }
}
$('download-button').addEventListener('click', () => obtain('download'));
$('prepare-button').addEventListener('click', () => obtain('drag'));
$('clear-button').addEventListener('click', () => clearFile(true));
function closeDialog() {
  clearFile();
  selectedPack = null;
  if (dialog.open) dialog.close();
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
  onStart: () => message('Le vrai File a été ajouté au départ du drag. Cela ne prouve pas que le navigateur le transmet à Bloxd.io.'),
  onEnd: () => { if (preparedFile) message('Glisser-déposer terminé. Le résultat d’import est inconnu. Si Bloxd ne reçoit aucun fichier, utilisez le téléchargement.'); },
  onError: () => message('Le navigateur a refusé de joindre le fichier au drag. Utilisez le téléchargement.', 'error'),
});
$('drag-zone').addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    message('Le glisser-déposer nécessite un geste réel à la souris. Le bouton Télécharger le ZIP est accessible au clavier.');
    $('download-button').focus();
  }
});
window.addEventListener('pagehide', closeDialog);
renderTransfer();
