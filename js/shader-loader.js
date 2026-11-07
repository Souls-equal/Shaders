/** Fetch → bounded stream → ZIP checks → Blob → real File. No extraction or disk writes. */
export class ShaderError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'ShaderError';
    this.code = code;
  }
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Size unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function validateConfig(config, baseURL) {
  if (!config || !/^[^/\\\x00-\x1f]+\.zip$/i.test(config.filename || '')) {
    throw new ShaderError('EXTENSION', 'The configured filename must be a plain .zip filename.');
  }
  let url;
  try { url = new URL(config.url, baseURL); }
  catch { throw new ShaderError('SOURCE', 'The configured file URL is invalid.'); }
  const base = new URL(baseURL);
  const localHTTP = url.protocol === 'http:' && url.origin === base.origin;
  if ((url.protocol !== 'https:' && !localHTTP) || url.username || url.password || url.hash) {
    throw new ShaderError('SOURCE', 'Use a trusted HTTPS file URL (or same-origin HTTP for local development).');
  }
  const allowed = new Set([base.origin, ...(config.allowedOrigins || [])]);
  if (!allowed.has(url.origin)) {
    throw new ShaderError('SOURCE', 'This file host is not approved. Add its exact HTTPS origin to allowedOrigins in config.js.');
  }
  if (!/\.zip$/i.test(url.pathname)) {
    throw new ShaderError('EXTENSION', 'The source URL must point to a .zip file.');
  }
  const maxBytes = Math.floor(config.maxSizeMB * 1024 * 1024);
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 22 || maxBytes > 512 * 1024 * 1024) {
    throw new ShaderError('CONFIG', 'Configure a file limit between 22 bytes and 512 MB.');
  }
  if (config.expectedSizeBytes != null && (!Number.isSafeInteger(config.expectedSizeBytes) || config.expectedSizeBytes < 22 || config.expectedSizeBytes > maxBytes)) {
    throw new ShaderError('CONFIG', 'The configured expected size must fit within the file limit.');
  }
  if (config.sha256 && !/^[a-f\d]{64}$/i.test(config.sha256)) {
    throw new ShaderError('CONFIG', 'The configured SHA-256 must contain 64 hexadecimal characters.');
  }
  return { url, maxBytes };
}

/** Structural checks only. Never decompress or evaluate any archive content.
 * Not a full ZIP validator, antivirus scan, or Bloxd shader API validator.
 * Reject multipart/ZIP64/encrypted archives, unsafe paths and unsupported compression.
 */
export function validateZip(bytes) {
  const invalid = (message = 'This is not a supported ZIP archive. The extension alone is not enough.') => {
    throw new ShaderError('FORMAT', message);
  };
  if (bytes.length < 22) invalid();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x04034b50) invalid();
  let end = -1;
  // EOCD may be followed by a ZIP comment of up to 65,535 bytes.
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) {
      end = i;
      break;
    }
  }
  if (end < 0) invalid('The ZIP is incomplete or has no valid central directory.');
  const entries = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  const directoryOffset = view.getUint32(end + 16, true);
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || view.getUint16(end + 8, true) !== entries) invalid('Multipart ZIP archives are not supported.');
  if (!entries || entries === 65535 || directoryOffset === 0xffffffff || directorySize === 0xffffffff) invalid('Empty and ZIP64 archives are not supported.');
  if (entries > 1024 || directoryOffset + directorySize !== end) invalid('The ZIP directory is invalid or exceeds the 1,024-entry limit.');
  let offset = directoryOffset;
  const decoder = new TextDecoder();
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) invalid();
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const disk = view.getUint16(offset + 34, true);
    const localOffset = view.getUint32(offset + 42, true);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (!nameLength || next > end || disk || (flags & 0x41) || ![0, 8].includes(method)) invalid('Encrypted, multipart or unsupported ZIP entries were found.');
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) invalid('ZIP64 entries are not supported.');
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (name.includes('\0') || name.includes('\\') || name.startsWith('/') || /^[a-z]:/i.test(name) || name.split('/').includes('..')) invalid('The ZIP contains an unsafe entry path.');
    if (localOffset + 30 > directoryOffset || view.getUint32(localOffset, true) !== 0x04034b50) invalid();
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataEnd = localOffset + 30 + localNameLength + localExtraLength + compressedSize;
    if (dataEnd > directoryOffset || localNameLength !== nameLength || view.getUint16(localOffset + 6, true) !== flags || view.getUint16(localOffset + 8, true) !== method) invalid();
    for (let n = 0; n < nameLength; n++) {
      if (bytes[localOffset + 30 + n] !== bytes[offset + 46 + n]) invalid();
    }
    offset = next;
  }
  if (offset !== end) invalid();
  return { entries };
}

