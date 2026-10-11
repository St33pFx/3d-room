// End-to-end interaction checks in a real browser (software WebGL).
import { chromium } from 'playwright';
const base = process.env.URL || 'http://localhost:5173/';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
let failures = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? '✔' : '✘'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failures++;
};
const S = (fn, arg) => page.evaluate(fn, arg);
const settle = () => S(() => window.__engine.settle());
const shot = async (n) => { await settle(); await page.screenshot({ path: `screenshots/e2e-${n}.png` }); };

await page.goto(base + '?fixedpr=1');
await page.waitForFunction(() => window.__store?.getState().ready, null, { timeout: 240000 });
await S(() => { window.__engine.paused = true; });
check('welcome dialog shown on first visit', await page.isVisible('text=Bienvenido a Atelier'));
await page.click('.modal .preset-card >> nth=0');
check('welcome closes', !(await page.isVisible('text=Bienvenido a Atelier')));
await settle();

// select the sofa by clicking it
let p = await S(() => window.__engine.screenOf('sofa'));
await page.mouse.click(p.x, p.y);
check('click selects sofa', (await S(() => window.__store.getState().selection?.id)) === 'sofa');
check('inspector shows the piece', await page.isVisible('.inspector >> text=Sofá Arlo'));
check('context toolbar appears', await page.isVisible('.ctx-bar'));

// drag the sofa straight into the coffee table: it must slide, never overlap
const coffee = await S(() => window.__engine.screenOf('coffee'));
const before = await S(() => window.__store.getState().doc.items.find((i) => i.id === 'sofa').position);
await page.mouse.move(p.x, p.y);
await page.mouse.down();
for (let i = 1; i <= 12; i++) await page.mouse.move(p.x + ((coffee.x - p.x) * i) / 12, p.y + ((coffee.y + 80 - p.y) * i) / 12);
check('drag shows smart overlay state', (await S(() => !!window.__store.getState().gesture)));
await page.mouse.up();
const after = await S(() => window.__store.getState().doc.items.find((i) => i.id === 'sofa').position);
check('sofa moved', Math.hypot(after[0] - before[0], after[2] - before[2]) > 0.05, JSON.stringify(after.map((v) => +v.toFixed(2))));
check('no intersections after drag', (await S(() => window.__engine.validate())).length === 0, JSON.stringify(await S(() => window.__engine.validate())));
await shot('drag');
await page.keyboard.press('Control+z');
const undone = await S(() => window.__store.getState().doc.items.find((i) => i.id === 'sofa').position);
check('undo restores position', Math.abs(undone[2] - before[2]) < 1e-6 && Math.abs(undone[0] - before[0]) < 1e-6);
await page.keyboard.press('Control+Shift+z');
const redone = await S(() => window.__store.getState().doc.items.find((i) => i.id === 'sofa').position);
check('redo re-applies', Math.abs(redone[2] - after[2]) < 1e-6);
await page.keyboard.press('Control+z');

// rotate with keyboard
const rot0 = await S(() => window.__store.getState().doc.items.find((i) => i.id === 'sofa').rotation);
await page.keyboard.press('q');
const rot1 = await S(() => window.__store.getState().doc.items.find((i) => i.id === 'sofa').rotation);
check('Q rotates (or refuses if blocked)', rot1 !== rot0 || (await page.isVisible('text=No hay espacio para girarlo')));
check('no intersections after rotate', (await S(() => window.__engine.validate())).length === 0);

// select a dining chair, duplicate & delete
await settle();
p = await S(() => window.__engine.screenOf('chair-s'));
await page.mouse.click(p.x, p.y);
const sel = await S(() => window.__store.getState().selection?.id);
check('click selects chair', sel === 'chair-s', sel);
const n0 = await S(() => window.__store.getState().doc.items.length);
await page.keyboard.press('Control+d');
const n1 = await S(() => window.__store.getState().doc.items.length);
check('Ctrl+D duplicates', n1 === n0 + 1);
check('duplicate placed without collisions', (await S(() => window.__engine.validate())).length === 0);
await page.keyboard.press('Delete');
check('Delete removes', (await S(() => window.__store.getState().doc.items.length)) === n0);

// change a material from the inspector
p = await S(() => window.__engine.screenOf('lounge'));
await page.mouse.click(p.x, p.y);
await page.click('.inspector .swatch[aria-label="Piel negra"]');
check('material swatch applies', (await S(() => window.__store.getState().doc.items.find((i) => i.id === 'lounge').materials.cushion)) === 'leather-black');

