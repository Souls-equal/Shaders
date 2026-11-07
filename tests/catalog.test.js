import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { CATEGORIES, PACKS } from '../js/config.js';
import { loadShader } from '../js/shader-loader.js';

const root = new URL('../', import.meta.url);
test('root separates shaders, schematics and texture packs; no loose ZIPs', async () => {
  assert.deepEqual(CATEGORIES.map(category => category.id), ['shaders', 'schems', 't-packs']);
  for (const category of CATEGORIES) assert.ok((await stat(new URL(category.folder, root))).isDirectory());
  assert.equal((await readdir(root)).some(name => /\.zip$/i.test(name)), false);
});
test('catalogue has unique IDs, known categories and contained file paths', () => {
  assert.equal(new Set(PACKS.map(pack => pack.id)).size, PACKS.length);
  for (const pack of PACKS) {
    const category = CATEGORIES.find(category => category.id === pack.category);
    assert.ok(category);
    assert.equal(pack.url, `./${category.folder}/${pack.filename}`);
    assert.ok(Object.isFrozen(pack));
  }
  assert.equal(PACKS[0].id, 'aurora-v12');
  assert.equal(PACKS.filter(pack => pack.featured).length, 1);
});
for (const pack of PACKS) {
  test(`${pack.name} ${pack.version}: published size/hash/ZIP and File match the actual relocated archive`, async () => {
    const bytes = await readFile(new URL(pack.url, root));
    const file = await loadShader(pack, {
      baseURL: 'https://example.org/Shaders/',
      fetchImpl: async url => {
        assert.equal(url, new URL(pack.url, 'https://example.org/Shaders/').href);
        return new Response(bytes, { headers: { 'content-type': 'application/zip', 'content-length': String(bytes.length) } });
      },
    });
    assert.ok(file instanceof File);
    assert.equal(file.name, pack.filename);
    assert.equal(file.size, pack.expectedSizeBytes);
    assert.deepEqual(new Uint8Array(await file.arrayBuffer()), new Uint8Array(bytes));
  });
}
