import { describe, expect, it } from 'vitest';
import { createPreset, PRESETS } from '../src/core/presets';
import { isColliding, placeOnFloor, placeOnWall, findFloorSpot, worldPose, rotateItem, boxesAt, obstacles } from '../src/core/placement';
import { colliders, surfaces, itemSize } from '../src/core/catalog';
import { WALLS, wallToWorld, worldToWall, wallFacingRotation, doorClearances } from '../src/core/room';
import { overlapMTV, type Box } from '../src/core/geometry';
import { HALF_D, HALF_W } from '../src/core/room';
import type { ItemInstance } from '../src/core/types';
import type { DesignDoc } from '../src/core/types';

function sofa(doc: DesignDoc) {
  return doc.items.find((i) => i.id === 'sofa')!;
}

describe('geometry', () => {
  it('[PLC-001] detects rotated overlap and returns an MTV', () => {
    const a: Box = { cx: 0, cz: 0, hw: 1, hd: 0.5, rot: 0, y0: 0, y1: 1 };
    const b: Box = { cx: 1.5, cz: 0, hw: 1, hd: 0.5, rot: Math.PI / 4, y0: 0, y1: 1 };
    const m = overlapMTV(a, b);
    expect(m).not.toBeNull();
    const c: Box = { ...b, cx: 3 };
    expect(overlapMTV(a, c)).toBeNull();
  });
  it('[PLC-001] ignores boxes separated vertically', () => {
    const a: Box = { cx: 0, cz: 0, hw: 1, hd: 1, rot: 0, y0: 0, y1: 0.75 };
    const b: Box = { cx: 0, cz: 0, hw: 1, hd: 1, rot: 0, y0: 0.75, y1: 1 };
    expect(overlapMTV(a, b)).toBeNull();
  });
});

describe('presets', () => {
  for (const p of PRESETS) {
    it(`[PLC-017][CAT-003][DOC-006] ${p.id} has no intersecting items`, () => {
      const doc = createPreset(p.id);
      const bad = doc.items.filter((i) => isColliding(doc, i)).map((i) => i.id);
      expect(bad).toEqual([]);
    });
  }
});

describe('placement', () => {
  it('[PLC-003] keeps furniture inside the room', () => {
    const doc = createPreset('casa-luz');
    const s = sofa(doc);
    const res = placeOnFloor(doc, s, { x: 50, z: 50, rot: 0 }, 'off');
    for (const b of boxesAt(res.item, worldPose(doc, res.item))) {
      expect(b.cx + b.hw).toBeLessThanOrEqual(HALF_W + 1e-6);
      expect(b.cz + b.hd).toBeLessThanOrEqual(HALF_D + 1e-6);
    }
  });

  it('[PLC-004] never accepts an overlapping position when dragging into another item', () => {
    const doc = createPreset('casa-luz');
    const s = sofa(doc);
    const coffee = doc.items.find((i) => i.id === 'coffee')!;
    let prev: [number, number] = [s.position[0], s.position[2]];
    // drag the sofa straight through the coffee table
    for (let z = s.position[2]; z < 1.5; z += 0.05) {
      const res = placeOnFloor(doc, s, { x: coffee.position[0], z, rot: s.rotation, prev }, 'off');
      if (res.valid) {
        const moved = { ...doc, items: doc.items.map((i) => (i.id === s.id ? res.item : i)) };
        expect(isColliding(moved, res.item)).toBe(false);
        prev = [res.item.position[0], res.item.position[2]];
      }
    }
  });

  it('[PLC-005] snaps flush to walls in smart mode', () => {
    const doc = createPreset('empty');
    const it0 = { id: 'x', type: 'sideboard', position: [0, 0, 0] as [number, number, number], rotation: 0, materials: {} };
    doc.items.push(it0);
    const res = placeOnFloor(doc, it0, { x: 0, z: -HALF_D + 0.23 + 0.1, rot: 0 }, 'smart');
    expect(res.item.position[2]).toBeCloseTo(-HALF_D + 0.23 + 0.004, 3);
  });

  it('[PLC-006] auto-orients wall-loving furniture', () => {
    const doc = createPreset('empty');
    const it0 = { id: 'x', type: 'bookshelf', position: [0, 0, 0] as [number, number, number], rotation: 0, materials: {} };
    doc.items.push(it0);
    const res = placeOnFloor(doc, it0, { x: -HALF_W + 0.25, z: 0, rot: 0, autoOrient: true }, 'smart');
    expect(Math.sin(res.item.rotation)).toBeCloseTo(1, 3);
  });

  it('[PLC-009] keeps wall art off windows', () => {
    const doc = createPreset('empty');
    const art = { id: 'a', type: 'art-frame', position: [0, 0, 0] as [number, number, number], rotation: 0, materials: {}, wall: 'north' as const };
    doc.items.push(art);
    const res = placeOnWall(doc, art, { wall: 'north', u: 2.1, y: 1.5 }, 'off');
    expect(res.valid).toBe(true);
    const u = res.item.position[0] + HALF_W;
    // window A spans u 0.9..3.3 above 0.84
    const clear = u + 0.35 < 0.9 || u - 0.35 > 3.3 || res.item.position[1] + 0.5 < 0.84;
    expect(clear).toBe(true);
  });

  it('[PLC-015] finds free spots for duplicates', () => {
    const doc = createPreset('casa-luz');
    const chair = doc.items.find((i) => i.id === 'chair-n')!;
    const dup = { ...chair, id: 'dup' };
    const spot = findFloorSpot(doc, dup, chair.position[0], chair.position[2], chair.rotation);
    expect(spot).not.toBeNull();
    const next = { ...doc, items: [...doc.items, spot!] };
    expect(isColliding(next, spot!)).toBe(false);
  });

  it('[PLC-014] refuses rotations that would intersect', () => {
    const doc = createPreset('casa-luz');
    const s = sofa(doc);
    const r = rotateItem(doc, s, Math.PI / 2);
    if (r) {
      const next = { ...doc, items: doc.items.map((i) => (i.id === s.id ? r : i)) };
      expect(isColliding(next, r)).toBe(false);
    }
  });
});

