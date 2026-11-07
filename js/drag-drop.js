/** A capability probe is not a cross-tab or Bloxd compatibility test. */
export function getDragSupport() {
  if (typeof File !== 'function' || typeof DataTransfer !== 'function' || !('draggable' in document.createElement('div'))) {
    return { supported: false, reason: 'File drag & drop is unavailable in this browser. Try a current desktop Chrome or Edge, or explicitly download the prepared file.' };
  }
  try {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['probe'], 'probe.txt', { type: 'text/plain' }));
    if (transfer.files.length !== 1) throw new Error('File item rejected');
    return { supported: true, reason: 'File items are supported locally. Cross-tab transfer and Bloxd.io acceptance remain unverified.' };
  } catch {
    return { supported: false, reason: 'This browser blocks adding in-memory File objects to drag data. Use the explicit download fallback.' };
  }
}

/** Only a genuine user drag initiates transfer. No synthetic drag events,
 * URL strings, DownloadURL trick, remote-page injection or invented Bloxd API.
 */
export function attachFileDrag(element, { getFile, onStart, onEnd, onError }) {
  const start = event => {
    const file = getFile();
    if (!event.isTrusted || !file || !event.dataTransfer) {
      event.preventDefault();
      return;
    }
    try {
      event.dataTransfer.clearData();
      event.dataTransfer.items.add(file);
      event.dataTransfer.effectAllowed = 'copy';
      if (event.dataTransfer.items.length !== 1 || event.dataTransfer.items[0].kind !== 'file') {
        throw new Error('The drag data store did not accept the File.');
      }
      element.classList.add('is-dragging');
      onStart?.(file);
    } catch {
      event.preventDefault();
      element.classList.remove('is-dragging');
      onError?.('The browser refused to attach the File to this drag. Nothing was imported. Try the diagnostic page or explicitly download the file.');
    }
  };
  const end = () => {
    element.classList.remove('is-dragging');
    // dropEffect is not proof that a cross-origin app accepted or applied the ZIP.
    onEnd?.();
  };
  element.addEventListener('dragstart', start);
  element.addEventListener('dragend', end);
  return () => {
    element.removeEventListener('dragstart', start);
    element.removeEventListener('dragend', end);
  };
}
