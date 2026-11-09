// Real-browser checks for the bilingual UI, default language and retained state.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { PACKS } from '../js/config.js';
import { messages } from '../js/translations.js';
import { LANGUAGE_KEY } from '../js/i18n.js';
const require = createRequire(process.env.PLAYWRIGHT_MODULE_PATH || import.meta.url);
const { chromium } = require('playwright');
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch({
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
  ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}),
  headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const report = { browser: browser.version(), results: [] };
const errors = [];
const context = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
const page = await context.newPage();
let archiveRequests = 0;
let downloads = 0;
page.on('request', request => { if (request.url().endsWith('.zip')) archiveRequests++; });
page.on('download', () => downloads++);
const headerToggle = page.locator('.header [data-language-toggle]');
async function language(target, lang) {
  await target.waitForFunction(expected => document.documentElement.lang === expected, lang);
}
async function check(name, run) { await run(); report.results.push({ name, passed: true }); console.log(`PASS ${name}`); }
async function staticCopy(target, lang) {
  const values = await target.locator('[data-i18n]').evaluateAll(nodes => nodes.map(node => [node.dataset.i18n, node.textContent]));
  for (const [key, value] of values) assert.equal(value, messages[lang][key], key);
}
try {
  await page.goto(base);
  await check('English is the first-visit default, even with a French browser locale', async () => {
    await language(page, 'en');
    assert.equal(await page.title(), messages.en['page.title']);
    assert.equal(await page.locator('meta[name=description]').getAttribute('content'), messages.en['page.description']);
    assert.equal(await headerToggle.getAttribute('aria-label'), 'Switch to French');
    await staticCopy(page, 'en');
    for (const pack of PACKS) {
      const card = page.locator(`[data-pack-id="${pack.id}"]`);
      assert.equal(await card.locator('.pack-description').textContent(), messages.en[`pack.${pack.id}.description`]);
      if (pack.preview) assert.equal(await card.locator('img').getAttribute('alt'), messages.en[`pack.${pack.id}.alt`]);
    }
    assert.equal(archiveRequests, 0);
    assert.equal(downloads, 0);
  });
  await check('switching translates static copy, accessibility labels, metadata and the active empty category', async () => {
    await page.locator('#tab-t-packs').click();
    await headerToggle.click(); await language(page, 'fr');
    assert.equal(await page.locator('#tab-t-packs').getAttribute('aria-selected'), 'true');
    assert.match(await page.locator('.empty-state').textContent(), /Aucun pack de textures/);
    assert.equal(await headerToggle.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.title(), messages.fr['page.title']);
    assert.equal(await page.locator('#category-tabs').getAttribute('aria-label'), 'Type de pack');
    await staticCopy(page, 'fr');
  });
  await check('choice persists through reload and opens diagnostics in the same language', async () => {
    await page.reload(); await language(page, 'fr');
    const receiver = await context.newPage();
    await receiver.goto(`${base}/diagnostics.html`); await language(receiver, 'fr');
    assert.equal(await receiver.title(), messages.fr['diag.title']);
    assert.equal(await receiver.locator('#receiver-status').textContent(), messages.fr['diag.waiting']);
    await staticCopy(receiver, 'fr');
    await headerToggle.click(); await language(page, 'en');
    await language(receiver, 'en'); // The actual cross-tab storage event, not a synthetic one.
    assert.equal(await receiver.locator('#receiver-status').textContent(), messages.en['diag.waiting']);
    await receiver.close();
  });
  await check('language changes inside a prepared-pack dialog preserve the File, expanded sections and fetch count', async () => {
    await page.getByRole('button', { name: 'Get Emberfall · 1.0.1', exact: true }).click();
    await page.locator('#experimental-options > summary').click();
    await page.locator('#prepare-button').click();
    await page.waitForFunction(() => document.querySelector('#drag-zone').draggable);
    const before = archiveRequests;
    await page.locator('#pack-dialog [data-language-toggle]').click(); await language(page, 'fr');
    assert.equal(await page.locator('#pack-dialog').evaluate(node => node.open), true);
    assert.equal(await page.locator('#experimental-options').evaluate(node => node.open), true);
    assert.equal(await page.locator('#drag-zone').getAttribute('draggable'), 'true');
    assert.match(await page.locator('#memory-label').textContent(), /8,0 Ko en mémoire/);
    assert.equal(await page.locator('#app-message').textContent(), messages.fr['status.prepared']);
    assert.equal(await page.locator('#dialog-preview-image').getAttribute('alt'), messages.fr['pack.emberfall-v5.alt']);
    assert.match(await page.locator('#file-metadata').textContent(), /Version du pack/);
    assert.equal(archiveRequests, before);
    assert.equal(downloads, 0);
    const pending = page.waitForEvent('download');
    await page.locator('#download-button').click(); const download = await pending;
    assert.equal(download.suggestedFilename(), 'emberfall-v5.zip');
    assert.deepEqual(await readFile(await download.path()), await readFile(new URL('../shaders/emberfall-v5.zip', import.meta.url)));
    await page.locator('#pack-dialog [data-language-toggle]').click(); await language(page, 'en');
    assert.equal(await page.locator('#app-message').textContent(), messages.en['status.download']);
    assert.equal(archiveRequests, before);
    assert.equal(downloads, 1);
    await page.locator('#close-dialog').click(); await download.delete();
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Get Emberfall · 1.0.1');
  });
  await check('an existing error translates without a new request or download', async () => {
    await page.route('**/shaders/aurora-v12.zip', route => route.fulfill({ status: 404, body: '' }));
    await page.getByRole('button', { name: 'Get Aurora · V12', exact: true }).click();
    await page.locator('#download-button').click();
    await page.waitForFunction(() => document.querySelector('#app-message').dataset.tone === 'error');
    assert.equal(await page.locator('#app-message').textContent(), messages.en['error.404']);
    const before = archiveRequests;
    await page.locator('#pack-dialog [data-language-toggle]').click(); await language(page, 'fr');
    assert.equal(await page.locator('#app-message').textContent(), messages.fr['error.404']);
    assert.equal(archiveRequests, before);
    assert.equal(downloads, 1);
    await page.locator('#close-dialog').click(); await page.unroute('**/shaders/aurora-v12.zip');
  });
  await check('changing language while loading preserves the request and translates progress and completion', async () => {
    let release, started;
    const hold = new Promise(resolve => { release = resolve; });
    const seen = new Promise(resolve => { started = resolve; });
    await page.route('**/shaders/frostbound-v5.zip', async route => {
      started(); await hold;
      await route.fulfill({ contentType: 'application/zip', body: await readFile(new URL('../shaders/frostbound-v5.zip', import.meta.url)) });
    });
    await page.getByRole('button', { name: 'Obtenir Frostbound · 1.0.1', exact: true }).click();
    await page.locator('#experimental-options > summary').click();
    await page.locator('#prepare-button').click(); await seen;
    const before = archiveRequests;
    await page.locator('#pack-dialog [data-language-toggle]').click(); await language(page, 'en');
    assert.equal(await page.locator('#progress-label').textContent(), messages.en['progress.fetching']);
    assert.equal(await page.locator('#download-button').isDisabled(), true);
    release(); await page.waitForFunction(() => document.querySelector('#drag-zone').draggable);
    assert.equal(await page.locator('#app-message').textContent(), messages.en['status.prepared']);
    assert.equal(archiveRequests, before);
    assert.equal(downloads, 1);
    await page.locator('#close-dialog').click(); await page.unroute('**/shaders/frostbound-v5.zip');
  });
  await check('diagnostic results from a trusted text drag translate without losing metadata', async () => {
    const receiver = await context.newPage();
    await receiver.goto(`${base}/diagnostics.html`); await language(receiver, 'en');
    await receiver.evaluate(() => {
      const source = document.createElement('button');
      source.id = 'test-drag-source'; source.textContent = 'Diagnostic drag source'; source.draggable = true;
      source.addEventListener('dragstart', event => event.dataTransfer.setData('text/plain', 'test'));
      document.body.prepend(source);
    });
    await receiver.locator('#test-drag-source').dragTo(receiver.locator('#receiver'));
    assert.match(await receiver.locator('#receiver-results').textContent(), /Trusted drop: true/);
    assert.match(await receiver.locator('#receiver-results').textContent(), /File count: 0/);
    await receiver.locator('[data-language-toggle]').click(); await language(receiver, 'fr');
    assert.match(await receiver.locator('#receiver-results').textContent(), /Dépôt authentique : vrai/);
    assert.match(await receiver.locator('#receiver-results').textContent(), /Nombre de fichiers : 0/);
    assert.equal(await receiver.locator('#receiver-status').textContent(), messages.fr['diag.noFile']);
    await receiver.locator('#clear-results').click();
    assert.equal(await receiver.locator('#receiver-status').textContent(), messages.fr['diag.reset']);
    await receiver.locator('[data-language-toggle]').click(); await language(receiver, 'en');
    assert.equal(await receiver.locator('#receiver-status').textContent(), messages.en['diag.reset']);
    await receiver.close();
  });
  await check('both languages fit the catalogue, dialogs and diagnostic header at 320–1440px', async () => {
    const receiver = await context.newPage(); await receiver.goto(`${base}/diagnostics.html`);
    for (const lang of ['en', 'fr']) {
      if (await page.locator('html').getAttribute('lang') !== lang) await headerToggle.click();
      await language(page, lang); await language(receiver, lang);
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await receiver.setViewportSize({ width, height: 900 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${lang} catalogue ${width}`);
        assert.equal(await receiver.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${lang} diagnostic ${width}`);
        await page.locator('[data-pack-id="sunrise-v5"] .get-pack').click();
        await page.locator('#experimental-options > summary').click();
        await page.locator('.file-details > summary').click();
        assert.equal(await page.locator('#pack-dialog').evaluate(node => node.scrollWidth <= node.clientWidth + 1), true, `${lang} dialog ${width}`);
        await page.locator('#close-dialog').click();
      }
    }
    await receiver.close();
  });
  await check('invalid saved preferences fall back to English', async () => {
    const fresh = await browser.newContext({ locale: 'fr-FR' });
    await fresh.addInitScript(key => localStorage.setItem(key, 'invalid'), LANGUAGE_KEY);
    const target = await fresh.newPage(); await target.goto(base); await language(target, 'en');
    assert.equal(await target.locator('#hero-title').innerText(), 'Your packs, ready to play.');
    await fresh.close();
  });
  await check('blocked storage does not prevent switching languages', async () => {
    const fresh = await browser.newContext({ locale: 'fr-FR' });
    await fresh.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
    const target = await fresh.newPage(); target.on('pageerror', error => errors.push(error.message));
    await target.goto(base); await language(target, 'en');
    await target.locator('.header [data-language-toggle]').click(); await language(target, 'fr');
    assert.equal(await target.locator('#hero-title').innerText(), 'Vos packs, prêts à jouer.');
    await fresh.close();
  });
  await check('static no-JavaScript fallback is English on both pages', async () => {
    const fresh = await browser.newContext({ javaScriptEnabled: false, locale: 'fr-FR' });
    const target = await fresh.newPage(); await target.goto(base);
    assert.equal(await target.locator('html').getAttribute('lang'), 'en');
    assert.match(await target.locator('noscript').innerText(), /JavaScript is required/);
    await target.goto(`${base}/diagnostics.html`);
    assert.equal(await target.locator('h1').innerText(), 'What made it across?');
    await fresh.close();
  });
  await check('no JavaScript runtime errors', async () => assert.deepEqual(errors, []));
  await mkdir('test-results', { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  if (await page.locator('html').getAttribute('lang') !== 'en') await headerToggle.click();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/english.png', fullPage: true });
  await headerToggle.click();
  await page.screenshot({ path: 'test-results/french.png', fullPage: true });
} catch (error) { report.failure = error.message; throw error; }
finally {
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/language-report.json', JSON.stringify(report, null, 2));
  await browser.close();
}
