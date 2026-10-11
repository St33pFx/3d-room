import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:5173/?fixedpr=1');
await page.waitForFunction(() => window.__store?.getState().ready, null, { timeout: 240000 });
await page.evaluate(() => { window.__engine.paused = true; window.__store.getState().setUI({ onboarding: false }); });
await page.waitForFunction(() => { const e = window.__engine; return ['tv','sconce','rug-rect','throw-blanket','pendant-dome','candles'].every((t) => e.thumbs.get(t)); }, null, { timeout: 600000 });
for (const c of ['tables', 'storage', 'lighting', 'plants', 'decor', 'rugs', 'wall']) {
  await page.evaluate((c) => window.__store.getState().setUI({ libraryCategory: c }), c);
  await page.waitForTimeout(300);
  await page.locator('.library').screenshot({ path: `screenshots/lib-${c}.png` });
}
await browser.close();