export async function loadShader(config, {
  signal,
  onProgress = () => {},
  baseURL = globalThis.document?.baseURI || 'https://localhost/',
  fetchImpl = globalThis.fetch,
} = {}) {
  const { url, maxBytes } = validateConfig(config, baseURL);
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, config.timeoutMs || 45000);
  let reader;
  try {
    const response = await fetchImpl(url.href, {
      signal: controller.signal,
      mode: 'cors',
      credentials: 'omit',
      redirect: 'error', // Do not silently follow an approved URL to an unapproved host.
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (!response.ok) {
      throw new ShaderError('HTTP', response.status === 404 ? 'Shader not found (HTTP 404). Check its configured URL.' : `The file server returned HTTP ${response.status}. Please try again later.`);
    }
    if (response.type === 'opaque' || response.redirected || (response.url && response.url !== url.href)) {
      throw new ShaderError('SOURCE', 'The file source could not be verified. Opaque responses and redirects are refused.');
    }
    const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (mime && !['application/zip', 'application/x-zip-compressed', 'application/x-zip', 'application/octet-stream', 'binary/octet-stream'].includes(mime)) {
      throw new ShaderError('MIME', `Unexpected file type (${mime}). A ZIP archive was expected.`);
    }
    const rawLength = response.headers.get('content-length');
    const declaredSize = rawLength && /^\d+$/.test(rawLength) ? Number(rawLength) : null;
    const encoded = response.headers.get('content-encoding');
    // Content-Length may describe a compressed HTTP representation, not the ZIP bytes.
    if (!encoded && declaredSize > maxBytes) throw new ShaderError('SIZE', `The file exceeds the ${config.maxSizeMB} MB limit.`);
    const total = !encoded ? declaredSize : null;
    onProgress({ received: 0, total, percent: total ? 0 : null, phase: 'fetching' });
    if (!response.body?.getReader) {
      throw new ShaderError('UNSUPPORTED', 'Streaming Fetch is unavailable. Use a current desktop Chrome or Edge; the size limit cannot be safely enforced here.');
    }
    reader = response.body.getReader();
    let received = 0;
    const chunks = [];
    while (true) {
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const { done, value } = await reader.read();
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) throw new ShaderError('SIZE', `The file exceeds the ${config.maxSizeMB} MB limit. Loading was stopped.`);
      chunks.push(value);
      onProgress({ received, total, percent: total ? Math.min(99, Math.round(received / total * 100)) : null, phase: 'fetching' });
    }
    if (config.expectedSizeBytes != null && received !== config.expectedSizeBytes) {
      throw new ShaderError('INTEGRITY', 'The file size differs from the published pack. It may have changed or been truncated; update the configuration only after reviewing it.');
    }
    onProgress({ received, total: received, percent: 99, phase: 'checking' });
    const blob = new Blob(chunks, { type: 'application/zip' });
    chunks.length = 0;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    validateZip(bytes);
    if (config.sha256) {
      if (!globalThis.crypto?.subtle) throw new ShaderError('INTEGRITY', 'Integrity verification needs HTTPS (or localhost). No file was prepared.');
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      if (actual !== config.sha256.toLowerCase()) throw new ShaderError('INTEGRITY', 'The ZIP does not match its published SHA-256. It was not prepared.');
    }
    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const file = new File([blob], config.filename, { type: 'application/zip', lastModified: 0 });
    onProgress({ received, total: received, percent: 100, phase: 'ready' });
    return file;
  } catch (error) {
    if (timedOut) throw new ShaderError('TIMEOUT', 'The file server took too long to respond. Loading was cancelled; try again.');
    if (controller.signal.aborted || error.name === 'AbortError') throw new DOMException('Loading cancelled', 'AbortError');
    if (error instanceof ShaderError) throw error;
    if (error instanceof RangeError || error.name === 'QuotaExceededError') {
      throw new ShaderError('MEMORY', 'The browser could not allocate enough memory. Close other tabs or use a smaller ZIP.', { cause: error });
    }
    throw new ShaderError('NETWORK', 'The file could not be fetched. Check your connection, HTTPS, and the host’s CORS policy. Browsers do not distinguish CORS, blocked redirects, and network failures here.', { cause: error });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
    if (reader) {
      try { await reader.cancel(); } catch { /* A failed or aborted stream may already be closed. */ }
      reader.releaseLock();
    }
    controller.abort();
  }
}
