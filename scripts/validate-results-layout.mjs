/** Reproduce dense table headings and repeated catalogue dividers in a production preview. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.DESIGN_CHECK_URL || 'http://127.0.0.1:4322';
const out = path.resolve(process.env.DESIGN_CHECK_OUT || '.local/design-check/results-layout');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const results = [];
const widths = [320, 390, 768, 1024, 1440];
const paint = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
async function headings(page, selector, labelSelector) {
  const metrics = await page.locator(selector).evaluateAll((cells, labelSelector) => cells.map(cell => {
    const r = cell.getBoundingClientRect();
    const label = labelSelector ? cell.querySelector(labelSelector) : cell;
    const range = document.createRange();
    range.selectNodeContents(label);
    const text = range.getBoundingClientRect();
    const lines = new Set([...range.getClientRects()].map(rect => Math.round(rect.top)));
    return { label: label.textContent.trim(), overflow: Math.max(r.left - text.left, text.right - r.right, 0), lines: lines.size };
  }), labelSelector);
  for (const metric of metrics) {
    assert.ok(metric.overflow < 1, `heading overflows: ${metric.label}`);
    assert.equal(metric.lines, 1, `heading unexpectedly wraps: ${metric.label}`);
  }
  return metrics;
}
async function checkClosingDivider(page) {
  const boundary = await page.evaluate(() => {
    const catalogue = document.querySelector('.phys-catalog');
    const section = catalogue.closest('section');
    const rows = [...catalogue.querySelectorAll('.phys-task')].filter(row => row.getClientRects().length);
    const borders = [rows.at(-1), catalogue, section].filter(Boolean).map(element => parseFloat(getComputedStyle(element).borderBottomWidth));
    const next = document.querySelector('#videos h2').getBoundingClientRect();
    return { closingBorders: borders.filter(width => width > 0).length, gap: next.top - catalogue.getBoundingClientRect().bottom };
  });
  assert.equal(boundary.closingBorders, 1, 'duplicate closing dividers');
  assert.ok(boundary.gap >= 32 && boundary.gap <= 90, 'excessive or missing space before Video explorer');
  return boundary;
}
try {
  for (const route of ['/embodiedevo/', '/embodied-rsi/']) {
    const page = await browser.newPage({ hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    await page.goto(base + route);
    await page.evaluate(() => document.fonts.ready);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      await paint(page);
      const metrics = await headings(page, '.lb-metric-column', 'button > span:first-child');
      const cells = await page.locator('.lb-metric-cell').evaluateAll(cells => cells.map(cell => {
        const r = cell.getBoundingClientRect();
        const head = cell.closest('table').querySelector(`th[data-lb-column="${cell.dataset.lbColumn}"]`).getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(cell);
        const text = range.getBoundingClientRect();
        return Math.max(Math.abs(head.left - r.left), Math.abs(head.right - r.right), r.left - text.left, text.right - r.right);
      }));
      assert.ok(cells.every(delta => delta < 1), 'metric text overflow or misaligned data column');
      assert.equal(await noOverflow(page), true);
      for (const button of await page.locator('[data-lb-sort]').all()) {
        await button.scrollIntoViewIfNeeded();
        assert.equal(await button.evaluate(button => {
          const r = button.getBoundingClientRect();
          return r.height >= 44 && button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }), true, 'sort control is too small or covered by the model column');
      }
      if (route === '/embodiedevo/' && [390, 1440].includes(width)) {
        await page.locator('[data-lb-sort="1"]').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(out, `embodiedevo-${width}.png`) });
      }
      results.push({ route, width, metrics, aligned: true });
    }
    for (const width of [720, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.locator('[data-lb-sort="0"]').focus();
      const sequence = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0];
      for (const [index, dimension] of sequence.entries()) {
        if (index) await page.keyboard.press(dimension > sequence[index - 1] ? 'Tab' : 'Shift+Tab');
        assert.equal(await page.locator(':focus').getAttribute('data-lb-sort'), String(dimension));
        const position = await page.locator(':focus').evaluate(button => {
          const r = button.getBoundingClientRect();
          const viewport = button.closest('.lb-table-scroll').getBoundingClientRect();
          const model = button.closest('tr').querySelector('.lb-model-column');
          const start = getComputedStyle(model).position === 'sticky' ? model.getBoundingClientRect().right : viewport.left;
          return { left: r.left, right: r.right, start, end: viewport.right,
            visible: r.left - 4 >= start - 1 && r.right + 4 <= viewport.right + 1
              && button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) };
        });
        assert.equal(position.visible, true, `${route} ${width}px column ${dimension}: keyboard focus clipped: ${JSON.stringify(position)}`);
      }
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('th[data-lb-column="0"]').getAttribute('aria-sort'), width === 720 ? 'ascending' : 'descending');
      assert.equal(await noOverflow(page), true);
      results.push({ route, width, keyboardSorts: true });
    }
    for (const metric of ['score', 'success']) {
      await page.locator(`[data-lb-metric="${metric}"]`).click();
      for (const button of await page.locator('[data-lb-sort]').all()) {
        const dimension = Number(await button.getAttribute('data-lb-sort'));
        for (let repeat = 0; repeat < 2; repeat++) {
          await button.click();
          const descending = await button.locator('..').getAttribute('aria-sort') === 'descending';
          const values = await page.locator('[data-lb-row]:visible').evaluateAll((rows, { dimension, metric }) => rows.map(row => JSON.parse(row.dataset.lbValues)[dimension][metric]), { dimension, metric });
          assert.deepEqual(values, [...values].sort((a, b) => descending ? b - a : a - b));
        }
      }
    }
    await page.locator('#lb-type').selectOption('Agent');
    assert.equal(await page.locator('[data-lb-row]:visible').evaluateAll(rows => rows.every(row => row.dataset.lbType === 'Agent')), true);
    await page.locator('#lb-reset').click();
    assert.equal(await page.locator('[data-lb-row]:visible').count(), 7);
    assert.equal(await page.locator('#lb-reset').isDisabled(), true);
    await page.close();
    console.log(`PASS ${route}: five widths, every header and data cell, touch and keyboard controls, both metrics/all column sorts/filter/reset.`);
  }
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await page.goto(base + '/phys-last-exam/');
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.phys-catalog > summary').click();
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 });
    await paint(page);
    const metrics = await headings(page, '.phys-paper-table thead th');
    assert.equal(await noOverflow(page), true);
    const boundary = await checkClosingDivider(page);
    await page.locator('.phys-table-scroll').evaluate(scroll => { scroll.scrollLeft = scroll.scrollWidth; });
    await page.locator('.phys-paper-table thead th').last().scrollIntoViewIfNeeded();
    assert.equal(await page.locator('.phys-paper-table thead th').last().evaluate(cell => {
      const r = cell.getBoundingClientRect(); const viewport = cell.closest('.phys-table-scroll').getBoundingClientRect();
      return r.left >= viewport.left && r.right <= viewport.right + 1;
    }), true);
    if ([390, 1440].includes(width)) {
      await page.locator('.phys-table-scroll').evaluate(scroll => { scroll.scrollLeft = 0; });
      await page.screenshot({ path: path.join(out, `phys-headers-${width}.png`) });
      await page.locator('#videos h2').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(out, `phys-divider-${width}.png`) });
    }
    results.push({ route: '/phys-last-exam/', width, metrics, boundary });
  }
  for (const query of ['P40', 'no-matching-task', '']) {
    await page.locator('#phys-task-search').fill(query);
    assert.equal(await page.locator('.phys-task:visible').count(), query === 'P40' ? 1 : query ? 0 : 40);
    assert.equal(await page.locator('#phys-task-empty').isVisible(), query === 'no-matching-task');
    await checkClosingDivider(page);
  }
  await page.locator('.phys-task').last().locator(':scope > summary').click();
  assert.equal(await page.locator('.phys-task').last().evaluate(task => task.open), true);
  await checkClosingDivider(page);
  await page.locator('.phys-catalog > summary').click();
  await checkClosingDivider(page);
  await page.close();
  results.push({ catalogueFilters: true, emptyState: true, expandedTask: true, collapsedCatalogue: true });
  console.log('PASS PhysLastExam: model headings stay on one line at five widths; one closing divider with full, filtered, empty and collapsed task lists.');
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
}
