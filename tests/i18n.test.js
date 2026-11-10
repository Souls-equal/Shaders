import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { messages } from '../js/translations.js';
import { PACKS, CATEGORIES } from '../js/config.js';
import { getLanguage, setLanguage, t, formatSize, packText, LANGUAGE_KEY } from '../js/i18n.js';

const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
test('English and French have complete, nonempty messages with identical placeholders', () => {
  assert.deepEqual(Object.keys(messages.en).sort(), Object.keys(messages.fr).sort());
  for (const key of Object.keys(messages.en)) {
    assert.ok(messages.en[key].trim(), key);
    assert.ok(messages.fr[key].trim(), key);
    assert.deepEqual(placeholders(messages.en[key]), placeholders(messages.fr[key]), key);
  }
});
test('every static translation reference on both pages exists in both dictionaries', async () => {
  for (const page of ['index.html', 'diagnostics.html']) {
    const html = await readFile(new URL(`../${page}`, import.meta.url), 'utf8');
    assert.match(html, /<html lang="en">/);
    for (const [, key] of html.matchAll(/data-i18n(?:-[\w-]+)?="([^"]+)"/g)) {
      assert.ok(Object.hasOwn(messages.en, key), `${page}: ${key}`);
      assert.ok(Object.hasOwn(messages.fr, key), `${page}: ${key}`);
    }
    assert.match(html, /data-language-toggle/);
  }
});
test('every pack description, image alt, theme and tagline is translated', () => {
  for (const pack of PACKS) {
    for (const field of pack.preview ? ['description', 'alt', 'theme', 'tagline'] : ['description']) {
      const key = `pack.${pack.id}.${field}`;
      assert.ok(pack.translations?.en?.[field] || messages.en[key], key);
      assert.ok(pack.translations?.fr?.[field] || messages.fr[key], key);
      const source = field === 'description' ? pack.description : pack.preview[field];
      assert.equal(pack.translations?.fr?.[field] || messages.fr[key], source);
    }
  }
  for (const category of CATEGORIES) {
    for (const field of ['label', 'description']) assert.ok(messages.en[`category.${category.id}.${field}`]);
  }
});
test('English is the default; French selection localizes values; unsupported values fall back to English', () => {
  assert.equal(getLanguage(), 'en');
  assert.equal(t('download.idle'), 'Download ZIP');
  assert.equal(formatSize(16789), '16.4 KB');
  setLanguage('fr', { persist: false });
  assert.equal(t('download.idle'), 'Télécharger le ZIP');
  assert.equal(formatSize(16789), '16,4 Ko');
  assert.equal(t('catalog.one', { count: 1, category: 'Shaders' }), '1 pack disponible dans la catégorie Shaders.');
  assert.equal(packText(PACKS[0], 'alt'), PACKS[0].preview.alt);
  setLanguage('unsupported', { persist: false });
  assert.equal(getLanguage(), 'en');
  assert.equal(t('catalog.many', { count: 6, category: 'Shaders' }), '6 packs available in Shaders.');
  assert.equal(formatSize(NaN), 'Unknown size');
});
test('an explicit saved choice is loaded without guessing the browser language', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const writes = [];
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => key === LANGUAGE_KEY ? 'fr' : null,
    setItem: (...values) => writes.push(values),
  } });
  try {
    const instance = await import('../js/i18n.js?saved-language-test');
    assert.equal(instance.getLanguage(), 'fr');
    instance.setLanguage('en');
    assert.deepEqual(writes, [[LANGUAGE_KEY, 'en']]);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});
test('blocked storage never prevents default English or an in-memory language switch', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage blocked'); } });
  try {
    const instance = await import('../js/i18n.js?blocked-storage-test');
    assert.equal(instance.getLanguage(), 'en');
    assert.doesNotThrow(() => instance.setLanguage('fr'));
    assert.equal(instance.t('download.idle'), 'Télécharger le ZIP');
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});

test('literal translation calls and every loader error code have messages', async () => {
  for (const module of ['app', 'diagnostics', 'i18n']) {
    const source = await readFile(new URL(`../js/${module}.js`, import.meta.url), 'utf8');
    for (const [, key] of source.matchAll(/\bt\('([^']+)'/g)) assert.ok(messages.en[key] && messages.fr[key], `${module}: ${key}`);
  }
  for (const code of ['HTTP', 'NETWORK', 'SIZE', 'FORMAT', 'MIME', 'INTEGRITY', 'TIMEOUT', 'MEMORY', 'SOURCE', 'CONFIG', 'EXTENSION', 'UNSUPPORTED']) {
    assert.ok(messages.en[`error.${code}`] && messages.fr[`error.${code}`], code);
  }
});
