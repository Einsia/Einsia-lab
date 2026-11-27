/** Regression checks for overlapping RoboUniverse headers and off-center figure dialogs. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.DESIGN_CHECK_URL || 'http://127.0.0.1:4322';
const out = path.resolve(process.env.DESIGN_CHECK_OUT || '.local/design-check/research-layout');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const widths = [320, 390, 768, 1024, 1440];
const results = [];
const paint = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
async function checkDialog(page) {
  await page.locator('#lightbox-img').evaluate(image => image.decode());
  await paint(page);
  const box = await page.locator('#lightbox').evaluate(dialog => {
    const r = dialog.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, viewportWidth: innerWidth, viewportHeight: innerHeight };
  });
  assert.ok(Math.abs(box.x + box.width / 2 - box.viewportWidth / 2) < 1, 'dialog is not horizontally centered');
  assert.ok(Math.abs(box.y + box.height / 2 - box.viewportHeight / 2) < 1, 'dialog is not vertically centered');
  assert.ok(box.x >= 19 && box.y >= 19, 'dialog needs viewport gutters');
  assert.ok(box.x + box.width <= box.viewportWidth - 19 && box.y + box.height <= box.viewportHeight - 19, 'dialog exceeds viewport');
  assert.equal(await page.locator('[data-lightbox-close]').isVisible(), true);
  return box;
}
try {
  for (const route of ['/robo-universe/', '/robouniverse/']) {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + route);
    await page.evaluate(() => document.fonts.ready);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      for (const scope of ['all', 'Franka', 'AgileX']) {
        await page.locator(`[data-result-scope="${scope}"]`).click();
        const panel = page.locator(`[data-result-panel="${scope}"]`);
        const scroll = panel.locator('.board-scroll');
        await scroll.evaluate(el => { el.scrollLeft = 0; });
        await paint(page);
        const headers = await panel.locator('.taxonomy-table-head th').evaluateAll(cells => cells.map((cell, index) => {
          const button = cell.querySelector('button');
          const rect = cell.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(button);
          const text = range.getBoundingClientRect();
          const data = cell.closest('table').querySelector('tbody tr:not(.result-group)').children[index + 3].getBoundingClientRect();
          return {
            label: button.textContent.trim(),
            textOverflow: Math.max(rect.left - text.left, text.right - rect.right, rect.top - text.top, text.bottom - rect.bottom, 0),
            alignment: Math.max(Math.abs(rect.left - data.left), Math.abs(rect.right - data.right)),
          };
        }));
        for (const header of headers) {
          assert.ok(header.textOverflow < 1, `${width}px ${scope}: overflowing ${header.label}`);
          assert.ok(header.alignment < 1, `${width}px ${scope}: misaligned ${header.label}`);
        }
        assert.equal(await noOverflow(page), true, `${route}: whole-page overflow`);
        // The last column must be reachable, with no pinned cell hiding its header.
        await scroll.evaluate(el => { el.scrollLeft = el.scrollWidth; });
        await scroll.scrollIntoViewIfNeeded();
        await paint(page);
        const lastCell = panel.locator('thead tr').last().locator('th').last();
        const visible = await lastCell.evaluate(cell => {
          const r = cell.getBoundingClientRect();
          const viewport = cell.closest('.board-scroll').getBoundingClientRect();
          const target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return r.left >= viewport.left && r.right <= viewport.right + 1 && cell.contains(target);
        });
        assert.equal(visible, true, `${width}px ${scope}: last header is obscured`);
        results.push({ route, width, scope, headers });
      }
      await page.locator('[data-result-scope="all"]').click();
      const scroll = page.locator('[data-result-panel="all"] .board-scroll');
      await scroll.evaluate(el => { el.scrollLeft = 0; });
      if (route === '/robo-universe/' && [390, 1440].includes(width)) {
        await scroll.evaluate(el => { el.scrollLeft = 0; });
        await scroll.scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(out, `table-${width}.png`) });
      }
      await scroll.focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.querySelector('[data-result-panel="all"] .board-scroll').scrollLeft > 0);
    }
    const family = page.locator('[data-result-panel="all"] [data-result-family="assembly"]');
    await family.scrollIntoViewIfNeeded();
    await family.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('[data-family="assembly"]').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`PASS ${route}: three result views at five widths, aligned headers, horizontal scrolling and family navigation.`);
  }
  for (const route of ['/visual-cipher-bench/', '/ai4ai/']) {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.goto(base + route);
    await page.evaluate(() => document.fonts.ready);
    const image = page.locator('main img[role=button]').first();
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      await image.focus();
      await page.keyboard.press('Enter');
      const box = await checkDialog(page);
      assert.equal(await page.locator('[data-lightbox-close]').evaluate(el => document.activeElement === el), true);
      await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
      assert.equal(await page.locator('#lightbox').evaluate(el => el.contains(document.activeElement)), true);
      if (route === '/visual-cipher-bench/' && [390, 1440].includes(width)) await page.screenshot({ path: path.join(out, `dialog-${width}.png`) });
      await page.keyboard.press('Escape');
      assert.equal(await image.evaluate(el => document.activeElement === el), true);
      results.push({ route, width, dialog: box });
    }
    if (route === '/visual-cipher-bench/') {
      await page.locator('.vcbm-card').first().click();
      await checkDialog(page);
      await page.setViewportSize({ width: 720, height: 450 });
      await checkDialog(page);
      await page.locator('[data-lightbox-close]').click();
      assert.equal(await page.locator('#lightbox').evaluate(el => el.open), false);
      results.push({ route, puzzleDialog: true, resizeWhileOpen: true, viewport: '720×450' });
    }
    await page.close();
    console.log(`PASS ${route}: figure dialog centered at five widths; focus, Escape and return verified.`);
  }
  for (const route of ['/workflowarena/', '/robo-universe/', '/robouniverse/', '/embodiedevo/']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = [];
    const popups = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('popup', popup => popups.push(popup.url()));
    await page.goto(base + route);
    const link = page.locator('main a[aria-haspopup=dialog]').first();
    const original = await link.evaluate(link => link.href);
    // WorkflowArena's index redirects to home.html before the figure is available.
    const url = page.url();
    await link.focus();
    await page.keyboard.press('Enter');
    await checkDialog(page);
    assert.equal(await page.locator('#lightbox-img').evaluate(image => image.src), original);
    assert.equal(page.url(), url);
    assert.deepEqual(popups, []);
    if (route === '/workflowarena/') await page.screenshot({ path: path.join(out, 'workflowarena-preview.png') });
    await page.keyboard.press('Escape');
    assert.equal(await link.evaluate(link => document.activeElement === link), true);
    assert.deepEqual(errors, []);
    results.push({ route, linkedImagePreview: true, newTabs: popups.length, originalImage: original });
    await page.close();
    console.log(`PASS ${route}: original-image link opens the shared preview, with no navigation or extra tab.`);
  }
  const failurePage = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await failurePage.goto(base + '/visual-cipher-bench/');
  const card = failurePage.locator('.vcbm-card').first();
  const source = new URL(await card.getAttribute('data-lab-preview'), base).href;
  await failurePage.route(source, route => route.fulfill({ status: 503, body: '' }));
  await card.click();
  await failurePage.locator('[data-lightbox-error]').waitFor({ state: 'visible' });
  await failurePage.unroute(source);
  await failurePage.locator('[data-lightbox-retry]').click();
  await checkDialog(failurePage);
  assert.equal(await failurePage.locator('[data-lightbox-error]').isVisible(), false);
  await failurePage.mouse.click(5, 5);
  assert.equal(await failurePage.locator('#lightbox').evaluate(dialog => dialog.open), false);
  results.push({ failedImageRetry: true, backdropClose: true });
  await failurePage.close();
  console.log('PASS image request failure, retry and backdrop close.');

  const noJS = await browser.newPage({ javaScriptEnabled: false });
  await noJS.goto(base + '/workflowarena/');
  assert.ok(await noJS.locator('.herofigure a').getAttribute('href'));
  assert.equal(await noJS.locator('#lightbox').count(), 0);
  await noJS.close();
  results.push({ originalImageLinkWithoutJavaScript: true });
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
}
