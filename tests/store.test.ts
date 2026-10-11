import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '../src/state/store';
import { createPreset } from '../src/core/presets';
import { exportJSON, importJSON, sanitizeDoc } from '../src/core/persistence';
import { isColliding } from '../src/core/placement';

const st = () => useStore.getState();

beforeEach(() => {
  st().loadDoc(createPreset('casa-luz'), { projectId: null });
});

describe('history', () => {
  it('undoes and redoes discrete edits', () => {
    const before = st().doc;
    st().setFinish('floor', 'floor-terrazzo');
    expect(st().doc.finishes.floor).toBe('floor-terrazzo');
    st().undo();
    expect(st().doc).toBe(before);
    st().redo();
    expect(st().doc.finishes.floor).toBe('floor-terrazzo');
  });

  it('records a drag gesture as a single step', () => {
    const before = st().doc;
    st().beginGesture('Mover');
    for (let i = 0; i < 10; i++) {
      const d = st().doc;
      st().preview({ ...d, items: d.items.map((it) => (it.id === 'sofa' ? { ...it, position: [it.position[0] + 0.01, 0, it.position[2]] } : it)) });
    }
    st().endGesture();
    expect(st().past.length).toBe(1);
    st().undo();
    expect(st().doc).toBe(before);
  });

  it('cancelling a gesture restores the document', () => {
    const before = st().doc;
    st().beginGesture('Mover');
    st().preview({ ...before, items: [] });
    st().cancelGesture();
    expect(st().doc).toBe(before);
    expect(st().past.length).toBe(0);
  });
});

describe('item commands', () => {
  it('removes an item together with what rests on it, and undo brings both back', () => {
    const n = st().doc.items.length;
    st().removeItem('coffee');
    const ids = st().doc.items.map((i) => i.id);
    expect(ids).not.toContain('coffee');
    expect(ids).not.toContain('coffee-books');
    expect(st().doc.items.length).toBe(n - 3);
    st().undo();
    expect(st().doc.items.length).toBe(n);
  });

  it('duplicates into free space including children', () => {
    const n = st().doc.items.length;
    st().duplicateItem('side');
    const doc = st().doc;
    expect(doc.items.length).toBe(n + 2);
    const sel = st().selection;
    expect(sel?.kind).toBe('item');
    const copy = doc.items.find((i) => sel?.kind === 'item' && i.id === sel.id)!;
    expect(isColliding(doc, copy)).toBe(false);
    expect(doc.items.some((i) => i.parentId === copy.id)).toBe(true);
  });

  it('adds new items without collisions', () => {
    for (const type of ['ottoman', 'art-frame', 'books', 'pendant-dome', 'rug-runner', 'plant-snake']) {
      const it = st().addItem(type, { x: 0, z: 0 });
      expect(it, type).not.toBeNull();
      expect(isColliding(st().doc, it!), type).toBe(false);
    }
  });
});

describe('persistence', () => {
  it('round-trips through JSON', () => {
    const json = exportJSON(st().doc, st().env);
    const back = importJSON(json);
    expect(back?.doc.items.length).toBe(st().doc.items.length);
    expect(back?.doc.finishes).toEqual(st().doc.finishes);
  });

  it('repairs damaged documents', () => {
    const bad = {
      name: '',
      finishes: { floor: 'nope', walls: { north: 'paint-sage' } },
      items: [
        { id: 'a', type: 'sofa', position: [0, 0, 'x'], rotation: 'r', materials: { upholstery: 'nope' } },
        { id: 'a', type: 'sofa', position: [1, 0, 0] },
        { id: 'b', type: 'not-a-thing', position: [0, 0, 0] },
        { id: 'c', type: 'vase', position: [0, 0, 0], parentId: 'ghost' },
      ],
    };
    const doc = sanitizeDoc(bad)!;
    expect(doc.items.map((i) => i.id)).toEqual(['a']);
    expect(doc.items[0].materials.upholstery).toBe('linen-oat');
    expect(doc.finishes.floor).toBe('floor-oak-planks');
    expect(doc.finishes.walls.north).toBe('paint-sage');
    expect(doc.finishes.walls.east).toBe('paint-white');
    expect(Number.isFinite(doc.items[0].position[2])).toBe(true);
    expect(importJSON('not json')).toBeNull();
  });
});
