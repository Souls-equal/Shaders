import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SHADER_CONFIG } from '../js/config.js';
import { loadShader, validateConfig, validateZip, formatBytes } from '../js/shader-loader.js';

const zip = new Uint8Array(await readFile(new URL('../aurora.zip', import.meta.url)));
const baseURL = 'https://share.example/project/';
const config = { ...SHADER_CONFIG, url: './aurora.zip' };
const response = (bytes = zip, headers = {}) => new Response(bytes, { headers: { 'content-type': 'application/zip', ...headers } });
const load = (configPatch = {}, options = {}) => loadShader({ ...config, ...configPatch }, { baseURL, fetchImpl: async () => response(), ...options });
const rejectsCode = (promise, code) => assert.rejects(promise, error => error.code === code);

// Real checked-in archives, not invented ZIP header strings.
test('original Aurora ZIPs pass non-extracting structural checks', async () => {
  assert.deepEqual(validateZip(zip), { entries: 8 });
  assert.deepEqual(validateZip(new Uint8Array(await readFile(new URL('../aurora - V9.zip', import.meta.url)))), { entries: 8 });
});
test('normal load returns actual File with exact original bytes and progress', async () => {
  const progress = [];
  let request;
  const file = await load({}, { onProgress: p => progress.push(p), fetchImpl: async (url, options) => {
    request = { url, options };
    return response(zip, { 'content-length': String(zip.length) });
  } });
  assert.ok(file instanceof File);
  assert.equal(file.name, 'aurora.zip');
  assert.equal(file.type, 'application/zip');
  assert.equal(file.size, 16789);
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()), zip);
  assert.equal(request.url, 'https://share.example/project/aurora.zip');
  assert.equal(request.options.redirect, 'error');
  assert.equal(request.options.credentials, 'omit');
  assert.equal(request.options.mode, 'cors');
  assert.equal(progress[0].percent, 0);
  assert.equal(progress.at(-1).percent, 100);
  assert.ok(progress.some(p => p.phase === 'checking'));
});
test('formatBytes handles zero, units and unknown values', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(16789), '16.4 KB');
  assert.equal(formatBytes(1048576), '1.0 MB');
  assert.equal(formatBytes(NaN), 'Size unknown');
});
test('file name and source URL must have .zip extension', () => {
  assert.throws(() => validateConfig({ ...config, filename: '../pack.zip' }, baseURL), { code: 'EXTENSION' });
  assert.throws(() => validateConfig({ ...config, filename: 'script.js' }, baseURL), { code: 'EXTENSION' });
  assert.throws(() => validateConfig({ ...config, url: './file.html' }, baseURL), { code: 'EXTENSION' });
});
test('rejects unapproved origins, protocols, URL credentials and fragments', () => {
  for (const url of ['https://evil.example/shader.zip', 'data:application/zip,zip', 'javascript:alert(1)', 'http://cdn.example/a.zip', 'https://u:p@share.example/a.zip', './aurora.zip#fragment']) {
    assert.throws(() => validateConfig({ ...config, url }, baseURL), { code: 'SOURCE' });
  }
  assert.equal(validateConfig({ ...config, url: 'https://cdn.example/a.zip', allowedOrigins: ['https://cdn.example'] }, baseURL).url.origin, 'https://cdn.example');
  assert.equal(validateConfig(config, 'http://localhost:3000/').url.protocol, 'http:');
});
test('configuration rejects invalid limits, expected sizes and hashes', () => {
  for (const maxSizeMB of [0, -1, Infinity, 513, NaN]) assert.throws(() => validateConfig({ ...config, maxSizeMB }, baseURL), { code: 'CONFIG' });
  for (const expectedSizeBytes of [-1, 0, 1.5, 1000000000]) assert.throws(() => validateConfig({ ...config, expectedSizeBytes }, baseURL), { code: 'CONFIG' });
  assert.throws(() => validateConfig({ ...config, sha256: 'not a hash' }, baseURL), { code: 'CONFIG' });
});
test('HTTP 404 and other errors have explicit status messages', async () => {
  await assert.rejects(load({}, { fetchImpl: async () => new Response('', { status: 404 }) }), { code: 'HTTP', message: /404/ });
  await assert.rejects(load({}, { fetchImpl: async () => new Response('', { status: 503 }) }), { code: 'HTTP', message: /503/ });
});
test('network and CORS errors are not falsely distinguished', async () => {
  await assert.rejects(load({}, { fetchImpl: async () => { throw new TypeError('Failed to fetch'); } }), { code: 'NETWORK', message: /CORS.*do not distinguish/ });
});
test('rejects HTML, text and misleading MIME responses', async () => {
  for (const type of ['text/html', 'text/plain', 'application/javascript']) {
    await rejectsCode(load({}, { fetchImpl: async () => response(zip, { 'content-type': type }) }), 'MIME');
  }
});
test('generic binary MIME is accepted only with valid ZIP bytes', async () => {
  const file = await load({}, { fetchImpl: async () => response(zip, { 'content-type': 'application/octet-stream' }) });
  assert.equal(file.size, zip.length);
  await rejectsCode(load({ expectedSizeBytes: undefined, sha256: undefined }, { fetchImpl: async () => response(new TextEncoder().encode('not an archive'), { 'content-type': 'application/octet-stream' }) }), 'FORMAT');
});
test('empty and truncated data, bad directory and unsafe ZIP paths are rejected', () => {
  for (const bytes of [new Uint8Array(), zip.subarray(0, 100), new Uint8Array(30)]) assert.throws(() => validateZip(bytes), { code: 'FORMAT' });
  const badDirectory = zip.slice();
  badDirectory[badDirectory.length - 6] = 0xff;
  assert.throws(() => validateZip(badDirectory), { code: 'FORMAT' });
  const unsafe = zip.slice();
  const central = new DataView(unsafe.buffer).getUint32(unsafe.length - 6, true);
  unsafe.set(new TextEncoder().encode('../'), central + 46);
  assert.throws(() => validateZip(unsafe), { code: 'FORMAT' });
});
test('oversized Content-Length rejects before reading body', async () => {
  await rejectsCode(load({ maxSizeMB: 0.02 }, { fetchImpl: async () => response(zip, { 'content-length': '9999999' }) }), 'SIZE');
});
test('actual streamed size is bounded even without Content-Length', async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(10000)); controller.enqueue(new Uint8Array(12000)); },
    cancel() { cancelled = true; },
  });
  await rejectsCode(load({ maxSizeMB: 0.02 }, { fetchImpl: async () => new Response(body) }), 'SIZE');
  assert.equal(cancelled, true);
});
test('misleading small Content-Length does not bypass streamed byte cap', async () => {
  await rejectsCode(load({ maxSizeMB: 0.02 }, { fetchImpl: async () => response(new Uint8Array(25000), { 'content-length': '10' }) }), 'SIZE');
});
test('unknown length has indeterminate progress but ends at 100%', async () => {
  const progress = [];
  await load({}, { onProgress: p => progress.push(p) });
  assert.equal(progress[0].percent, null);
  assert.equal(progress.at(-1).percent, 100);
});
test('HTTP compression length is not confused with decoded ZIP size', async () => {
  const progress = [];
  await load({}, { fetchImpl: async () => response(zip, { 'content-length': '999999999', 'content-encoding': 'gzip' }), onProgress: p => progress.push(p) });
  assert.equal(progress[0].total, null);
});
test('integrity pin and published byte count are enforced', async () => {
  await rejectsCode(load({ sha256: '0'.repeat(64) }), 'INTEGRITY');
  await rejectsCode(load({ expectedSizeBytes: 100 }), 'INTEGRITY');
});
test('already aborted request produces AbortError and never a File', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(load({}, { signal: controller.signal }), { name: 'AbortError' });
});
test('cancellation during a stream releases its reader', async () => {
  const controller = new AbortController();
  const body = new ReadableStream({ start(stream) { stream.enqueue(zip.subarray(0, 30)); } });
  const promise = load({}, { signal: controller.signal, fetchImpl: async () => new Response(body), onProgress: p => { if (p.received) controller.abort(); } });
  await assert.rejects(promise, { name: 'AbortError' });
  assert.equal(body.locked, false);
});
test('timeout returns a helpful error rather than generic cancellation', async () => {
  await rejectsCode(load({ timeoutMs: 5 }, { fetchImpl: (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))) }), 'TIMEOUT');
});
test('allocation errors are reported as insufficient memory', async () => {
  await rejectsCode(load({}, { fetchImpl: async () => { throw new RangeError('allocation failed'); } }), 'MEMORY');
});
test('rejects redirects, changed response sources and opaque responses', async () => {
  for (const props of [{ redirected: true }, { type: 'opaque' }, { url: 'https://evil.example/a.zip' }]) {
    await rejectsCode(load({}, { fetchImpl: async () => {
      const res = response();
      for (const [key, value] of Object.entries(props)) Object.defineProperty(res, key, { value });
      return res;
    } }), 'SOURCE');
  }
});
test('rejects lack of streaming rather than allocating an unbounded Blob', async () => {
  await rejectsCode(load({}, { fetchImpl: async () => ({ ok: true, headers: new Headers(), body: null }) }), 'UNSUPPORTED');
});
test('malformed archives never escape as DataView RangeErrors', () => {
  // Deterministically corrupt directory locations and record lengths.
  for (let i = 0; i < 120; i++) {
    const bytes = zip.slice();
    const view = new DataView(bytes.buffer);
    const directory = view.getUint32(bytes.length - 6, true);
    const positions = [directory + 28, directory + 30, directory + 32, directory + 42, bytes.length - 6];
    const position = positions[i % positions.length];
    view.setUint16(position, (i * 7919) % 65536, true);
    try { validateZip(bytes); } catch (error) { assert.equal(error.code, 'FORMAT'); }
  }
});
