import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { CATEGORIES, PACKS } from '../js/config.js';
import { loadShader } from '../js/shader-loader.js';

const root = new URL('../', import.meta.url);
test('four categories use the three asset folders; no loose ZIPs', async () => {
  assert.deepEqual(CATEGORIES.map(category => category.id), ['shaders', 'schems', 'ui', 't-packs']);
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

test('every published shader ZIP appears in the catalogue', async () => {
  const files = (await readdir(new URL('shaders/', root))).filter(name => name.endsWith('.zip')).sort();
  assert.deepEqual(PACKS.filter(pack => pack.category === 'shaders').map(pack => pack.filename).sort(), files);
});

test('the three new packs keep manifest names, versions, authors and API metadata', () => {
  for (const [id, name] of [['emberfall-v5', 'Emberfall'], ['frostbound-v5', 'Frostbound'], ['sunrise-v5', 'Golden Hour']]) {
    const pack = PACKS.find(pack => pack.id === id);
    assert.ok(pack);
    assert.equal(pack.name, name);
    assert.equal(pack.version, '1.0.1');
    assert.equal(pack.apiVersion, 5);
    assert.equal(pack.author, 'Arena Agent');
    assert.ok(!pack.archived);
  }
});

test('each current shader has a distinct local WebP illustration with accessible metadata', async () => {
  const current = PACKS.filter(pack => pack.category === 'shaders' && !pack.archived);
  assert.equal(current.length, 4);
  assert.equal(new Set(current.map(pack => pack.preview?.src)).size, current.length);
  for (const pack of current) {
    assert.equal(pack.preview.type, 'illustration');
    assert.ok(pack.preview.alt.length > 20);
    assert.ok(pack.preview.tagline);
    assert.ok(pack.preview.theme);
    assert.ok(Number.isInteger(pack.preview.width) && pack.preview.width > 0);
    assert.ok(Number.isInteger(pack.preview.height) && pack.preview.height > 0);
    assert.match(pack.preview.src, /^assets\/[a-z-]+\.webp$/);
    const bytes = await readFile(new URL(pack.preview.src, root));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert.ok(bytes.length < 500000);
  }
});
