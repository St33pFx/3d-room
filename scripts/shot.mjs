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
for (const snippet of js) {
  try { const r = await page.evaluate(snippet); if (r !== undefined) logs.push(`[eval] ${JSON.stringify(r)}`); } catch (e) { logs.push(`[evalerr] ${e.message}`); }
  await page.waitForTimeout(500);
}
await page.waitForTimeout(+wait);
await page.evaluate(() => window.__engine?.settle());
const t0 = Date.now(); const fc0 = await page.evaluate(() => window.__engine?.frameCount); await page.waitForTimeout(1000); const fc1 = await page.evaluate(() => window.__engine?.frameCount); logs.push(`fps≈ ${((fc1 - fc0) / ((Date.now() - t0) / 1000)).toFixed(2)}`);
await page.screenshot({ path: out, timeout: 180000 });
console.log(logs.slice(0, 60).join('\n'));
await browser.close();
