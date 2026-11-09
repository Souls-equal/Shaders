import { PACKS } from './config.js';
import { initI18n, t, number, formatSize, onLanguageChange } from './i18n.js';

const receiver = document.getElementById('receiver');
const status = document.getElementById('receiver-status');
const results = document.getElementById('receiver-results');
const clear = document.getElementById('clear-results');
let generation = 0;
// Retain only metadata, never the dropped File, so a language change needs no re-read.
let state = { status: 'diag.waiting', metadata: null };
function render() {
  status.textContent = t(state.status);
  const data = state.metadata;
  results.hidden = !data;
  clear.disabled = !data;
  if (!data) { results.textContent = ''; return; }
  const lines = [
    t('diag.trusted', { value: t(data.trusted ? 'diag.true' : 'diag.false') }),
    t('diag.origin', { value: data.origin }), t('diag.browser', { value: data.browser }),
    t('diag.count', { value: number(data.count) }), t('diag.types', { value: data.types.join(', ') || t('diag.none') }),
  ];
  if (data.file) {
    lines.push('', t('diag.name', { value: data.file.name }), t('diag.mime', { value: data.file.mime || t('diag.notSupplied') }),
      t('diag.size', { bytes: t('details.bytes', { count: number(data.file.size) }), size: formatSize(data.file.size) }),
      t('diag.real', { value: t(data.file.real ? 'diag.true' : 'diag.false') }));
  }
  if (data.hashNote) lines.push(t(data.hashNote));
  if (data.hash) lines.push(t('diag.hash', { value: data.hash }), t('diag.matches', { value: data.matches.join(', ') || t('diag.none') }));
  results.textContent = lines.join('\n');
}
function reset() {
  generation++;
  state = { status: 'diag.reset', metadata: null };
  render();
}
clear.addEventListener('click', reset);
window.addEventListener('dragover', event => event.preventDefault());
window.addEventListener('drop', event => event.preventDefault());
receiver.addEventListener('dragover', event => {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  receiver.classList.add('is-over');
});
receiver.addEventListener('dragleave', () => receiver.classList.remove('is-over'));
receiver.addEventListener('drop', async event => {
  event.preventDefault();
  receiver.classList.remove('is-over');
  if (!event.isTrusted) {
    state.status = 'diag.synthetic';
    render();
    return;
  }
  const current = ++generation;
  const files = Array.from(event.dataTransfer?.files || []);
  const metadata = { trusted: event.isTrusted, origin: location.origin, browser: navigator.userAgent, count: files.length, types: Array.from(event.dataTransfer?.types || []) };
  state = { status: files.length ? 'diag.hashing' : 'diag.noFile', metadata };
  render();
  if (!files.length) return;
  if (files.length !== 1) {
    state.status = 'diag.multiple';
    render();
    return;
  }
  try {
    const file = files[0];
    metadata.file = { name: file.name, mime: file.type, size: file.size, real: file instanceof File };
    render();
    if (file.size > Math.max(1, ...PACKS.map(pack => pack.maxSizeMB)) * 1024 * 1024 || !/\.zip$/i.test(file.name)) {
      metadata.hashNote = 'diag.hashSkipped';
    } else if (!globalThis.crypto?.subtle) {
      metadata.hashNote = 'diag.hashUnavailable';
    } else {
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      metadata.hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      metadata.matches = PACKS.filter(pack => pack.sha256?.toLowerCase() === metadata.hash).map(pack => `${pack.name} ${pack.version}`);
    }
    if (current !== generation) return;
    state.status = 'diag.success';
    render();
  } catch {
    if (current !== generation) return;
    state.status = 'diag.failure';
    render();
  }
});
window.addEventListener('pagehide', reset);
onLanguageChange(render);
initI18n();
render();
