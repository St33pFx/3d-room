import { describe, expect, it } from 'vitest';
import { createPreset, PRESETS } from '../src/core/presets';
import { isColliding, placeOnFloor, placeOnWall, findFloorSpot, worldPose, rotateItem, boxesAt } from '../src/core/placement';
import { overlapMTV, type Box } from '../src/core/geometry';
import { HALF_D, HALF_W } from '../src/core/room';
import type { DesignDoc } from '../src/core/types';

function sofa(doc: DesignDoc) {
  return doc.items.find((i) => i.id === 'sofa')!;
}

describe('geometry', () => {
  it('detects rotated overlap and returns an MTV', () => {
    const a: Box = { cx: 0, cz: 0, hw: 1, hd: 0.5, rot: 0, y0: 0, y1: 1 };
    const b: Box = { cx: 1.5, cz: 0, hw: 1, hd: 0.5, rot: Math.PI / 4, y0: 0, y1: 1 };
    const m = overlapMTV(a, b);
    expect(m).not.toBeNull();
    const c: Box = { ...b, cx: 3 };
    expect(overlapMTV(a, c)).toBeNull();
  });
  it('ignores boxes separated vertically', () => {
    const a: Box = { cx: 0, cz: 0, hw: 1, hd: 1, rot: 0, y0: 0, y1: 0.75 };
    const b: Box = { cx: 0, cz: 0, hw: 1, hd: 1, rot: 0, y0: 0.75, y1: 1 };
    expect(overlapMTV(a, b)).toBeNull();
  });
});

describe('presets', () => {
  for (const p of PRESETS) {
    it(`${p.id} has no intersecting items`, () => {
      const doc = createPreset(p.id);
      const bad = doc.items.filter((i) => isColliding(doc, i)).map((i) => i.id);
      expect(bad).toEqual([]);
    });
  }
});

describe('placement', () => {
  it('keeps furniture inside the room', () => {
    const doc = createPreset('casa-luz');
    const s = sofa(doc);
    const res = placeOnFloor(doc, s, { x: 50, z: 50, rot: 0 }, 'off');
    for (const b of boxesAt(res.item, worldPose(doc, res.item))) {
      expect(b.cx + b.hw).toBeLessThanOrEqual(HALF_W + 1e-6);
      expect(b.cz + b.hd).toBeLessThanOrEqual(HALF_D + 1e-6);
    }
  });

  it('never accepts an overlapping position when dragging into another item', () => {
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

  it('snaps flush to walls in smart mode', () => {
    const doc = createPreset('empty');
    const it0 = { id: 'x', type: 'sideboard', position: [0, 0, 0] as [number, number, number], rotation: 0, materials: {} };
    doc.items.push(it0);
    const res = placeOnFloor(doc, it0, { x: 0, z: -HALF_D + 0.23 + 0.1, rot: 0 }, 'smart');
    expect(res.item.position[2]).toBeCloseTo(-HALF_D + 0.23 + 0.004, 3);
  });

  it('auto-orients wall-loving furniture', () => {
    const doc = createPreset('empty');
    const it0 = { id: 'x', type: 'bookshelf', position: [0, 0, 0] as [number, number, number], rotation: 0, materials: {} };
    doc.items.push(it0);
    const res = placeOnFloor(doc, it0, { x: -HALF_W + 0.25, z: 0, rot: 0, autoOrient: true }, 'smart');
    expect(Math.sin(res.item.rotation)).toBeCloseTo(1, 3);
  });

  it('keeps wall art off windows', () => {
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

  it('finds free spots for duplicates', () => {
    const doc = createPreset('casa-luz');
    const chair = doc.items.find((i) => i.id === 'chair-n')!;
    const dup = { ...chair, id: 'dup' };
    const spot = findFloorSpot(doc, dup, chair.position[0], chair.position[2], chair.rotation);
    expect(spot).not.toBeNull();
    const next = { ...doc, items: [...doc.items, spot!] };
    expect(isColliding(next, spot!)).toBe(false);
  });

  it('refuses rotations that would intersect', () => {
    const doc = createPreset('casa-luz');
    const s = sofa(doc);
    const r = rotateItem(doc, s, Math.PI / 2);
    if (r) {
      const next = { ...doc, items: doc.items.map((i) => (i.id === s.id ? r : i)) };
      expect(isColliding(next, r)).toBe(false);
    }
  });
});
