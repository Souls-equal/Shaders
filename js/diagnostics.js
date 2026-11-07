import { PACKS } from './config.js';
import { formatBytes } from './shader-loader.js';

const receiver = document.getElementById('receiver');
const status = document.getElementById('receiver-status');
const results = document.getElementById('receiver-results');
const clear = document.getElementById('clear-results');
let generation = 0;
function reset() {
  generation++;
  results.textContent = '';
  results.hidden = true;
  clear.disabled = true;
  status.textContent = 'Results cleared. Waiting for a real user drop.';
}
clear.addEventListener('click', reset);
// Prevent accidental navigation if a file is released outside the test box.
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
    status.textContent = 'Synthetic drop ignored. This receiver requires a genuine user interaction.';
    return;
  }
  const current = ++generation;
  const files = Array.from(event.dataTransfer?.files || []);
  const lines = [`Trusted drop: ${event.isTrusted}`, `Receiver origin: ${location.origin}`, `Browser: ${navigator.userAgent}`, `File count: ${files.length}`, `Data types: ${Array.from(event.dataTransfer?.types || []).join(', ') || '(none)'}`];
  clear.disabled = false;
  results.hidden = false;
  results.textContent = lines.join('\n');
  if (!files.length) {
    status.textContent = 'No File reached this receiver. The browser may have stripped file data, or the drag carried something else. No game import has been established.';
    return;
  }
  status.textContent = 'File received locally. Computing metadata; no upload or disk write.';
  try {
    // Bound memory and work even if the user drops a large group of arbitrary files.
    if (files.length !== 1) throw new Error('Please drop exactly one shader ZIP at a time.');
    const file = files[0];
    lines.push('', `Name: ${file.name}`, `MIME: ${file.type || '(not supplied)'}`, `Size: ${file.size} bytes (${formatBytes(file.size)})`, `Real File: ${file instanceof File}`);
    if (file.size > Math.max(1, ...PACKS.map(pack => pack.maxSizeMB)) * 1024 * 1024 || !/\.zip$/i.test(file.name)) {
      lines.push('Hash skipped: only ZIP files within the configured size limit are read.');
    } else if (!crypto.subtle) {
      lines.push('Hash unavailable: use HTTPS or localhost.');
    } else {
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      lines.push(`SHA-256: ${hash}`);
      const matches = PACKS.filter(pack => pack.sha256?.toLowerCase() === hash);
      lines.push(`Matching published packs: ${matches.map(pack => `${pack.name} ${pack.version}`).join(', ') || '(none)'}`);
    }
    if (current !== generation) return;
    results.textContent = lines.join('\n');
    status.textContent = 'A real File reached this receiver. This result applies only to this transfer, not to Edge on another system or to Bloxd.io.';
  } catch (error) {
    if (current !== generation) return;
    results.textContent = lines.join('\n');
    status.textContent = `Could not finish the diagnostic: ${error.message}`;
  }
});
window.addEventListener('pagehide', reset);
