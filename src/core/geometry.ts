// Small 2.5D collision toolkit: oriented rectangles on the XZ plane extruded
// over a vertical interval. Enough to keep furniture out of walls and out of
// each other with exact rotated footprints.

export interface Box {
  cx: number;
  cz: number;
  hw: number; // half extent along local X
  hd: number; // half extent along local Z
  rot: number; // Y rotation (radians)
  y0: number;
  y1: number;
}

export interface Rect {
  /** local center */
  x: number;
  z: number;
  w: number;
  d: number;
}

const EPS = 1e-4;

export function axes(rot: number): [[number, number], [number, number]] {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  // local X axis and local Z axis in world (rotation about +Y)
  return [
    [c, -s],
    [s, c],
  ];
}

export function corners(b: Box): [number, number][] {
  const [ax, az] = axes(b.rot);
  const out: [number, number][] = [];
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    out.push([
      b.cx + ax[0] * b.hw * sx + az[0] * b.hd * sz,
      b.cz + ax[1] * b.hw * sx + az[1] * b.hd * sz,
    ]);
  }
  return out;
}

/** Axis-aligned half extents of a rotated box. */
export function aabbHalf(hw: number, hd: number, rot: number): [number, number] {
  const c = Math.abs(Math.cos(rot));
  const s = Math.abs(Math.sin(rot));
  return [hw * c + hd * s, hw * s + hd * c];
}

function project(b: Box, axis: [number, number]): [number, number] {
  const [ax, az] = axes(b.rot);
  const center = b.cx * axis[0] + b.cz * axis[1];
  const r =
    b.hw * Math.abs(ax[0] * axis[0] + ax[1] * axis[1]) +
    b.hd * Math.abs(az[0] * axis[0] + az[1] * axis[1]);
  return [center - r, center + r];
}

export function verticalOverlap(a: Box, b: Box): boolean {
  return a.y0 < b.y1 - EPS && b.y0 < a.y1 - EPS;
}

/**
 * Separating axis test. Returns null when the boxes don't overlap, otherwise
 * the minimum translation vector that pushes `a` out of `b` (XZ only).
 */
export function overlapMTV(a: Box, b: Box, margin = 0): [number, number] | null {
  if (!verticalOverlap(a, b)) return null;
  const [a1, a2] = axes(a.rot);
  const [b1, b2] = axes(b.rot);
  let best = Infinity;
  let bestAxis: [number, number] = [1, 0];
  for (const axis of [a1, a2, b1, b2]) {
    const [amin, amax] = project(a, axis);
    const [bmin, bmax] = project(b, axis);
    const o = Math.min(amax, bmax) - Math.max(amin, bmin) + margin;
    if (o <= EPS) return null;
    if (o < best) {
      best = o;
      bestAxis = axis;
    }
  }
  // Orient the push from b towards a.
  const dx = a.cx - b.cx;
  const dz = a.cz - b.cz;
  let sign = dx * bestAxis[0] + dz * bestAxis[1] >= 0 ? 1 : -1;
  if (Math.abs(dx) < EPS && Math.abs(dz) < EPS) sign = 1;
  return [bestAxis[0] * best * sign, bestAxis[1] * best * sign];
}

export function overlaps(a: Box, b: Box, margin = 0): boolean {
  return overlapMTV(a, b, margin) !== null;
}

/** World box for a local rect of an item placed at (x, z) with rotation. */
export function rectToBox(rect: Rect, x: number, z: number, rot: number, y0: number, y1: number): Box {
  const [ax, az] = axes(rot);
  return {
    cx: x + ax[0] * rect.x + az[0] * rect.z,
    cz: z + ax[1] * rect.x + az[1] * rect.z,
    hw: rect.w / 2,
    hd: rect.d / 2,
    rot,
    y0,
    y1,
  };
}

/** Rotate a local XZ offset into world space. */
export function rotateXZ(x: number, z: number, rot: number): [number, number] {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [x * c + z * s, -x * s + z * c];
}

export function normalizeAngle(a: number): number {
  const t = Math.PI * 2;
  return ((a % t) + t) % t;
}

export function snapAngle(a: number, step: number): number {
  return Math.round(a / step) * step;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
