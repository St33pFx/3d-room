// End-to-end interaction checks in a real browser (software WebGL).
import { chromium } from 'playwright';
const base = process.env.URL || 'http://localhost:5173/';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
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
check('[UI-008] welcome dialog shown on first visit', await page.isVisible('text=Bienvenido a Atelier'));
await page.click('.modal .preset-card >> nth=0');
check('[UI-008] welcome closes', !(await page.isVisible('text=Bienvenido a Atelier')));
await settle();
check('[ARCH-003] test hooks are exposed', await S(() => ['settle', 'screenOf', 'screenPoint', 'validate', 'addFromLibrary', 'screenshot'].every((k) => typeof window.__engine[k] === 'function') && typeof window.__store.getState === 'function'));
check('[CAM-008] walls facing the camera are cut away', await S(() => window.__engine.shell.isCut('south') && !window.__engine.shell.isCut('north') && window.__engine.shell.ceiling.material.name === 'ghost'));

// select the sofa by clicking it
let p = await S(() => window.__engine.screenOf('sofa'));
await page.mouse.click(p.x, p.y);
check('[EDIT-001] click selects sofa', (await S(() => window.__store.getState().selection?.id)) === 'sofa');
check('[UI-005] inspector shows the piece', await page.isVisible('.inspector >> text=Sofá Arlo'));
check('[UI-007] context toolbar appears', await page.isVisible('.ctx-bar'));

// drag the sofa straight into the coffee table: it must slide, never overlap
const coffee = await S(() => window.__engine.screenOf('coffee'));
const before = await S(() => window.__store.getState().doc.items.find((i) => i.id === 'sofa').position);
await page.mouse.move(p.x, p.y);
await page.mouse.down();
for (let i = 1; i <= 12; i++) await page.mouse.move(p.x + ((coffee.x - p.x) * i) / 12, p.y + ((coffee.y + 80 - p.y) * i) / 12);
check('[EDIT-002] drag shows smart overlay state', (await S(() => !!window.__store.getState().gesture)));
await page.mouse.up();
const after = await S(() => window.__store.getState().doc.items.find((i) => i.id === 'sofa').position);
check('[PLC-004] sofa moved', Math.hypot(after[0] - before[0], after[2] - before[2]) > 0.05, JSON.stringify(after.map((v) => +v.toFixed(2))));
check('[PLC-004] no intersections after drag', (await S(() => window.__engine.validate())).length === 0, JSON.stringify(await S(() => window.__engine.validate())));
await shot('drag');
await page.keyboard.press('Control+z');
const undone = await S(() => window.__store.getState().doc.items.find((i) => i.id === 'sofa').position);
check('[HIST-001] undo restores position', Math.abs(undone[2] - before[2]) < 1e-6 && Math.abs(undone[0] - before[0]) < 1e-6);
await page.keyboard.press('Control+Shift+z');
const redone = await S(() => window.__store.getState().doc.items.find((i) => i.id === 'sofa').position);
check('[HIST-001] redo re-applies', Math.abs(redone[2] - after[2]) < 1e-6);
await page.keyboard.press('Control+z');

// rotate with keyboard
const rot0 = await S(() => window.__store.getState().doc.items.find((i) => i.id === 'sofa').rotation);
await page.keyboard.press('q');
const rot1 = await S(() => window.__store.getState().doc.items.find((i) => i.id === 'sofa').rotation);
check('[PLC-014] Q rotates (or refuses if blocked)', rot1 !== rot0 || (await page.isVisible('text=No hay espacio para girarlo')));
check('[PLC-014] no intersections after rotate', (await S(() => window.__engine.validate())).length === 0);

