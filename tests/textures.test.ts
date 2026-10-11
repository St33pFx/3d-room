import { describe, expect, it } from 'vitest';
import { defaultSize, generateTexture } from '../src/engine/textures';
import type { TextureSpec } from '../src/core/materials';

const spec = (kind: TextureSpec['kind'], extra: Partial<TextureSpec> = {}): TextureSpec => ({ kind, tile: 1, colors: ['#aa8866', '#664422', '#ccaa88', '#222222'], seed: 5, ...extra });

describe('procedural textures', () => {
  it('[MAT-003] are deterministic and produce colour, normal and roughness maps', () => {
    for (const k of ['planks', 'concrete', 'marble', 'brick'] as const) {
      const a = generateTexture(spec(k), 32);
      const b = generateTexture(spec(k), 32);
      expect(a.color).toEqual(b.color);
      expect(a.normal?.length, k).toBe(32 * 32 * 4);
      expect(a.rough?.length, k).toBe(32 * 32 * 4);
    }
  });

  it('[MAT-003] tile seamlessly (wrap edge no harsher than interior)', () => {
    const S = 64;
    const t = generateTexture(spec('concrete'), S, false).color;
    const px = (x: number, y: number) => t[(y * S + x) * 4];
    let edge = 0;
    let inner = 0;
    for (let y = 0; y < S; y++) {
      edge += Math.abs(px(S - 1, y) - px(0, y));
      inner += Math.abs(px(S / 2, y) - px(S / 2 + 1, y));
    }
    expect(edge).toBeLessThan(inner * 3 + S * 2);
  });

  it('[MAT-004] resolution per kind', () => {
    expect(defaultSize(spec('planks'))).toBe(1024);
    expect(defaultSize(spec('marble'))).toBe(512);
    expect(defaultSize(spec('marble', { grid: 2 }))).toBe(1024);
    expect(defaultSize(spec('linen'))).toBe(256);
    expect(defaultSize(spec('leaf'))).toBe(128);
    expect(defaultSize(spec('plaster'))).toBe(512);
  });
});