// click a wall → wall finish
await page.keyboard.press('Escape');
const wallPt = await S(() => window.__engine.screenPoint(0.6, 2.2, -2.8));
await page.mouse.click(wallPt.x, wallPt.y);
check('clicking a wall selects it', (await S(() => window.__store.getState().selection?.kind)) === 'wall');
await page.click('.inspector .swatch[aria-label="Salvia"]');
check('wall finish changes', (await S(() => window.__store.getState().doc.finishes.walls.north)) === 'paint-sage');
await shot('wall');
await page.keyboard.press('Control+z');

// add from the library (click)
await page.keyboard.press('Escape');
await page.click('.chip:has-text("Plantas")');
const n2 = await S(() => window.__store.getState().doc.items.length);
await page.click('.lib-card:has-text("Sansevieria")');
check('library click adds an item', (await S(() => window.__store.getState().doc.items.length)) === n2 + 1);
check('added item does not intersect', (await S(() => window.__engine.validate())).length === 0);

// drag from the library into the room
await page.click('.chip:has-text("Asientos")');
const card = await page.locator('.lib-card:has-text("Puf Moon")').boundingBox();
const target = await S(() => window.__engine.screenPoint(0.6, 0, 1.6));
await page.mouse.move(card.x + 40, card.y + 40);
await page.mouse.down();
for (let i = 1; i <= 15; i++) await page.mouse.move(card.x + 40 + ((target.x - card.x - 40) * i) / 15, card.y + 40 + ((target.y - card.y - 40) * i) / 15);
await page.mouse.up();
const pouf = await S(() => window.__store.getState().doc.items.find((i) => i.type === 'ottoman'));
check('drag from library places item', !!pouf && Math.hypot(pouf.position[0] - 0.6, pouf.position[2] - 1.6) < 0.4, pouf && JSON.stringify(pouf.position.map((v) => +v.toFixed(2))));
check('dropped item does not intersect', (await S(() => window.__engine.validate())).length === 0);

// surface placement: drag a vase onto the sideboard
p = await S(() => window.__engine.screenOf('coffee-vase'));
const sb = await S(() => window.__engine.screenPoint(3.37, 0.73, -0.4));
await page.mouse.move(p.x, p.y);
await page.mouse.down();
for (let i = 1; i <= 15; i++) await page.mouse.move(p.x + ((sb.x - p.x) * i) / 15, p.y + ((sb.y - p.y) * i) / 15);
await page.mouse.up();
const vase = await S(() => window.__store.getState().doc.items.find((i) => i.id === 'coffee-vase'));
check('vase re-parents onto the sideboard', vase.parentId === 'sideboard', vase.parentId);
check('no intersections after surface drag', (await S(() => window.__engine.validate())).length === 0, JSON.stringify(await S(() => window.__engine.validate())));
await shot('surface');

// save, reload, restore
await page.keyboard.press('Control+s');
const projects = await S(() => JSON.parse(localStorage.getItem('atelier.projects.v1') || '[]').length);
check('Ctrl+S saves a project', projects === 1);
const count = await S(() => window.__store.getState().doc.items.length);
await page.waitForTimeout(800);
await page.reload();
await page.waitForFunction(() => window.__store?.getState().ready, null, { timeout: 240000 });
await S(() => { window.__engine.paused = true; });
check('autosave restores the design', (await S(() => window.__store.getState().doc.items.length)) === count);
check('no welcome after first visit', !(await page.isVisible('text=Bienvenido a Atelier')));

// projects modal
await page.click('button[title="Proyectos y plantillas"]');
check('projects modal lists saved design', await page.isVisible('.project-card'));
await page.keyboard.press('Escape');

// hide UI
await page.keyboard.press('h');
await page.waitForTimeout(700);
check('H hides the interface', await S(() => document.querySelector('.chrome').classList.contains('is-hidden')));
await shot('hidden');
await page.keyboard.press('h');

// camera modes
for (const [key, mode] of [['2', 'plan'], ['3', 'walk'], ['4', 'cinematic'], ['1', 'orbit']]) {
  await page.keyboard.press(key);
  check(`key ${key} → ${mode}`, (await S(() => window.__store.getState().camera.mode)) === mode);
  if (mode !== 'orbit') {
    await S(() => window.__engine.rig.update(3));
    await shot(mode);
  }
}

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
