import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { PACKS, CATEGORIES } from '../js/config.js';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const packs = PACKS.filter(pack => pack.category === 'ui');

test('UI-only category groups 16 archives into eight themes with both explicit font variants', () => {
  assert.equal(CATEGORIES.find(category => category.id === 'ui').folder, 't-packs');
  assert.equal(packs.length, 16);
  const families = [...new Set(packs.map(pack => pack.family))];
  assert.equal(families.length, 8);
  for (const family of families) {
    const variants = packs.filter(pack => pack.family === family);
    assert.deepEqual(variants.map(pack => pack.font), ['font-normal', 'font-pixel']);
    assert.equal(variants[0].name, variants[1].name);
    assert.equal(variants[0].version, 'V5');
    assert.equal(variants[0].color, variants[1].color);
    assert.match(variants[0].color, /^#[a-f0-9]{6}$/i);
    assert.notEqual(variants[0].sha256, variants[1].sha256);
    assert.ok(variants.every(pack => !pack.apiVersion && !pack.preview && !pack.author));
  }
});

test('all 16 uploaded CSS sources are published exactly once; no texture ZIP is miscategorized', async () => {
  const directories = (await readdir(new URL('t-packs/', root), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  assert.equal(directories.length, 16);
  assert.deepEqual(packs.map(pack => pack.source.split('/')[2]).sort(), directories);
  const archives = (await readdir(new URL('t-packs/', root))).filter(name => name.endsWith('.zip')).sort();
  assert.deepEqual(packs.map(pack => pack.filename).sort(), archives);
  assert.equal(PACKS.filter(pack => pack.category === 't-packs').length, 0);
});

test('each UI ZIP contains only css/nebula.css, byte-identical to its supplied source', async () => {
  for (const pack of packs) {
    const archive = await readFile(new URL(pack.url, root));
    const source = await readFile(new URL(pack.source, root));
    assert.equal(archive.length, pack.expectedSizeBytes);
    assert.equal(createHash('sha256').update(archive).digest('hex'), pack.sha256);
    assert.equal(archive.readUInt32LE(0), 0x04034b50);
    assert.equal(archive.readUInt16LE(8), 0, 'stored archive; no runtime decompression');
    const nameLength = archive.readUInt16LE(26);
    const extraLength = archive.readUInt16LE(28);
    assert.equal(archive.toString('utf8', 30, 30 + nameLength), 'css/nebula.css');
    assert.equal(archive.readUInt32LE(18), source.length);
    assert.deepEqual(archive.subarray(30 + nameLength + extraLength, 30 + nameLength + extraLength + source.length), source);
    assert.equal(archive.readUInt16LE(archive.length - 22 + 10), 1, 'one member, no extra assets');
    assert.match(source.toString(), /NEBULA UI V5/);
    if (pack.font === 'font-pixel') assert.match(source.toString(), /fonts\.gstatic\.com/);
    else assert.doesNotMatch(source.toString(), /Pixelify Sans/);
  }
});

test('UI packaging and published catalogue are reproducible from sources', () => {
  const output = execFileSync('python3', ['tools/build-ui-packs.py', '--check'], { cwd: root, encoding: 'utf8' });
  assert.match(output, /Verified 16 archives/);
});
