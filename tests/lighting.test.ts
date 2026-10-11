import { describe, expect, it } from 'vitest';
import { computeSun } from '../src/engine/Lighting';

describe('sun model', () => {
  it('[LIGHT-001] rises, peaks and sets on schedule', () => {
    expect(computeSun(6.4, 0).elevation).toBeCloseTo(0, 6);
    expect(computeSun(20.1, 0).elevation).toBeCloseTo(0, 6);
    const noon = computeSun((6.4 + 20.1) / 2, 0);
    expect((noon.elevation * 180) / Math.PI).toBeCloseTo(64, 3);
    expect(noon.daylight).toBe(1);
    const night = computeSun(1, 0);
    expect(night.elevation).toBeLessThan(0);
    expect(night.night).toBe(1);
    expect(night.lampFactor).toBe(1);
    expect(noon.lampFactor).toBe(0);
  });

  it('[LIGHT-001] travels east (−X) → south (−Z) → west (+X), rotated by orientation', () => {
    const morning = computeSun(8, -40);
    const evening = computeSun(18.5, -40);
    const midday = computeSun(13.25, -40);
    expect(morning.dir.x).toBeLessThan(0);
    expect(evening.dir.x).toBeGreaterThan(0);
    expect(midday.dir.z).toBeLessThan(0);
    const turned = computeSun(13.25, 50);
    expect(turned.dir.x).toBeLessThan(midday.dir.x);
  });
});
