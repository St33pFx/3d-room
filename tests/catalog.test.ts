import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
import { describe, expect, it } from 'vitest';
import { CATALOG_LIST, defaultMaterials, getDef } from '../src/core/catalog';
import { FINISH_CATEGORIES, MATERIALS, getMaterial } from '../src/core/materials';
import { PRESETS, createPreset } from '../src/core/presets';
import { WALL_IDS } from '../src/core/room';

const spec = readFileSync(join(ROOT, 'specs/domain/03-catalog.md'), 'utf8');

describe('catalog', () => {
  it('[CAT-006] the inventory table in the spec matches the catalogue exactly', () => {
    const inSpec = [...spec.matchAll(/^\| `([a-z-]+)` \|/gm)].map((m) => m[1]);
    expect(inSpec).toEqual(CATALOG_LIST.map((d) => d.type));
    expect(CATALOG_LIST.length).toBe(41);
  });

  it('[CAT-001] every piece is well formed', () => {
    for (const d of CATALOG_LIST) {
      expect(d.variants.length, d.type).toBeGreaterThan(0);
      for (const v of d.variants) for (const n of v.size) expect(n, d.type).toBeGreaterThan(0);
      expect(getDef(d.type)).toBe(d);
      expect(Object.keys(defaultMaterials(d.type))).toEqual(d.slots.map((s) => s.id));
    }
  });

  it('[CAT-007] every type has a builder', () => {
    const src = readFileSync(join(ROOT, 'src/engine/builders.ts'), 'utf8');
    const block = src.slice(src.indexOf('const BUILDERS'), src.indexOf('};', src.indexOf('const BUILDERS')));
    for (const d of CATALOG_LIST) expect(block, d.type).toMatch(new RegExp(`(^|[\\s'])${d.type}('|:|,)`, 'm'));
  });
});

describe('materials', () => {
  it('[MAT-001] material definitions are valid', () => {
    for (const m of Object.values(MATERIALS)) {
      expect(m.roughness, m.id).toBeGreaterThanOrEqual(0);
      expect(m.roughness, m.id).toBeLessThanOrEqual(1);
      expect(m.color, m.id).toMatch(/^#[0-9a-f]{3,6}$/i);
      if (m.texture) expect(m.texture.colors.length, m.id).toBeGreaterThan(0);
    }
    expect(getMaterial('does-not-exist').id).toBe('paint-white');
  });

  it('[MAT-002] slot defaults and template materials exist in allowed categories', () => {
    for (const d of CATALOG_LIST) for (const s of d.slots) expect(s.categories, `${d.type}.${s.id}`).toContain(MATERIALS[s.default]?.category);
    for (const p of PRESETS) {
      const doc = createPreset(p.id);
      for (const it of doc.items) {
        for (const s of getDef(it.type).slots) expect(s.categories, `${p.id}/${it.id}.${s.id}`).toContain(MATERIALS[it.materials[s.id]]?.category);
      }
      expect(FINISH_CATEGORIES.floor).toContain(MATERIALS[doc.finishes.floor].category);
      for (const w of WALL_IDS) expect(FINISH_CATEGORIES.wall).toContain(MATERIALS[doc.finishes.walls[w]].category);
    }
  });
});
