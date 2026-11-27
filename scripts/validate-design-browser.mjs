/** Browser regression sweep for the shared design. Requires Playwright and Chrome.
 * PLAYWRIGHT_MODULE may point to an isolated install; no browser package is shipped. */
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.DESIGN_CHECK_URL || 'http://localhost:4321';
const out = path.resolve(process.env.DESIGN_CHECK_OUT || '.local/design-check');
fs.mkdirSync(out, { recursive: true });
const defaultRoutes = ['/', '/research/', '/about/', '/404/', '/visual-cipher-bench/', '/swe-refactor-bench/', '/swe-refactor-bench/leaderboard/', '/swe-refactor-bench/runs/', '/swe-refactor-bench/tasks/', '/frontier-eng/', '/frontier-eng/leaderboard/', '/frontier-eng/tasks/', '/frontier-eng/contact/', '/frontier3d/', '/frontier3dbench/', '/frontier3dbench/evaluation/', '/embodiedevo/', '/embodiedevo/details/', '/embodiedevo/trajectories/', '/embodied-rsi/', '/embodied-rsi/details/', '/embodied-rsi/trajectories/', '/pptbench/', '/pptbench/leaderboard/', '/quant-arena/', '/quant-arena/leaderboard/', '/browserbc/', '/browserbc/cases/', '/browserbc/contact/', '/openchronicle/', '/phys-last-exam/', '/ai4ai/', '/ai4ai/tasks/', '/ai4ai/trajectories/', '/robo-universe/', '/robo-universe/tasks.html', '/robouniverse/', '/workflowarena/', '/workflowarena/cases.html', '/workflowarena/video/', '/workflowarena/3d/cases/palace/', '/workflowarena/four-models-workflows.html'];
defaultRoutes.push('/ai4ai/tasks/ddpo_sd15_aesthetic/', '/ai4ai/trajectories/claude__ddpo_sd15_aesthetic__claude-opus-5__max/', '/ai4ai/trajectories/claude__ragen_sokoban_grpo__claude-opus-5__high/', '/frontier-eng/tasks/abz/', '/swe-refactor-bench/tasks/build01-libsodium-autotools-to-cmake/', '/robouniverse/tasks.html');
const routes = process.argv.slice(2).length ? process.argv.slice(2) : defaultRoutes;
const widths = [320, 390, 768, 1024, 1440];
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const results = [];
let index = 0;
async function worker() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  let errors = [];
  page.on('pageerror', error => errors.push(error.message));
  while (index < routes.length) {
    const route = routes[index++]; errors = [];
    try {
      const response = await page.goto(base + route, { waitUntil: 'networkidle', timeout: 45000 }).catch(async error => {
        if (error.name !== 'TimeoutError') throw error;
        await page.waitForSelector('h1', { timeout: 5000 }); return null;
      });
      await page.evaluate(() => document.fonts.ready);
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const metrics = await page.evaluate(() => {
          const visible = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[hidden],[aria-hidden=true],svg,canvas');
          const label = el => `${el.tagName.toLowerCase()}${el.id ? '#'+el.id : ''}${typeof el.className === 'string' && el.className ? '.'+el.className.trim().split(/\s+/).join('.') : ''}`;
          const elements = [...document.body.querySelectorAll('*')].filter(visible);
          const text = elements.filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
          const h1 = document.querySelector('h1');
          return {
            title: h1?.textContent.trim(), h1Count: document.querySelectorAll('h1').length,
            h1Font: h1 ? getComputedStyle(h1).font : null, bodyFont: getComputedStyle(document.body).fontFamily,
            background: getComputedStyle(document.body).backgroundColor,
            overflow: Math.max(document.body.scrollWidth,document.documentElement.scrollWidth) - innerWidth,
            offenders: elements.filter(el => el.getBoundingClientRect().right > innerWidth + 2 && !el.parentElement?.closest('svg')).slice(0,12).map(el => ({element:label(el),right:Math.round(el.getBoundingClientRect().right)})),
            small: text.filter(el => parseFloat(getComputedStyle(el).fontSize) < 12 && !el.matches('sup,sub')).slice(0,30).map(el => ({element:label(el),font:getComputedStyle(el).fontSize,text:el.textContent.trim().slice(0,50)})),
            legacyFonts: text.filter(el => /Georgia|Inter Variable|Times New Roman/.test(getComputedStyle(el).fontFamily)).slice(0,20).map(el => ({element:label(el),font:getComputedStyle(el).fontFamily})),
            playingVideos: [...document.querySelectorAll('video')].filter(v => !v.paused).length,
            animations: elements.filter(el => getComputedStyle(el).animationName !== 'none' && el.getAnimations().some(animation => animation.playState === 'running')).slice(0,10).map(el => ({element:label(el),name:getComputedStyle(el).animationName})),
          };
        });
        results.push({ route, width, status: response?.status() ?? null, errors: [...new Set(errors)], ...metrics });
        if ((width === 390 || width === 1440) && ['/', '/research/', '/frontier3d/', '/robo-universe/', '/embodiedevo/', '/workflowarena/', '/pptbench/', '/visual-cipher-bench/'].includes(route)) {
          await page.screenshot({ path: path.join(out, (route.replaceAll('/', '_') || 'home') + width + '.png') });
        }
      }
      console.log(`${route}: ${results.filter(r => r.route === route && r.overflow > 2).map(r => `${r.width}px +${r.overflow}`).join(', ') || 'no page overflow'}`);
    } catch (error) { results.push({ route, error: error.message }); console.log(`${route}: ${error.message.split('\n')[0]}`); }
  }
  await page.close();
}
await Promise.all([worker(), worker(), worker()]);
await browser.close();
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
const failures = results.filter(r => r.error || r.overflow > 2 || r.errors?.length || r.playingVideos || r.small?.length || r.legacyFonts?.length || r.animations?.length || (r.status >= 400 && !r.route.startsWith('/404')));
console.log(`${results.length} viewport checks; ${failures.length} need review. Results: ${out}/results.json`);
if (failures.length) process.exitCode = 1;
