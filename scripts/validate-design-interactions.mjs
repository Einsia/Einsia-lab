/** Integration checks for v0.4 interaction changes. Run against an Astro preview.
 * Uses the same isolated Playwright install as validate-design-browser.mjs. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.DESIGN_CHECK_URL || 'http://localhost:4321';
const out = path.resolve(process.env.DESIGN_CHECK_OUT || '.local/design-check');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const results = [];
async function test(name, run, options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, ...options });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  try { await run(page, context); results.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, passed: false, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
  finally { await context.close(); }
}
const goto = (page, route) => page.goto(base + route, { waitUntil: 'networkidle' });
const overflow = page => page.evaluate(() => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - innerWidth);

for (const route of ['/', '/embodiedevo/', '/workflowarena/', '/robo-universe/']) {
  await test(`Mobile menu and keyboard: ${route}`, async page => {
    await goto(page, route);
    const toggle = page.locator('.lab-nav-toggle');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('#lab-navigation').isVisible(), false);
    await toggle.focus(); await page.keyboard.press('Enter');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    await page.locator('#lab-navigation a').first().focus(); await page.keyboard.press('Escape');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await toggle.evaluate(el => el === document.activeElement), true);
    await page.setViewportSize({ width: 1440, height: 900 });
    assert.equal(await page.locator('#lab-navigation').isVisible(), true);
    assert.equal(await toggle.isVisible(), false);
  });
}

await test('Figure dialog: keyboard, focus trap, Escape and focus return', async page => {
  await goto(page, '/ai4ai/');
  const image = page.locator('main img[role=button]').first();
  await image.focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#lightbox').evaluate(el => el.open), true);
  assert.equal(await page.locator('[data-lightbox-close]').evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.querySelector('#lightbox').contains(document.activeElement)), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#lightbox').evaluate(el => el.open), false);
  assert.equal(await image.evaluate(el => el === document.activeElement), true);
  assert.equal(await page.locator('html').evaluate(el => el.classList.contains('lab-modal-open')), false);
});

await test('Visual Cipher puzzle dialog opens and closes', async page => {
  await goto(page, '/visual-cipher-bench/');
  const card = page.locator('.vcbm-card').first();
  await card.click();
  assert.equal(await page.locator('#lightbox').evaluate(el => el.open), true);
  await page.keyboard.press('Escape');
  assert.equal(await card.evaluate(el => el === document.activeElement), true);
});

await test('AI4AI: filters, matrix, empty state, reset, Back and reload', async page => {
  await goto(page, '/ai4ai/trajectories/');
  assert.equal(await page.locator('[data-case-card]:visible').count(), 290);
  await page.locator('#filter-task').selectOption('ddpo_sd15_aesthetic');
  const filtered = await page.locator('[data-case-card]:visible').count();
  assert.ok(filtered > 0 && filtered < 290);
  await page.locator('[data-view=matrix]').click();
  assert.equal(await page.locator('[data-case-row]:visible').count(), filtered);
  await page.goBack();
  await page.waitForSelector('[data-view-panel=cards]:visible');
  assert.equal(await page.locator('[data-case-card]:visible').count(), filtered);
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#filter-task').inputValue(), 'ddpo_sd15_aesthetic');
  await page.locator('#filter-q').fill('no-matching-research-configuration');
  assert.equal(await page.locator('[data-empty]').isVisible(), true);
  assert.equal(await page.locator('[data-case-card]:visible').count(), 0);
  await page.locator('[data-reset]').click();
  assert.equal(await page.locator('[data-case-card]:visible').count(), 290);
  assert.equal(new URL(page.url()).search, '');
});

await test('EmbodiedEvo: leaderboard sorting, metric, filter and reset', async page => {
  await goto(page, '/embodiedevo/');
  const rows = page.locator('.evo-leaderboard tbody tr:visible');
  const initial = await rows.first().getAttribute('data-lb-row');
  await page.locator('[data-lb-sort="0"]').click();
  assert.equal(await page.locator('th[data-lb-column="0"]').getAttribute('aria-sort'), 'ascending');
  assert.notEqual(await rows.first().getAttribute('data-lb-row'), initial);
  await page.locator('[data-lb-metric=success]').click();
  assert.equal(await page.locator('.evo-leaderboard').getAttribute('data-metric'), 'success');
  await page.locator('#lb-type').selectOption({ index: 1 });
  assert.ok(await rows.count() > 0);
  await page.locator('#lb-reset').click();
  assert.equal(await rows.first().getAttribute('data-lb-row'), initial);
  assert.equal(await page.locator('#lb-reset').isDisabled(), true);
});

await test('EmbodiedEvo: method animation is explicitly controlled', async page => {
  await goto(page, '/embodiedevo/');
  const image = page.locator('#method-animation');
  assert.equal(await image.getAttribute('src'), await image.getAttribute('data-poster'));
  await page.locator('#method-motion').click();
  await page.waitForFunction(() => { const el = document.querySelector('#method-animation'); return el.getAttribute('src') === el.dataset.animation; });
  await page.locator('#method-motion').click();
  assert.equal(await image.getAttribute('src'), await image.getAttribute('data-poster'));
});

await test('Trajectory: camera and record tabs, copy feedback, video control', async (page, context) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await goto(page, '/embodiedevo/trajectories/');
  await page.waitForSelector('#episode-player:visible');
  assert.equal(await page.locator('#episode-video').evaluate(el => el.paused), true);
  await page.locator('#camera-head').focus(); await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#camera-left').getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('#camera-panel').getAttribute('aria-labelledby'), 'camera-left');
  await page.locator('#tab-code').focus(); await page.keyboard.press('End');
  assert.equal(await page.locator('#tab-lessons').getAttribute('aria-selected'), 'true');
  await page.keyboard.press('Home');
  await page.locator('#copy-record').click();
  await page.waitForFunction(() => document.querySelector('#copy-record').textContent === 'Copied');
  assert.equal(await page.locator('#copy-record').textContent(), 'Copied');
  assert.ok((await page.evaluate(() => navigator.clipboard.readText())).length > 20);
  await page.locator('#episode-video').evaluate(el => el.play());
  assert.equal(await page.locator('#episode-video').evaluate(el => el.paused), false);
  await page.locator('#episode-video').evaluate(el => el.pause());
  await page.locator('#task-search').fill('no-matching-task');
  assert.equal(await page.locator('#no-tasks').isVisible(), true);
});

await test('Trajectory: failed fetch and successful retry', async page => {
  await page.route('**/embodied-rsi/replays/episodes/**/trace.json', route => route.fulfill({ status: 503, body: '' }));
  await goto(page, '/embodiedevo/trajectories/');
  await page.waitForSelector('#episode-error:visible');
  await page.unroute('**/embodied-rsi/replays/episodes/**/trace.json');
  await page.locator('#retry-episode').click();
  await page.waitForSelector('#episode-player:visible');
  assert.equal(await page.locator('#episode-error').isVisible(), false);
});