// select a dining chair, duplicate & delete
await settle();
p = await S(() => window.__engine.screenOf('chair-s'));
await page.mouse.click(p.x, p.y);
const sel = await S(() => window.__store.getState().selection?.id);
check('[EDIT-001] click selects chair', sel === 'chair-s', sel);
const n0 = await S(() => window.__store.getState().doc.items.length);
await page.keyboard.press('Control+d');
const n1 = await S(() => window.__store.getState().doc.items.length);
check('[EDIT-007] Ctrl+D duplicates', n1 === n0 + 1);
check('[PLC-015] duplicate placed without collisions', (await S(() => window.__engine.validate())).length === 0);
await page.keyboard.press('Delete');
check('[EDIT-007] Delete removes', (await S(() => window.__store.getState().doc.items.length)) === n0);

// change a material from the inspector
p = await S(() => window.__engine.screenOf('lounge'));
await page.mouse.click(p.x, p.y);
await page.click('.inspector .swatch[aria-label="Piel negra"]');
check('[EDIT-011] material swatch applies', (await S(() => window.__store.getState().doc.items.find((i) => i.id === 'lounge').materials.cushion)) === 'leather-black');

// click a wall → wall finish
await page.keyboard.press('Escape');
const wallPt = await S(() => window.__engine.screenPoint(0.6, 2.2, -2.8));
await page.mouse.click(wallPt.x, wallPt.y);
check('[EDIT-001] clicking a wall selects it', (await S(() => window.__store.getState().selection?.kind)) === 'wall');
await page.click('.inspector .swatch[aria-label="Salvia"]');
check('[EDIT-011] wall finish changes', (await S(() => window.__store.getState().doc.finishes.walls.north)) === 'paint-sage');
await shot('wall');
await page.keyboard.press('Control+z');

// snapping modes and shortcuts
await page.keyboard.press('g');
check('[PLC-007][UI-009] G cycles the snap mode', (await S(() => window.__store.getState().ui.snap)) === 'grid');
await page.keyboard.press('g');
await page.keyboard.press('g');
check('[PLC-007] snap mode cycles back to smart', (await S(() => window.__store.getState().ui.snap)) === 'smart');
await page.keyboard.press('?');
check('[UI-009][UI-008] ? opens the shortcuts', await page.isVisible('text=Atajos de teclado'));
await page.keyboard.press('Escape');
await page.fill('.search input', 'olivo');
check('[UI-004] library search filters by name', (await page.locator('.lib-card').count()) === 1);
await page.fill('.search input', '');

// add from the library (click)
await page.keyboard.press('Escape');
await page.click('.chip:has-text("Plantas")');
const n2 = await S(() => window.__store.getState().doc.items.length);
await page.click('.lib-card:has-text("Sansevieria")');
check('[EDIT-005] library click adds an item', (await S(() => window.__store.getState().doc.items.length)) === n2 + 1);
check('[PLC-015] added item does not intersect', (await S(() => window.__engine.validate())).length === 0);

// drag from the library into the room
await page.click('.chip:has-text("Asientos")');
const card = await page.locator('.lib-card:has-text("Puf Moon")').boundingBox();
const target = await S(() => window.__engine.screenPoint(0.6, 0, 1.6));
await page.mouse.move(card.x + 40, card.y + 40);
await page.mouse.down();
for (let i = 1; i <= 15; i++) await page.mouse.move(card.x + 40 + ((target.x - card.x - 40) * i) / 15, card.y + 40 + ((target.y - card.y - 40) * i) / 15);
await page.mouse.up();
const pouf = await S(() => window.__store.getState().doc.items.find((i) => i.type === 'ottoman'));
check('[EDIT-005] drag from library places item', !!pouf && Math.hypot(pouf.position[0] - 0.6, pouf.position[2] - 1.6) < 0.4, pouf && JSON.stringify(pouf.position.map((v) => +v.toFixed(2))));
check('[PLC-016] dropped item does not intersect', (await S(() => window.__engine.validate())).length === 0);

