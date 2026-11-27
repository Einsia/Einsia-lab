/** Reproduce late/failed image requests and ensure Research cards keep their geometry.
 * Run against a production preview; PLAYWRIGHT_MODULE may use an isolated install. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.DESIGN_CHECK_URL || 'http://127.0.0.1:4322';
const out = path.resolve('.local/design-check/research-images');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const results = [];
const selector = '.lab-research-thumbnail';
const nextPaint = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const geometry = page => page.locator(selector).evaluateAll(links => links.map(link => {
  const box = link.getBoundingClientRect();
  const row = link.closest('.lab-research-row').getBoundingClientRect();
  return { width: box.width, height: box.height, rowHeight: row.height, rowTop: row.top + scrollY };
}));
function stable(before, after, state) {
  assert.equal(after.length, before.length);
  before.forEach((box, index) => {
    assert.ok(box.height > 100, `${state}: collapsed thumbnail ${index}`);
    for (const key of Object.keys(box)) assert.ok(Math.abs(box[key] - after[index][key]) < 1, `${state}: ${key} shifted for thumbnail ${index}`);
  });
}
try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/research/thumbnails/*.webp', async route => { await gate; await route.continue(); });
    await page.goto(base + '/research/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    await nextPaint(page);
    const before = await geometry(page);
    const images = page.locator(`${selector} img`);
    assert.equal(await images.first().getAttribute('loading'), 'eager');
    assert.equal(await images.first().getAttribute('fetchpriority'), 'high');
    assert.equal(await images.first().evaluate(image => image.naturalWidth), 0);
    assert.equal(await images.evaluateAll(images => images.every(image => image.width > 0 && image.height > 0 && image.srcset && getComputedStyle(image).objectFit === 'contain')), true);
    if (width === 390 || width === 1440) await page.screenshot({ path: path.join(out, `${width}-pending.png`) });
    release();
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate(image => image.decode());
    }
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await nextPaint(page);
    stable(before, await geometry(page), `${width}px loaded`);
    const sources = await images.evaluateAll(images => images.map(image => image.currentSrc));
    assert.ok(sources.every(src => src.startsWith(locationOrigin(base) + '/research/thumbnails/')));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (width === 390 || width === 1440) await page.screenshot({ path: path.join(out, `${width}-loaded.png`) });

    await page.unroute('**/research/thumbnails/*.webp');
    await page.route('**/research/thumbnails/*.webp', route => route.fulfill({ status: 404, body: '' }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    for (const link of await page.locator(selector).all()) {
      await link.scrollIntoViewIfNeeded();
      await link.locator('.lab-thumbnail-fallback').waitFor({ state: 'visible' });
      assert.ok(await link.getAttribute('href'));
    }
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await nextPaint(page);
    stable(before, await geometry(page), `${width}px failed`);
    if (width === 390 || width === 1440) await page.screenshot({ path: path.join(out, `${width}-failed.png`) });
    assert.deepEqual(errors, []);
    results.push({ width, thumbnails: before.length, loadedAndFailedGeometryStable: true, sources });
    await context.close();
    console.log(`PASS ${width}px: delayed, loaded and failed thumbnails keep the same card geometry.`);
  }
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 900 } });
  const page = await context.newPage();
  await page.route('**/research/thumbnails/*.webp', route => route.fulfill({ status: 404, body: '' }));
  await page.goto(base + '/research/');
  for (const box of await geometry(page)) assert.ok(box.height > 100);
  assert.ok(await page.locator('.lab-research-row h2 a').count() > 0);
  console.log('PASS no JavaScript: failed images keep space and project links remain available.');
  results.push({ javaScriptEnabled: false, failedImageSpaceReserved: true });
  await context.close();

  // 200% desktop reflow equivalent, with touch controls and long mixed-language text.
  const touchContext = await browser.newContext({ viewport: { width: 720, height: 900 }, deviceScaleFactor: 2, hasTouch: true, reducedMotion: 'reduce' });
  const touchPage = await touchContext.newPage();
  await touchPage.goto(base + '/research/');
  await touchPage.locator('.lab-research-row h2 a').first().evaluate(link => {
    link.textContent = 'A long research heading for embodied agents and multimodal evaluation / 具身智能与多模态评测的长标题排版检查';
  });
  await touchPage.evaluate(() => document.fonts.ready);
  assert.equal(await touchPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await touchPage.locator('.lab-research-links a').evaluateAll(links => links.every(link => {
    const box = link.getBoundingClientRect();
    return box.height >= 44 && box.width >= 44;
  })), true);
  await touchPage.locator(selector).first().focus();
  await touchPage.keyboard.press('Tab');
  assert.equal(await touchPage.locator('.lab-research-row h2 a').first().evaluate(link => document.activeElement === link), true);
  await touchPage.keyboard.press('Shift+Tab');
  assert.equal(await touchPage.locator(selector).first().evaluate(link => document.activeElement === link && getComputedStyle(link).outlineStyle !== 'none'), true);
  const destination = new URL(await touchPage.locator(selector).first().getAttribute('href'), base).href;
  await touchPage.keyboard.press('Enter');
  await touchPage.waitForURL(destination);
  console.log('PASS 720 CSS px / DPR 2 reflow equivalent, long bilingual heading, touch targets and keyboard thumbnail navigation.');
  results.push({ cssWidth: 720, dpr: 2, reflowEquivalent: true, longHeading: true, touchTargets: true, keyboardNavigation: true });
  await touchContext.close();
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
}
function locationOrigin(url) { return new URL(url).origin; }