const mk = (type: string, extra: Partial<ItemInstance> = {}): ItemInstance => ({ id: `t-${type}`, type, position: [0, 0, 0], rotation: 0, materials: {}, ...extra });

describe('spec anchors', () => {
  it('[ROOM-002] wall coordinates round-trip and pieces face into the room', () => {
    for (const w of Object.values(WALLS)) {
      const [x, z] = wallToWorld(w, 1.3, 0.25);
      const back = worldToWall(w, x, z);
      expect(back.u).toBeCloseTo(1.3, 6);
      expect(back.offset).toBeCloseTo(0.25, 6);
      const r = wallFacingRotation(w);
      expect(Math.sin(r)).toBeCloseTo(w.normal[0], 6);
      expect(Math.cos(r)).toBeCloseTo(w.normal[1], 6);
    }
  });

  it('[ROOM-003][PLC-002] door clearances block floor pieces but not rugs', () => {
    const doc = createPreset('empty');
    const d = doorClearances()[0];
    const chair = mk('lounge-chair', { position: [d.cx, 0, d.cz] });
    doc.items.push(chair);
    expect(isColliding(doc, chair)).toBe(true);
    const rug = mk('rug-runner', { position: [d.cx, 0, d.cz] });
    doc.items.push(rug);
    expect(isColliding(doc, rug)).toBe(false);
    expect(obstacles(doc, chair).length).toBe(doorClearances().length);
  });

  it('[PLC-008] rugs never block furniture', () => {
    const doc = createPreset('casa-luz');
    const sofa = doc.items.find((i) => i.id === 'sofa')!;
    const rug = mk('rug-rect', { position: [sofa.position[0], 0, sofa.position[2]], variant: 2 });
    doc.items.push(rug);
    const res = placeOnFloor(doc, rug, { x: sofa.position[0], z: sofa.position[2], rot: 0 }, 'off');
    expect(res.valid).toBe(true);
    expect(isColliding(doc, sofa)).toBe(false);
  });

  it('[PLC-012][DOC-002] pieces resting on furniture follow it', () => {
    const doc = createPreset('casa-luz');
    const lamp = doc.items.find((i) => i.id === 'side-lamp')!;
    const before = worldPose(doc, lamp);
    const moved = { ...doc, items: doc.items.map((i) => (i.id === 'side' ? { ...i, position: [i.position[0] + 0.5, 0, i.position[2]] as [number, number, number], rotation: 1 } : i)) };
    const after = worldPose(moved, moved.items.find((i) => i.id === 'side-lamp')!);
    expect(after.x - before.x).toBeCloseTo(0.5, 6);
    expect(after.rot).toBeCloseTo(1 + lamp.rotation, 6);
  });

  it('[PLC-013] ceiling pieces collide only with what reaches their height', () => {
    const doc = createPreset('casa-luz');
    const table = doc.items.find((i) => i.id === 'dining')!;
    const shelf = doc.items.find((i) => i.id === 'shelf')!;
    const p1 = mk('pendant-globe', { position: [table.position[0] + 0.6, 2.85, table.position[2]] });
    expect(isColliding({ ...doc, items: [...doc.items, p1] }, p1)).toBe(false);
    const p2 = mk('pendant-globe', { position: [shelf.position[0], 2.85, shelf.position[2]], variant: 1 });
    expect(isColliding({ ...doc, items: [...doc.items, p2] }, p2)).toBe(true);
  });

  it('[CAT-002] local frames per placement kind', () => {
    const [w, h, d] = itemSize('art-frame', 0);
    expect(colliders('art-frame', 0)[0]).toMatchObject({ z: d / 2, y0: -h / 2, y1: h / 2, w });
    const [, ph] = itemSize('pendant-dome', 0);
    expect(colliders('pendant-dome', 0)[0]).toMatchObject({ y0: -ph, y1: 0 });
    expect(colliders('sofa', 0)[0]).toMatchObject({ x: 0, z: 0, y0: 0 });
  });

  it('[CAT-004] furniture surfaces, with clearance on shelves', () => {
    const s = surfaces('bookshelf', 0);
    expect(s.length).toBe(5);
    expect(s.filter((x) => x.clearance !== undefined).length).toBe(4);
    expect(surfaces('sofa', 0)).toEqual([]);
    expect(surfaces('coffee-round', 0)[0].y).toBeCloseTo(itemSize('coffee-round', 0)[1], 6);
  });

  it('[PLC-005] alignment emits guides', () => {
    const doc = createPreset('casa-luz');
    const coffee = doc.items.find((i) => i.id === 'coffee')!;
    const pouf = mk('ottoman', { position: [0, 0, 1.5] });
    doc.items.push(pouf);
    const res = placeOnFloor(doc, pouf, { x: coffee.position[0] + 0.03, z: 1.5, rot: 0 }, 'smart');
    expect(res.item.position[0]).toBeCloseTo(coffee.position[0], 6);
    expect(res.guides.length).toBeGreaterThan(0);
  });
});