// surface placement: drag a vase onto the sideboard
p = await S(() => window.__engine.screenOf('coffee-vase'));
const sb = await S(() => window.__engine.screenPoint(3.37, 0.73, -0.4));
await page.mouse.move(p.x, p.y);
await page.mouse.down();
for (let i = 1; i <= 15; i++) await page.mouse.move(p.x + ((sb.x - p.x) * i) / 15, p.y + ((sb.y - p.y) * i) / 15);
await page.mouse.up();
const vase = await S(() => window.__store.getState().doc.items.find((i) => i.id === 'coffee-vase'));
check('[PLC-011] vase re-parents onto the sideboard', vase.parentId === 'sideboard', vase.parentId);
check('[PLC-011] no intersections after surface drag', (await S(() => window.__engine.validate())).length === 0, JSON.stringify(await S(() => window.__engine.validate())));
await shot('surface');

// wall art slides along the wall and never covers the window
p = await S(() => window.__engine.screenOf('art-living'));
const leftOfWall = await S(() => window.__engine.screenPoint(-1.6, 1.62, -2.8));
await page.mouse.move(p.x, p.y);
await page.mouse.down();
for (let i = 1; i <= 15; i++) await page.mouse.move(p.x + ((leftOfWall.x - p.x) * i) / 15, p.y + ((leftOfWall.y - p.y) * i) / 15);
await page.mouse.up();
const art = await S(() => window.__store.getState().doc.items.find((i) => i.id === 'art-living'));
const artU = art.position[0] + 3.6;
check('[PLC-010] art stays on its wall', art.wall === 'north' && Math.abs(art.position[2] + 2.8) < 1e-6);
check('[PLC-009] art does not overlap the window', artU - 0.35 >= 3.3 || artU + 0.35 <= 0.9 || art.position[1] + 0.5 <= 0.84, `u=${artU.toFixed(2)} y=${art.position[1].toFixed(2)}`);
check('[PLC-009] no intersections after wall drag', (await S(() => window.__engine.validate())).length === 0);

// rotate with the ring handle
p = await S(() => window.__engine.screenOf('tub'));
await page.mouse.click(p.x, p.y);
await settle();
const tub0 = await S(() => window.__store.getState().doc.items.find((i) => i.id === 'tub'));
const h = await S(() => { const e = window.__engine; const hd = e.overlays.handle.position; return e.screenPoint(hd.x, hd.y, hd.z); });
const c = await S(() => { const t = window.__store.getState().doc.items.find((i) => i.id === 'tub'); return window.__engine.screenPoint(t.position[0], 0, t.position[2]); });
await page.mouse.move(h.x, h.y);
await page.mouse.down();
const r0 = Math.hypot(h.x - c.x, h.y - c.y);
const a0 = Math.atan2(h.y - c.y, h.x - c.x);
for (let i = 1; i <= 12; i++) { const a = a0 + (i / 12) * 1.2; await page.mouse.move(c.x + Math.cos(a) * r0, c.y + Math.sin(a) * r0); }
await page.mouse.up();
const tub1 = await S(() => window.__store.getState().doc.items.find((i) => i.id === 'tub'));
const stepDeg = ((tub1.rotation - tub0.rotation) * 180) / Math.PI;
check('[EDIT-003] handle rotates the piece', Math.abs(stepDeg) > 10, `${stepDeg.toFixed(1)}°`);
check('[PLC-014] rotation snaps to 15°', Math.abs(stepDeg / 15 - Math.round(stepDeg / 15)) < 1e-3 || Math.abs(((tub1.rotation * 180) / Math.PI) / 15 - Math.round(((tub1.rotation * 180) / Math.PI) / 15)) < 1e-3);
check('[PLC-014] no intersections after rotating', (await S(() => window.__engine.validate())).length === 0);

// saved views
await page.click('button[title="Vistas guardadas"]');
await page.click('text=Guardar vista actual');
check('[CAM-007] view bookmark saved', (await S(() => window.__store.getState().doc.bookmarks.length)) === 1);
await page.click('button[title="Vistas guardadas"]');

// time of day
await page.click('button[title="Más ajustes de luz"]');
await page.click('.light-pop .chip:has-text("Atardecer")');
check('[UI-006] time preset applies', Math.abs((await S(() => window.__store.getState().env.time)) - 19.6) < 0.01);
await page.click('button[title="Más ajustes de luz"]');
await shot('sunset');

