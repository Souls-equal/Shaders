import { SHADER_CONFIG } from './config.js';
import { formatBytes, loadShader } from './shader-loader.js';
import { attachFileDrag, getDragSupport } from './drag-drop.js';

const $ = id => document.getElementById(id);
let preparedFile = null;
let activeController = null;
let downloadURL = null;
let downloadTimer = null;
let generation = 0;
const dragSupport = getDragSupport();

$('pack-name').textContent = SHADER_CONFIG.name;
$('art-pack-name').firstChild.textContent = String(SHADER_CONFIG.name).toUpperCase();
$('pack-author').textContent = SHADER_CONFIG.author;
$('pack-description').textContent = SHADER_CONFIG.description;
$('pack-size').textContent = SHADER_CONFIG.expectedSizeBytes ? `${formatBytes(SHADER_CONFIG.expectedSizeBytes)} · ${SHADER_CONFIG.expectedSizeBytes.toLocaleString('en-US')} bytes` : 'Size shown after preparation';

function message(text, tone = 'info') {
  const node = $('app-message');
  node.textContent = text;
  node.dataset.tone = tone;
  node.hidden = !text;
}

function revokeDownload() {
  clearTimeout(downloadTimer);
  downloadTimer = null;
  if (downloadURL) URL.revokeObjectURL(downloadURL);
  downloadURL = null;
}

function render(state) {
  const ready = state === 'ready';
  const loading = state === 'loading';
  $('prepare-button').disabled = loading || ready;
  $('prepare-label').textContent = ready ? 'Shader prepared' : loading ? 'Preparing shader…' : 'Prepare Shader';
  $('prepare-icon').classList.toggle('spin', loading);
  $('prepare-icon').querySelector('use').setAttribute('href', ready ? '#i-check' : '#i-spark');
  $('prepare-check').hidden = !ready;
  $('clear-button').disabled = !ready && !loading;
  $('clear-button').querySelector('span').textContent = loading ? 'Cancel loading' : 'Clear File';
  $('progress-section').hidden = !loading;
  $('drag-zone').draggable = ready && dragSupport.supported;
  $('drag-zone').setAttribute('aria-disabled', String(!ready || !dragSupport.supported));
  $('drag-zone').classList.remove('is-dragging');
  $('memory-state').textContent = ready ? 'In memory' : loading ? 'Loading…' : 'Not prepared';
  $('memory-label').textContent = ready ? `${formatBytes(preparedFile.size)} in memory` : loading ? 'Fetching file…' : 'Waiting for a file';
  $('memory-dot').classList.toggle('is-ready', ready);
  $('drag-title').textContent = ready ? (dragSupport.supported ? 'Drag this file into Bloxd.io' : 'File ready · drag unavailable') : 'Your shader will appear here';
  $('drag-subtitle').textContent = ready ? `${preparedFile.name} · ${formatBytes(preparedFile.size)}` : loading ? 'Checking and preparing your file…' : 'Prepare the pack to unlock drag & drop';
  $('fallback-row').hidden = !ready;
}

function clearFile({ announce = true } = {}) {
  generation++;
  const wasLoading = !!activeController;
  activeController?.abort();
  activeController = null;
  preparedFile = null;
  revokeDownload();
  render('idle');
  if (announce) message(wasLoading ? 'Loading cancelled. No file was saved.' : 'File cleared. In-memory references and download URLs have been released.');
}

$('prepare-button').addEventListener('click', async () => {
  if (activeController || preparedFile) return;
  message('');
  const controller = new AbortController();
  activeController = controller;
  const currentGeneration = ++generation;
  $('load-progress').value = 0;
  $('progress-value').textContent = '0%';
  $('progress-label').textContent = 'Fetching pack…';
  render('loading');
  try {
    const file = await loadShader(SHADER_CONFIG, {
      signal: controller.signal,
      onProgress: ({ received, total, percent, phase }) => {
        if (generation !== currentGeneration) return;
        if (percent === null) $('load-progress').removeAttribute('value');
        else $('load-progress').value = percent;
        $('progress-value').textContent = percent === null ? formatBytes(received) : `${percent}%`;
        $('progress-label').textContent = phase === 'checking' ? 'Checking ZIP & integrity…' : `${formatBytes(received)}${total ? ` / ${formatBytes(total)}` : ' received'}`;
      },
    });
    // A cancelled earlier request may finish after a new one. Never revive its file.
    if (generation !== currentGeneration || controller.signal.aborted) return;
    preparedFile = file;
    activeController = null;
    $('pack-size').textContent = `${formatBytes(file.size)} · ${file.size.toLocaleString('en-US')} bytes`;
    render('ready');
    message(dragSupport.supported ? 'Ready in memory. ZIP structure and published integrity checked; this is not a safety scan or proof of Bloxd.io compatibility.' : dragSupport.reason, dragSupport.supported ? 'info' : 'error');
  } catch (error) {
    if (generation !== currentGeneration) return;
    activeController = null;
    preparedFile = null;
    render('idle');
    message(error.name === 'AbortError' ? 'Loading cancelled. No file was saved.' : error.message, error.name === 'AbortError' ? 'info' : 'error');
  }
});

