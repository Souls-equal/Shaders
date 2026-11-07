// Optional Chromium/Edge UI checks. No synthetic DragEvent or security bypass.
// Start the static server first; see README for optional executable/module paths.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { PACKS, CATEGORIES } from '../js/config.js';

const require = createRequire(process.env.PLAYWRIGHT_MODULE_PATH || import.meta.url);
const { chromium } = require('playwright');
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch({
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
  ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}),
  headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
const report = { timestamp: new Date().toISOString(), browser: browser.version(), results: [], dragObservations: [], edgeTwoTabs: 'NOT TESTED', bloxdImport: 'NOT TESTED' };
await context.addInitScript(() => {
  window.__urlAudit = { created: 0, revoked: 0 };
  const create = URL.createObjectURL.bind(URL);
  const revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = blob => { window.__urlAudit.created++; return create(blob); };
  URL.revokeObjectURL = url => { window.__urlAudit.revoked++; return revoke(url); };
});
const page = await context.newPage();
const errors = [];
let downloads = 0;
page.on('pageerror', error => errors.push(error.message));
page.on('download', () => downloads++);
const dialog = page.locator('#pack-dialog');
const latest = PACKS[0];
const original = PACKS.find(pack => pack.id === 'aurora-original');
const zipBytes = await readFile(new URL(`../${latest.url}`, import.meta.url));
const archiveRequests = [];
page.on('request', request => { if (/\.zip$/.test(new URL(request.url()).pathname)) archiveRequests.push(request.url()); });
async function check(name, run) {
  await run(); report.results.push({ name, passed: true }); console.log(`PASS ${name}`);
}
async function openPack(pack = latest, target = page) {
  await target.getByRole('button', { name: `Obtenir ${pack.name} · ${pack.version}`, exact: true }).click();
  await target.waitForFunction(() => document.querySelector('#pack-dialog').open);
}
async function closePack() {
  await page.getByRole('button', { name: 'Fermer la fenêtre' }).click();
  await page.waitForFunction(() => !document.querySelector('#pack-dialog').open);
}
async function prepare() {
  await page.locator('#experimental-options > summary').click();
  await page.locator('#prepare-button').click();
  await page.waitForFunction(() => document.querySelector('#drag-zone').draggable);
}
async function errorCase(handler, message) {
  const before = downloads;
  await page.route('**/shaders/aurora-v12.zip', handler);
  await openPack();
  await page.locator('#download-button').click();
  await page.waitForFunction(() => document.querySelector('#app-message').dataset.tone === 'error');
  assert.match(await page.locator('#app-message').textContent(), message);
  assert.equal(await page.locator('#drag-zone').getAttribute('draggable'), 'false');
  assert.equal(downloads, before);
  await closePack();
  await page.unroute('**/shaders/aurora-v12.zip');
}
try {
  await page.goto(base);
  await check('three category tabs, real versions, V12 featured; no eager fetch or download', async () => {
    assert.equal(await page.getByRole('tab').count(), 3);
    assert.equal(await page.locator('.pack-card').count(), 3);
    assert.equal(await page.locator('.pack-card.featured').getAttribute('data-pack-id'), latest.id);
    assert.equal(archiveRequests.length, 0);
    assert.equal(downloads, 0);
  });
  await check('category switching and arrow/Home/End keys show honest empty states', async () => {
    await page.getByRole('tab', { name: /Schematics/ }).click();
    assert.equal(await page.locator('.pack-card').count(), 0);
    assert.match(await page.locator('.empty-state').textContent(), /Aucun schematic/);
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#tab-t-packs').getAttribute('aria-selected'), 'true');
    assert.match(await page.locator('.empty-state').textContent(), /Aucun texture pack/);
    await page.keyboard.press('Home');
    assert.equal(await page.locator('.pack-card').count(), 3);
    await page.keyboard.press('End');
    assert.equal(await page.locator('#tab-t-packs').getAttribute('aria-selected'), 'true');
    await page.getByRole('tab', { name: /Shaders/ }).click();
  });
  await check('opening a pack only opens the modal; Escape restores focus', async () => {
    await openPack();
    assert.equal(await page.locator('#dialog-title').textContent(), 'Aurora · V12');
    assert.equal(await page.locator('#download-button').evaluate(node => node === document.activeElement), true);
    assert.equal(archiveRequests.length, 0);
    assert.equal(downloads, 0);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#pack-dialog').open);
    assert.match(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), /Obtenir Aurora · V12/);
  });
  for (const pack of PACKS) {
    await check(`${pack.version}: explicit download has correct filename and byte-identical archive`, async () => {
      await openPack(pack);
      assert.equal(await page.locator('#memory-label').textContent(), 'Aucun fichier chargé');
      const pending = page.waitForEvent('download');
      await page.locator('#download-button').click();
      const download = await pending;
      assert.equal(download.suggestedFilename(), pack.filename);
      assert.deepEqual(await readFile(await download.path()), await readFile(new URL(`../${pack.url}`, import.meta.url)));
      assert.match(await page.locator('#app-message').textContent(), /Téléchargement demandé/);
      await closePack();
      const audit = await page.evaluate(() => window.__urlAudit);
      assert.equal(audit.created, audit.revoked);
      await download.delete();
    });
  }
  await check('experimental preparation is opt-in and never auto-downloads', async () => {
    const before = downloads;
    await openPack();
    assert.equal(await page.locator('#experimental-options').getAttribute('open'), null);
    await prepare();
    assert.match(await page.locator('#drag-subtitle').textContent(), /aurora-v12.zip/);
    assert.match(await page.locator('#app-message').textContent(), /navigateur peut perdre/);
    assert.equal(downloads, before);
  });
  await check('trusted pointer drag carries the selected File at departure; outcome stays unknown', async () => {
    await page.evaluate(() => {
      window.__dragAudit = [];
      document.addEventListener('dragstart', event => window.__dragAudit.push({ type: 'dragstart', trusted: event.isTrusted, count: event.dataTransfer.files.length, name: event.dataTransfer.files[0]?.name, size: event.dataTransfer.files[0]?.size }));
      const target = document.querySelector('.recommended');
      target.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; });
      target.addEventListener('drop', event => { event.preventDefault(); window.__dragAudit.push({ type: 'drop', trusted: event.isTrusted, count: event.dataTransfer.files.length, types: Array.from(event.dataTransfer.types) }); });
    });
    await page.locator('#drag-zone').dragTo(page.locator('.recommended'));
    const events = await page.evaluate(() => window.__dragAudit);
    assert.equal(events[0]?.trusted, true);
    assert.equal(events[0]?.name, latest.filename);
    assert.equal(events[0]?.size, latest.expectedSizeBytes);
    assert.equal(events[0]?.count, 1);
    report.dragObservations.push({ test: 'same-document trusted pointer drag, not Edge tabs or Bloxd.io', events });
    assert.match(await page.locator('#app-message').textContent(), /résultat d’import est inconnu/);
  });
  await check('prepared file can be downloaded without a second fetch; clear revokes and disables drag', async () => {
    const requests = archiveRequests.length;
    const pending = page.waitForEvent('download');
    await page.locator('#download-button').click();
    const download = await pending;
    assert.equal(archiveRequests.length, requests);
    await page.locator('#clear-button').click();
    assert.equal(await page.locator('#drag-zone').getAttribute('draggable'), 'false');
    assert.equal(await page.locator('#memory-label').textContent(), 'Aucun fichier chargé');
    const audit = await page.evaluate(() => window.__urlAudit);
    assert.equal(audit.created, audit.revoked);
    await closePack();
    await download.delete();
  });
  await check('HTTP 404 is shown with no download', () => errorCase(route => route.fulfill({ status: 404, body: '' }), /serveur/));
  await check('HTML MIME is rejected', () => errorCase(route => route.fulfill({ contentType: 'text/html', body: '<h1>wrong</h1>' }), /pas renvoyé un fichier ZIP/));
  await check('fake ZIP bytes are rejected', () => errorCase(route => route.fulfill({ contentType: 'application/zip', body: Buffer.alloc(latest.expectedSizeBytes) }), /ZIP est invalide/));
  await check('oversized declared response is rejected', () => errorCase(route => route.fulfill({ headers: { 'content-type': 'application/zip', 'content-length': String(60 * 1024 * 1024) }, body: Buffer.alloc(22) }), /taille autorisée/));
  await check('network failure gives a network/CORS message', () => errorCase(route => route.abort('failed'), /réseau.*CORS/));
  await check('closing during a download request cancels it; another version never receives stale bytes', async () => {
    let release, seen;
    const held = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { seen = resolve; });
    await page.route('**/shaders/aurora-v12.zip', async route => {
      seen(); await held;
      try { await route.fulfill({ contentType: 'application/zip', body: zipBytes }); } catch { /* aborted */ }
    });
    const before = downloads;
    await openPack(); await page.locator('#download-button').click(); await started;
    await closePack();
    await openPack(PACKS[1]); await prepare();
    release();
    await page.unroute('**/shaders/aurora-v12.zip');
    assert.equal(downloads, before);
    assert.match(await page.locator('#drag-subtitle').textContent(), /aurora-v9.zip/);
    await closePack();
  });
  await check('cancel loading then retry downloads only after a new explicit request', async () => {
    let release, seen;
    const held = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { seen = resolve; });
    await page.route('**/shaders/aurora-v12.zip', async route => {
      seen(); await held;
      try { await route.fulfill({ contentType: 'application/zip', body: zipBytes }); } catch { /* aborted */ }
    });
    const before = downloads;
    await openPack(); await page.locator('#download-button').click(); await started;
    await page.locator('#clear-button').click();
    assert.match(await page.locator('#app-message').textContent(), /annulé/);
    release(); await page.unroute('**/shaders/aurora-v12.zip');
    assert.equal(downloads, before);
    const pending = page.waitForEvent('download');
    await page.locator('#download-button').click();
    const download = await pending;
    assert.equal(download.suggestedFilename(), latest.filename);
    await closePack(); await download.delete();
  });
  await check('future schematics/texture ZIP entries use the same category and acquisition dialog', async () => {
    const future = CATEGORIES.slice(1).map(category => ({ ...original, id: `test-${category.id}`, category: category.id, name: `Test ${category.label}`, version: '1', filename: 'sample.zip', url: `./${category.folder}/sample.zip` }));
    const fixture = await context.newPage();
    fixture.on('pageerror', error => errors.push(error.message));
    await fixture.route('**/js/config.js', route => route.fulfill({ contentType: 'text/javascript', body: `export const CATEGORIES = ${JSON.stringify(CATEGORIES)}; export const PACKS = ${JSON.stringify([...PACKS, ...future])};` }));
    const bytes = await readFile(new URL(`../${original.url}`, import.meta.url));
    for (const pack of future) await fixture.route(`**/${pack.category}/sample.zip`, route => route.fulfill({ contentType: 'application/zip', body: bytes }));
    await fixture.goto(base);
    for (const pack of future) {
      await fixture.getByRole('tab', { name: new RegExp(CATEGORIES.find(category => category.id === pack.category).label) }).click();
      await openPack(pack, fixture);
      const pending = fixture.waitForEvent('download');
      await fixture.locator('#download-button').click();
      const download = await pending;
      assert.equal(download.suggestedFilename(), 'sample.zip');
      assert.deepEqual(await readFile(await download.path()), bytes);
      await fixture.locator('#close-dialog').click();
      await fixture.waitForFunction(() => !document.querySelector('#pack-dialog').open);
      await download.delete();
    }
    await fixture.close();
  });
  await check('responsive catalogue and expanded modal have no horizontal overflow at 320–1440px', async () => {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `catalogue ${width}`);
      await openPack();
      await page.locator('#experimental-options > summary').click();
      await page.locator('.file-details > summary').click();
      assert.equal(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1), true, `dialog ${width}`);
      await closePack();
    }
  });
  await check('diagnostic receiver loads the catalogue and its reset control works', async () => {
    const receiver = await context.newPage();
    receiver.on('pageerror', error => errors.push(error.message));
    await receiver.goto(`${base}/diagnostics.html`);
    assert.equal(await receiver.locator('#receiver').count(), 1);
    assert.equal(await receiver.locator('#clear-results').isDisabled(), true);
    await receiver.close();
  });
  await check('no JavaScript runtime errors', async () => assert.deepEqual(errors, []));
  await mkdir('test-results', { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  await openPack();
  await page.screenshot({ path: 'test-results/pack-dialog.png' });
  await closePack();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
} catch (error) {
  report.failure = error.message; throw error;
} finally {
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/browser-report.json', JSON.stringify(report, null, 2));
  await browser.close();
}
console.log('\nEvidence: test-results/browser-report.json. NOT a real Bloxd.io import test.');