// precise position from the inspector
await S(() => window.__store.getState().select({ kind: 'item', id: window.__store.getState().doc.items.find((i) => i.type === 'ottoman').id }));
await page.click('.insp-section-head:has-text("Posición")');
const xInput = page.locator('.num-field:has-text("X") input');
await xInput.fill('1.2');
await xInput.press('Enter');
const ott = await S(() => window.__store.getState().doc.items.find((i) => i.type === 'ottoman'));
check('[EDIT-009] typing X moves the piece', Math.abs(ott.position[0] - 1.2) < 0.05, ott.position[0].toFixed(3));
await xInput.fill('-50');
await xInput.press('Enter');
const ott2 = await S(() => window.__store.getState().doc.items.find((i) => i.type === 'ottoman'));
check('[PLC-003] out-of-room values are clamped inside', ott2.position[0] > -3.6, ott2.position[0].toFixed(3));
check('[EDIT-009] no intersections after typed move', (await S(() => window.__engine.validate())).length === 0);

// clean PNG capture
const [download] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.keyboard.press('p')]);
const file = await download.path();
const { statSync } = await import('node:fs');
check('[CAP-002] P downloads a PNG capture', download.suggestedFilename().endsWith('.png') && statSync(file).size > 50000, `${download.suggestedFilename()} ${(statSync(file).size / 1024).toFixed(0)} KB`);

// save, reload, restore
await page.keyboard.press('Control+s');
const projects = await S(() => JSON.parse(localStorage.getItem('atelier.projects.v1') || '[]').length);
check('[PERS-002] Ctrl+S saves a project', projects === 1);
const count = await S(() => window.__store.getState().doc.items.length);
await page.waitForTimeout(800);
await page.reload();
await page.waitForFunction(() => window.__store?.getState().ready, null, { timeout: 240000 });
await S(() => { window.__engine.paused = true; });
check('[PERS-001] autosave restores the design', (await S(() => window.__store.getState().doc.items.length)) === count);
check('[PERS-001] no welcome after first visit', !(await page.isVisible('text=Bienvenido a Atelier')));

// projects modal
await page.click('button[title="Proyectos y plantillas"]');
check('[PERS-002] projects modal lists saved design', await page.isVisible('.project-card'));
await page.keyboard.press('Escape');

// hide UI
await page.keyboard.press('h');
await page.waitForTimeout(700);
check('[CAP-001] H hides the interface', await S(() => document.querySelector('.chrome').classList.contains('is-hidden')));
await shot('hidden');
await page.keyboard.press('h');

// camera modes
for (const [key, mode] of [['2', 'plan'], ['3', 'walk'], ['4', 'cinematic'], ['1', 'orbit']]) {
  await page.keyboard.press(key);
  check(`[CAM-001][UI-009] key ${key} → ${mode}`, (await S(() => window.__store.getState().camera.mode)) === mode);
  if (mode !== 'orbit') {
    await S(() => window.__engine.rig.update(3));
    await shot(mode);
  }
}

// cinematic mode
await page.keyboard.press('4');
await page.waitForTimeout(1400); // letterbox bars animate in
check('[CAM-005] cinema shows letterbox and shot title', (await page.isVisible('.letterbox.top')) && (await page.isVisible('.shot-name')));
await page.keyboard.press('Escape');
check('[CAM-005] Esc leaves cinema', (await S(() => window.__store.getState().camera.mode)) === 'orbit');

// switching template must keep the cut-away ceiling hidden
await S(() => window.__store.getState().newFromPreset('terracota'));
await settle();
check('[ROOM-005] finishes change without revealing cut-away surfaces', await S(() => window.__engine.shell.ceiling.material.name === 'ghost' && window.__store.getState().doc.finishes.floor === 'floor-terrazzo'));
await page.keyboard.press('Control+z');

check('[UI-013] no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