$('clear-button').addEventListener('click', () => clearFile());
attachFileDrag($('drag-zone'), {
  getFile: () => preparedFile,
  onStart: () => message('A real File was attached to this user drag. Drop into the target import area; this page cannot observe Bloxd.io’s response.'),
  onEnd: () => { if (preparedFile) message('Drag ended. Import status is unknown: check Bloxd.io for acceptance or an error. You can try again; the file is still in memory.'); },
  onError: text => message(text, 'error'),
});
$('drag-zone').addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (preparedFile) openCompatibility();
    else $('prepare-button').focus();
  }
});

// This is the ONLY disk-download path, explicitly initiated by the user's button.
$('download-button').addEventListener('click', () => {
  if (!preparedFile) return;
  revokeDownload();
  downloadURL = URL.createObjectURL(preparedFile);
  const link = document.createElement('a');
  link.href = downloadURL;
  link.download = preparedFile.name;
  document.body.append(link);
  link.click();
  link.remove();
  downloadTimer = setTimeout(revokeDownload, 60000);
  message('You explicitly requested a download. Choose that ZIP using Bloxd.io’s own file picker if supported. This fallback saves a file to disk and does not verify game import.');
});

const dialog = $('info-dialog');
function openDialog(content) {
  $('dialog-content').replaceChildren(content);
  if (!dialog.open) dialog.showModal();
}
function textElement(tag, text) {
  const el = document.createElement(tag);
  el.textContent = text;
  return el;
}
function openCompatibility() {
  // Static, first-party markup only. Configuration and filenames are rendered as text.
  const content = document.createElement('div');
  content.innerHTML = `<h2 id="dialog-title">A real file. An honest experiment.</h2>
    <p>Preparation uses a real <strong>File</strong> in browser memory. A genuine pointer drag attaches it with <code>DataTransfer.items.add(file)</code>. No synthetic events or automatic downloads are used.</p>
    <h3>What is — and isn’t — verified</h3>
    <p><strong>Cross-tab Edge transfer and real Bloxd.io import are not verified.</strong> A local feature check cannot prove either. Browsers may strip programmatically created file items across tabs, windows or origins; the game may also reject the ZIP.</p>
    <p><strong>Observed limitation:</strong> in our automated Chromium 141 test, <code>dragstart</code> held the real ZIP, but a same-document and same-origin frame drop exposed zero files. A cross-origin frame received no drop. These headless tests are not a two-tab Edge test and do not prove behavior in your browser.</p>
    <h3>Try it yourself</h3>
    <ol><li>Prepare the shader in a current desktop Edge or Chrome.</li><li>Open the diagnostic receiver in a second tab. Drag the file over its tab, wait for it to open, then drop into its test area. Two side-by-side windows can be easier.</li><li>If the receiver sees the full ZIP, repeat with Bloxd.io’s actual shader import area, if available. Check the game’s response directly.</li></ol>
    <p>A receiver with no file indicates a browser/transfer limitation. A receiver with the correct file but a game rejection points to the target or pack compatibility. We cannot read a cross-origin game’s internal status.</p>
    <p>If blocked, use <strong>Download instead</strong>, then the game’s native file picker. This explicit fallback requires saving to disk; no universal no-download workaround is claimed.</p>
    <div class="dialog-actions"><a href="diagnostics.html" target="_blank" rel="noopener noreferrer">Open test receiver ↗</a><a href="https://bloxd.io" target="_blank" rel="noopener noreferrer">Open Bloxd.io ↗</a></div>`;
  content.append(textElement('p', `Local browser check: ${dragSupport.reason}`));
  openDialog(content);
}
$('compatibility-button').addEventListener('click', openCompatibility);
$('details-button').addEventListener('click', () => {
  const content = document.createElement('div');
  const title = textElement('h2', `${SHADER_CONFIG.name} · Pack details`);
  title.id = 'dialog-title';
  content.append(title, textElement('p', 'The original ZIP is served unchanged from this repository. The landscape is illustrative artwork, not a verified capture of this shader in Bloxd.io.'));
  const list = document.createElement('dl');
  const rows = [
    ['Author', SHADER_CONFIG.author], ['File', SHADER_CONFIG.filename],
    ['Size', preparedFile ? `${preparedFile.size.toLocaleString('en-US')} bytes (fetched)` : SHADER_CONFIG.expectedSizeBytes ? `${SHADER_CONFIG.expectedSizeBytes.toLocaleString('en-US')} bytes (published)` : 'Unknown until fetched'],
    ['Source', new URL(SHADER_CONFIG.url, document.baseURI).href],
    ['Memory limit', `${SHADER_CONFIG.maxSizeMB} MB`], ['SHA-256', SHADER_CONFIG.sha256 || 'No integrity pin configured'],
    ['Import status', 'Not verified in Edge or Bloxd.io'],
  ];
  for (const [key, value] of rows) list.append(textElement('dt', key), textElement('dd', value));
  content.append(list, textElement('p', 'ZIP signature, directory structure, MIME type, origin, actual byte size and optional SHA-256 are checked. Contents are not extracted or executed by this site. These checks do not establish that an archive is harmless or compatible with Bloxd.io.'));
  openDialog(content);
});
$('close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});
window.addEventListener('pagehide', () => clearFile({ announce: false }));
render('idle');
if (!dragSupport.supported) message(dragSupport.reason, 'error');
