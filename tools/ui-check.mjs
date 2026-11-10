// UI-only pack regression: no CSS from downloaded packs is applied to the site.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { PACKS } from '../js/config.js';
const require = createRequire(process.env.PLAYWRIGHT_MODULE_PATH || import.meta.url);
const { chromium } = require('playwright');
const { default: AxeBuilder } = require('@axe-core/playwright');
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch({
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
  ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}),
  headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
const packs = PACKS.filter(pack => pack.category === 'ui');
const report = { browser: browser.version(), results: [], axe: [], bloxdImport: 'NOT TESTED' };
const errors = [], requests = [];
let downloads = 0;
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => requests.push(request.url()));
page.on('download', () => downloads++);
const archiveCount = () => requests.filter(url => url.endsWith('.zip')).length;
const open = pack => page.locator(`.ui-choice[data-pack-id="${pack.id}"]`).click();
const close = () => page.locator('#close-dialog').click();
const toggle = () => page.locator('#pack-dialog [data-language-toggle]').click();
async function check(name, run) { await run(); report.results.push({ name, passed: true }); console.log('PASS', name); }
try {
  await page.goto(base);
  await page.locator('#tab-ui').click();
  await check('UI-only tab has eight themes, 16 explicit font choices, and no automatic archive requests', async () => {
    assert.equal(await page.locator('.ui-card').count(), 8);
    assert.equal(await page.locator('.ui-choice').count(), 16);
    assert.equal(await page.locator('#tab-ui .count-badge').textContent(), '16');
    assert.equal(await page.locator('#library-status').textContent(), '8 UI themes · 16 ZIP variants · font-normal / font-pixel');
    assert.equal(archiveCount(), 0);
    assert.equal(downloads, 0);
    for (const pack of packs) assert.equal(await page.locator(`.ui-choice[data-pack-id="${pack.id}"] > span`).first().textContent(), pack.font);
  });
  for (const pack of packs) {
    await check(`${pack.name} ${pack.font}: explicit download has the right archive, filename and metadata`, async () => {
      const before = archiveCount();
      await open(pack);
      assert.equal(await page.locator('#dialog-title').textContent(), `${pack.name} · V5 · ${pack.font}`);
      assert.equal(await page.locator('#dialog-preview').isVisible(), false);
      assert.doesNotMatch(await page.locator('#dialog-meta').textContent(), /API/);
      assert.match(await page.locator('#ui-pack-note').textContent(), pack.font === 'font-pixel' ? /Google Fonts/ : /without the pixel-font override/);
      assert.equal(archiveCount(), before, 'opening must not fetch');
      await page.locator('.file-details > summary').click();
      const metadata = await page.locator('#file-metadata').textContent();
      assert.ok(metadata.includes(pack.filename));
      assert.ok(metadata.includes(pack.sha256));
      assert.ok(metadata.includes(pack.font));
      const pending = page.waitForEvent('download');
      await page.locator('#download-button').click();
      const download = await pending;
      assert.equal(download.suggestedFilename(), pack.filename);
      assert.deepEqual(await readFile(await download.path()), await readFile(new URL(`../${pack.url}`, import.meta.url)));
      assert.equal(archiveCount(), before + 1);
      await close();
      assert.equal(await page.evaluate(() => document.activeElement.dataset.packId), pack.id);
      await download.delete();
    });
  }
  await check('prepared pixel variant survives EN/FR changes and downloads without another fetch', async () => {
    const pack = packs[1];
    await open(pack);
    await page.locator('#experimental-options > summary').click();
    await page.locator('#prepare-button').click();
    await page.waitForFunction(() => document.querySelector('#drag-zone').draggable);
    const before = archiveCount();
    await toggle();
    assert.equal(await page.locator('html').getAttribute('lang'), 'fr');
    assert.equal(await page.locator('#tab-ui .category-label').textContent(), 'UI uniquement');
    assert.match(await page.locator('#library-status').textContent(), /8 thèmes d’UI · 16 variantes ZIP/);
    assert.match(await page.locator('#ui-pack-note').textContent(), /police externe/);
    assert.equal(await page.locator('#drag-zone').getAttribute('draggable'), 'true');
    assert.match(await page.locator('#drag-subtitle').textContent(), /font-pixel.zip/);
    const pending = page.waitForEvent('download');
    await page.locator('#download-button').click();
    const download = await pending;
    assert.equal(download.suggestedFilename(), pack.filename);
    assert.deepEqual(await readFile(await download.path()), await readFile(new URL(`../${pack.url}`, import.meta.url)));
    assert.equal(archiveCount(), before);
    await close();
    assert.equal(await page.evaluate(() => document.activeElement.dataset.packId), pack.id);
    await open(packs[0]);
    assert.equal(await page.locator('#drag-zone').getAttribute('draggable'), 'false');
    assert.match(await page.locator('#memory-label').textContent(), /Aucun fichier/);
    await close(); await download.delete();
  });
  await check('a missing pixel archive reports an error without downloading or substituting normal', async () => {
    await page.route(`**/t-packs/${packs[3].filename}`, route => route.fulfill({ status: 404 }));
    const before = downloads;
    await open(packs[3]); await page.locator('#download-button').click();
    await page.waitForFunction(() => document.querySelector('#app-message').dataset.tone === 'error');
    assert.match(await page.locator('#app-message').textContent(), /HTTP 404/);
    assert.equal(downloads, before);
    await close(); await page.unroute(`**/t-packs/${packs[3].filename}`);
  });
  await check('closing a pending normal request cannot leak its bytes into the pixel variant', async () => {
    let release, started;
    const hold = new Promise(resolve => { release = resolve; });
    const seen = new Promise(resolve => { started = resolve; });
    await page.route(`**/t-packs/${packs[0].filename}`, async route => {
      started(); await hold;
      await route.fulfill({ contentType: 'application/zip', body: await readFile(new URL(`../${packs[0].url}`, import.meta.url)) }).catch(() => {});
    });
    const before = downloads;
    await open(packs[0]); await page.locator('#download-button').click(); await seen;
    await close(); await open(packs[1]); release();
    assert.equal(await page.locator('#drag-zone').getAttribute('draggable'), 'false');
    const pending = page.waitForEvent('download');
    await page.locator('#download-button').click(); const download = await pending;
    assert.equal(download.suggestedFilename(), packs[1].filename);
    assert.deepEqual(await readFile(await download.path()), await readFile(new URL(`../${packs[1].url}`, import.meta.url)));
    assert.equal(downloads, before + 1);
    await close(); await download.delete(); await page.unroute(`**/t-packs/${packs[0].filename}`);
  });
  await check('UI grid and expanded pixel dialog fit 320–1440px in English and French', async () => {
    for (const lang of ['en', 'fr']) {
      if (await page.locator('html').getAttribute('lang') !== lang) await page.locator('.header [data-language-toggle]').click();
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${lang} grid ${width}`);
        for (const pack of packs) assert.equal(await page.locator(`.ui-choice[data-pack-id="${pack.id}"]`).evaluate(node => node.scrollWidth <= node.clientWidth + 1), true, pack.id);
        await open(packs[1]);
        await page.locator('#experimental-options > summary').click();
        await page.locator('.file-details > summary').click();
        assert.equal(await page.locator('#pack-dialog').evaluate(node => node.scrollWidth <= node.clientWidth + 1), true, `${lang} dialog ${width}`);
        await close();
      }
    }
  });
  await check('no automated WCAG 2 A/AA violations on UI grid and dialog, EN/FR, desktop/mobile', async () => {
    for (const lang of ['en', 'fr']) {
      if (await page.locator('html').getAttribute('lang') !== lang) await page.locator('.header [data-language-toggle]').click();
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const view of ['grid', 'dialog']) {
          if (view === 'dialog') await open(packs[1]);
          const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
          report.axe.push({ lang, width, view, violations: result.violations.map(v => v.id) });
          assert.equal(result.violations.length, 0, JSON.stringify(result.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))));
          if (view === 'dialog') await close();
        }
      }
    }
  });
  await check('no runtime errors, no pack CSS executed, and no external font requests from this site', async () => {
    assert.deepEqual(errors, []);
    assert.equal(requests.some(url => /Nebula_.*\/css\/nebula\.css|fonts\.(googleapis|gstatic)\.com/.test(url)), false);
    assert.equal(await page.locator('link[href*="Nebula_"]').count(), 0);
    await page.locator('#tab-t-packs').click();
    assert.equal(await page.locator('.ui-card').count(), 0);
    assert.equal(await page.locator('.empty-state').isVisible(), true);
    await page.locator('#tab-ui').click();
  });
  await mkdir('test-results', { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#collection').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/ui-themes.png', fullPage: true });
} catch (error) { report.failure = error.message; throw error; }
finally {
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/ui-report.json', JSON.stringify(report, null, 2));
  await browser.close();
}