await test('WorkflowArena: 3D starts paused and responds to Play', async page => {
  await goto(page, '/workflowarena/3d/cases/palace/');
  await page.waitForFunction(() => window.__showcase, { timeout: 30000 });
  assert.equal(await page.evaluate(() => window.__showcase.playing), false);
  assert.equal(await page.evaluate(() => window.__showcase.auto), false);
  await page.locator('#play').click();
  await page.waitForFunction(() => window.__showcase.playing);
  await page.locator('#play').click();
  await page.waitForFunction(() => !window.__showcase.playing);
});

await test('Reduced motion and coarse pointer controls', async page => {
  await goto(page, '/embodiedevo/');
  assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches && matchMedia('(pointer: coarse)').matches), true);
  assert.ok(await page.locator('.lab-nav-toggle').evaluate(el => el.getBoundingClientRect().height >= 44));
  assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length), 0);
  await page.locator('#method-motion').click();
  assert.equal(await page.locator('#method-motion').getAttribute('aria-pressed'), 'true');
}, { reducedMotion: 'reduce', hasTouch: true });

await test('200% desktop reflow equivalent (720 CSS px at DPR 2)', async page => {
  for (const route of ['/research/', '/visual-cipher-bench/', '/embodiedevo/trajectories/', '/workflowarena/cases.html']) {
    await goto(page, route); assert.ok(await overflow(page) <= 2, route);
  }
}, { viewport: { width: 720, height: 500 }, deviceScaleFactor: 2 });

await test('Core research links and mobile navigation without JavaScript', async page => {
  await goto(page, '/research/');
  assert.equal(await page.locator('.lab-research-row').count(), 13);
  assert.equal(await page.locator('#lab-navigation').isVisible(), true);
  await goto(page, '/workflowarena/');
  assert.equal(await page.locator('#lab-navigation').isVisible(), true);
}, { javaScriptEnabled: false });

await browser.close();
fs.writeFileSync(path.join(out, 'interactions.json'), JSON.stringify(results, null, 2));
const failures = results.filter(result => !result.passed);
console.log(`${results.length - failures.length}/${results.length} interaction groups passed.`);
if (failures.length) process.exitCode = 1;
