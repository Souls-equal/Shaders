// Optional browser checks. Install Playwright separately; no browser/runtime
// dependency is shipped to the static site. See README for setup.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(process.env.PLAYWRIGHT_MODULE_PATH || import.meta.url);
const { chromium } = require('playwright');
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
const alternate = process.env.TEST_RECEIVER_ORIGIN || 'http://127.0.0.1:3000';
const browser = await chromium.launch({
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
  ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  // Never disable web security, site isolation or origin restrictions.
});
const report = { timestamp: new Date().toISOString(), browser: browser.version(), base, results: [], dragObservations: [], edgeTwoTabs: 'NOT TESTED', bloxdImport: 'NOT TESTED' };
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
const downloads = [];
page.on('pageerror', e => errors.push(e.message));
page.on('download', download => downloads.push(download));
await context.addInitScript(() => {
  window.__urlAudit = { created: 0, revoked: 0 };
  const create = URL.createObjectURL.bind(URL);
  const revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = object => { window.__urlAudit.created++; return create(object); };
  URL.revokeObjectURL = url => { window.__urlAudit.revoked++; return revoke(url); };
});
async function check(name, run) {
  await run();
  report.results.push({ name, passed: true });
  console.log(`PASS ${name}`);
}
async function prepare(target = page) {
  await target.getByRole('button', { name: 'Prepare Shader', exact: true }).click();
  await target.waitForFunction(() => document.querySelector('#drag-zone').draggable);
}
async function expectError(regex) {
  await page.getByRole('button', { name: 'Prepare Shader', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#app-message').dataset.tone === 'error');
  assert.match(await page.locator('#app-message').textContent(), regex);
  assert.equal(await page.locator('#drag-zone').getAttribute('draggable'), 'false');
  assert.equal(downloads.length, 0);
}
try {
  await page.goto(base);
  await check('initial state is disabled; actual published size is displayed', async () => {
    assert.equal(await page.locator('#drag-zone').getAttribute('draggable'), 'false');
    assert.equal(await page.locator('#clear-button').isDisabled(), true);
    assert.match(await page.locator('#pack-size').textContent(), /16,789 bytes/);
  });
  await check('real ZIP prepares without any download or object URL', async () => {
    await prepare();
    assert.match(await page.locator('#app-message').textContent(), /Ready in memory/);
    assert.equal(downloads.length, 0);
    assert.deepEqual(await page.evaluate(() => window.__urlAudit), { created: 0, revoked: 0 });
  });
  await check('pack details, modal Escape and compatibility receiver link work', async () => {
    await page.getByRole('button', { name: 'Pack details' }).click();
    assert.equal(await page.getByRole('dialog').isVisible(), true);
    assert.match(await page.getByRole('dialog').textContent(), /f83f701c/);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'About compatibility' }).click();
    assert.equal(await page.getByRole('link', { name: 'Open test receiver' }).count(), 1);
    await page.getByRole('button', { name: 'Close dialog' }).click();
  });
  await check('cleanup resets drag availability and allows another preparation', async () => {
    await page.getByRole('button', { name: 'Clear File', exact: true }).click();
    assert.equal(await page.locator('#drag-zone').getAttribute('draggable'), 'false');
    await prepare();
    assert.equal(downloads.length, 0);
  });
  await check('trusted pointer drag contains a File at source; record actual receiver outcome', async () => {
    await page.evaluate(() => {
      window.__dragAudit = [];
      document.addEventListener('dragstart', e => {
        window.__dragAudit.push({ event: 'dragstart', trusted: e.isTrusted, count: e.dataTransfer.files.length, types: Array.from(e.dataTransfer.types), name: e.dataTransfer.files[0]?.name, size: e.dataTransfer.files[0]?.size });
      });
      // Test-only local receiver; no synthetic DragEvent or DataTransfer created.
      const target = document.querySelector('.shader-art');
      target.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
      target.addEventListener('drop', e => {
        e.preventDefault();
        window.__dragAudit.push({ event: 'drop', trusted: e.isTrusted, count: e.dataTransfer.files.length, types: Array.from(e.dataTransfer.types) });
      });
    });
    await page.locator('#drag-zone').dragTo(page.locator('.shader-art'));
    const events = await page.evaluate(() => window.__dragAudit);
    assert.equal(events[0]?.trusted, true);
    assert.equal(events[0]?.name, 'aurora.zip');
    assert.equal(events[0]?.size, 16789);
    assert.equal(events[0]?.count, 1);
    assert.equal(events[1]?.event, 'drop');
    report.dragObservations.push({ test: 'same-document trusted pointer drag', events });
    assert.match(await page.locator('#app-message').textContent(), /Import status is unknown/);
  });
  await check('explicit fallback alone starts a download; clear revokes its URL', async () => {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download instead' }).click();
    const download = await pending;
    assert.equal(download.suggestedFilename(), 'aurora.zip');
    assert.deepEqual(await readFile(await download.path()), await readFile(new URL('../aurora.zip', import.meta.url)));
    assert.deepEqual(await page.evaluate(() => window.__urlAudit), { created: 1, revoked: 0 });
    await page.getByRole('button', { name: 'Clear File', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.__urlAudit), { created: 1, revoked: 1 });
    await download.delete();
  });
  // From here on no additional downloads are allowed.
  downloads.length = 0;
  await check('HTTP 404 error is visible and file stays unavailable', async () => {
    await page.route('**/aurora.zip', route => route.fulfill({ status: 404, body: '' }));
    await expectError(/404/);
    await page.unroute('**/aurora.zip');
  });
  await check('HTML response is rejected instead of becoming a ZIP', async () => {
    await page.route('**/aurora.zip', route => route.fulfill({ contentType: 'text/html', body: '<html>not a pack</html>' }));
    await expectError(/Unexpected file type/);
    await page.unroute('**/aurora.zip');
  });
  await check('invalid bytes with ZIP MIME and correct size are rejected structurally', async () => {
    await page.route('**/aurora.zip', route => route.fulfill({ contentType: 'application/zip', body: Buffer.alloc(16789) }));
    await expectError(/not a supported ZIP/);
    await page.unroute('**/aurora.zip');
  });
  await check('oversized declared response is rejected before retention', async () => {
    await page.route('**/aurora.zip', route => route.fulfill({ headers: { 'content-type': 'application/zip', 'content-length': String(60 * 1024 * 1024) }, body: Buffer.alloc(22) }));
    await expectError(/exceeds the 50 MB limit/);
    await page.unroute('**/aurora.zip');
  });
  await check('network failure gets an honest combined network/CORS error', async () => {
    await page.route('**/aurora.zip', route => route.abort('failed'));
    await expectError(/CORS policy/);
    await page.unroute('**/aurora.zip');
  });
  await check('cancel, retry and late response do not revive a cancelled File', async () => {
    let release;
    let requestSeen;
    const seen = new Promise(resolve => { requestSeen = resolve; });
    const hold = new Promise(resolve => { release = resolve; });
    let count = 0;
    await page.route('**/aurora.zip', async route => {
      count++;
      if (count === 1) {
        requestSeen();
        await hold;
        try { await route.fulfill({ contentType: 'application/zip', body: await readFile(new URL('../aurora.zip', import.meta.url)) }); } catch { /* cancelled request */ }
      } else await route.continue();
    });
    await page.getByRole('button', { name: 'Prepare Shader', exact: true }).click();
    await seen;
    await page.getByRole('button', { name: 'Cancel loading' }).click();
    assert.match(await page.locator('#app-message').textContent(), /cancelled/);
    assert.equal(await page.locator('#drag-zone').getAttribute('draggable'), 'false');
    await prepare();
    release();
    await page.unroute('**/aurora.zip', undefined);
    assert.match(await page.locator('#app-message').textContent(), /Ready in memory/);
    assert.equal(downloads.length, 0);
  });
  await check('responsive widths have no horizontal overflow', async () => {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Overflow at ${width}px`);
    }
    await page.setViewportSize({ width: 1440, height: 1100 });
  });
  await check('separate frame receivers record, but do not overstate, transfer results', async () => {
    // Test-only wrapper served by interception; production files are unmodified.
    for (const crossOrigin of [false, true]) {
      const harness = await context.newPage();
      await harness.setViewportSize({ width: 1800, height: 1100 });
      await harness.route('**/__drag-harness', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><title>Browser test harness</title></head><body style="margin:0;display:flex"><iframe name="source" src="/" style="width:1000px;height:1100px;border:0"></iframe><iframe name="receiver" src="${crossOrigin ? alternate : ''}/diagnostics.html" style="width:800px;height:1100px;border:0"></iframe></body></html>` }));
      await harness.goto(`${base}/__drag-harness`);
      const source = harness.frame({ name: 'source' });
      const receiver = harness.frame({ name: 'receiver' });
      await receiver.waitForSelector('#receiver');
      await prepare(source);
      for (const frame of [source, receiver]) await frame.evaluate(() => {
        window.__events = [];
        for (const type of ['dragstart', 'dragend', 'drop']) document.addEventListener(type, e => window.__events.push({ type, trusted: e.isTrusted, count: e.dataTransfer.files.length, types: Array.from(e.dataTransfer.types) }));
      });
      await source.locator('#drag-zone').scrollIntoViewIfNeeded();
      await receiver.locator('#receiver').scrollIntoViewIfNeeded();
      const from = await source.locator('#drag-zone').boundingBox();
      const to = await receiver.locator('#receiver').boundingBox();
      await harness.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await harness.mouse.down();
      await harness.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2, { steps: 4 });
      await harness.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 30 });
      await harness.mouse.move(to.x + to.width / 2 + 3, to.y + to.height / 2 + 3, { steps: 2 });
      await harness.mouse.up();
      const sourceEvents = await source.evaluate(() => window.__events);
      assert.equal(sourceEvents[0]?.type, 'dragstart');
      assert.equal(sourceEvents[0]?.trusted, true);
      assert.equal(sourceEvents[0]?.count, 1);
      report.dragObservations.push({ test: crossOrigin ? 'cross-origin frames (not tabs)' : 'same-origin frames (not tabs)', sourceEvents, receiverEvents: await receiver.evaluate(() => window.__events), receiverStatus: await receiver.locator('#receiver-status').textContent(), metadata: await receiver.locator('#receiver-results').textContent() });
      await harness.close();
    }
  });
  await check('no JavaScript runtime errors', async () => assert.deepEqual(errors, []));
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
} catch (error) {
  report.failure = error.message;
  throw error;
} finally {
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/browser-report.json', JSON.stringify(report, null, 2));
  await browser.close();
}
console.log('\nBrowser evidence saved in test-results/browser-report.json. This is NOT a two-tab Edge or Bloxd.io import test.');
