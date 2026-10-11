// Usage: node scripts/shot.mjs <url-suffix> <out.png> [waitMs] [w] [h] [js...]
import { chromium } from 'playwright';
const [, , suffix = '', out = 'shot.png', wait = '6000', w = '1440', h = '900', ...js] = process.argv;
const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(`http://localhost:5173/${suffix}`, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('.scene-canvas') && !document.querySelector('.loading'), null, { timeout: 180000 }).catch(() => logs.push('timeout waiting ready'));
await page.evaluate(() => { if (window.__engine) window.__engine.paused = true; });
for (const snippet of js) {
  try { const r = await page.evaluate(snippet); if (r !== undefined) logs.push(`[eval] ${JSON.stringify(r)}`); } catch (e) { logs.push(`[evalerr] ${e.message}`); }
  await page.waitForTimeout(500);
}
await page.waitForTimeout(+wait);
const t0 = Date.now();
await page.evaluate(() => window.__engine?.settle());
await page.evaluate(() => window.__engine?.settle());
logs.push(`settle x2: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
await page.screenshot({ path: out, timeout: 180000 });
console.log(logs.slice(0, 60).join('\n'));
await browser.close();
