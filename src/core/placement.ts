import { colliders, getDef, itemSize, surfaces, type Surface } from './catalog';
import { aabbHalf, clamp, overlapMTV, rectToBox, rotateXZ, snapAngle, type Box } from './geometry';
import { doorClearances, HALF_D, HALF_W, ROOM, WALLS, wallFacingRotation, wallToWorld, worldToWall, type WallSpec } from './room';
import type { DesignDoc, ItemInstance, SnapMode, WallId } from './types';

// Placement rules shared by dragging, rotating, duplicating and adding items.
// All functions are pure: they take the document and return candidate
// instances; the caller decides whether to commit them.

export interface Pose {
  x: number;
  y: number;
  z: number;
  rot: number;
}

export interface Guide {
  /** world-space segment */
  a: [number, number, number];
  b: [number, number, number];
}

export interface PlacementResult {
  item: ItemInstance;
  valid: boolean;
  guides: Guide[];
}

const WALL_SNAP = 0.16;
const ALIGN_SNAP = 0.06;
const FLUSH_GAP = 0.004;
const AUTO_ORIENT = 0.3;

export function findItem(doc: DesignDoc, id: string | undefined): ItemInstance | undefined {
  return id ? doc.items.find((i) => i.id === id) : undefined;
}

export function worldPose(doc: DesignDoc, item: ItemInstance): Pose {
  if (item.parentId) {
    const parent = findItem(doc, item.parentId);
    if (parent) {
      const p = worldPose(doc, parent);
      const [ox, oz] = rotateXZ(item.position[0], item.position[2], p.rot);
      return { x: p.x + ox, y: p.y + item.position[1], z: p.z + oz, rot: p.rot + item.rotation };
    }
  }
  return { x: item.position[0], y: item.position[1], z: item.position[2], rot: item.rotation };
}

export function boxesAt(item: ItemInstance, pose: Pose): Box[] {
  const h = itemSize(item.type, item.variant)[1];
  return colliders(item.type, item.variant).map((c) =>
    rectToBox(c, pose.x, pose.z, pose.rot, pose.y + (c.y0 ?? 0), pose.y + (c.y1 ?? h)),
  );
}

export function descendants(doc: DesignDoc, id: string): Set<string> {
  const out = new Set<string>();
  let frontier = [id];
  while (frontier.length) {
    const next: string[] = [];
    for (const it of doc.items) {
      if (it.parentId && frontier.includes(it.parentId) && !out.has(it.id)) {
        out.add(it.id);
        next.push(it.id);
      }
    }
    frontier = next;
  }
  return out;
}

function isBlocking(item: ItemInstance): boolean {
  return getDef(item.type).placement !== 'rug';
}

/** Collision boxes of everything `item` must not intersect. */
export function obstacles(doc: DesignDoc, item: ItemInstance, parentId?: string): Box[] {
  const skip = descendants(doc, item.id);
  skip.add(item.id);
  if (parentId) skip.add(parentId);
  const out: Box[] = [];
  for (const other of doc.items) {
    if (skip.has(other.id) || !isBlocking(other)) continue;
    out.push(...boxesAt(other, worldPose(doc, other)));
  }
  const placement = getDef(item.type).placement;
  if (placement === 'floor' || (placement === 'surface' && !parentId)) {
    for (const d of doorClearances()) {
      out.push({ cx: d.cx, cz: d.cz, hw: d.hw, hd: d.hd, rot: d.rot, y0: 0, y1: 2.1 });
    }
  }
  return out;
}

// ── Room bounds ─────────────────────────────────────────────────────────────

/** Clamp a floor/ceiling pose so all colliders stay inside the interior. */
export function clampToRoom(item: ItemInstance, x: number, z: number, rot: number, margin = 0.002): [number, number] {
  let minX = -Infinity;
  let maxX = Infinity;
  let minZ = -Infinity;
  let maxZ = Infinity;
  for (const c of colliders(item.type, item.variant)) {
    const [ox, oz] = rotateXZ(c.x, c.z, rot);
    const [hx, hz] = aabbHalf(c.w / 2, c.d / 2, rot);
    minX = Math.max(minX, -HALF_W + margin + hx - ox);
    maxX = Math.min(maxX, HALF_W - margin - hx - ox);
    minZ = Math.max(minZ, -HALF_D + margin + hz - oz);
    maxZ = Math.min(maxZ, HALF_D - margin - hz - oz);
  }
  return [minX > maxX ? 0 : clamp(x, minX, maxX), minZ > maxZ ? 0 : clamp(z, minZ, maxZ)];
}

/** World AABB of an item's footprint at a pose (min x, max x, min z, max z). */
export function footprintAABB(item: ItemInstance, x: number, z: number, rot: number): [number, number, number, number] {
  let a = Infinity;
  let b = -Infinity;
  let c = Infinity;
  let d = -Infinity;
  for (const col of colliders(item.type, item.variant)) {
    const [ox, oz] = rotateXZ(col.x, col.z, rot);
    const [hx, hz] = aabbHalf(col.w / 2, col.d / 2, rot);
    a = Math.min(a, x + ox - hx);
    b = Math.max(b, x + ox + hx);
    c = Math.min(c, z + oz - hz);
    d = Math.max(d, z + oz + hz);
  }
  return [a, b, c, d];
}

function collides(boxes: Box[], obs: Box[]): boolean {
  for (const b of boxes) for (const o of obs) if (overlapMTV(b, o)) return true;
  return false;
}

/** Push a floor pose out of obstacles using minimum translation vectors. */
function pushOut(item: ItemInstance, x: number, y: number, z: number, rot: number, obs: Box[], iterations = 10): [number, number] | null {
  let px = x;
  let pz = z;
  for (let i = 0; i < iterations; i++) {
    [px, pz] = clampToRoom(item, px, pz, rot);
    const boxes = boxesAt(item, { x: px, y, z: pz, rot });
    let best: [number, number] | null = null;
    let bestLen = 0;
    for (const b of boxes) {
      for (const o of obs) {
        const m = overlapMTV(b, o, 0.002);
        if (m) {
          const len = Math.hypot(m[0], m[1]);
          if (len > bestLen) {
            bestLen = len;
            best = m;
          }
        }
      }
    }
    if (!best) return [px, pz];
    px += best[0];
    pz += best[1];
  }
  [px, pz] = clampToRoom(item, px, pz, rot);
  return collides(boxesAt(item, { x: px, y, z: pz, rot }), obs) ? null : [px, pz];
}

/** Spiral search for the closest collision-free position. */
function searchFree(item: ItemInstance, x: number, y: number, z: number, rot: number, obs: Box[], maxR: number, step = 0.05): [number, number] | null {
  const test = (px: number, pz: number) => {
    const [cx, cz] = clampToRoom(item, px, pz, rot);
    if (Math.abs(cx - px) > 1e-6 || Math.abs(cz - pz) > 1e-6) return null;
    return collides(boxesAt(item, { x: cx, y, z: cz, rot }), obs) ? null : ([cx, cz] as [number, number]);
  };
  const first = test(...clampToRoom(item, x, z, rot));
  if (first) return first;
  [x, z] = clampToRoom(item, x, z, rot);
  for (let r = step; r <= maxR + 1e-9; r += step) {
    const n = Math.max(8, Math.round((2 * Math.PI * r) / step));
    let best: [number, number] | null = null;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const res = test(x + Math.cos(a) * r, z + Math.sin(a) * r);
      if (res) {
        best = res;
        break;
      }
    }
    if (best) return best;
  }
  return null;
}

// ── Smart snapping (floor) ─────────────────────────────────────────────────

interface SnapOut {
  x: number;
  z: number;
  rot: number;
  guides: Guide[];
}

function nearestWall(item: ItemInstance, x: number, z: number, rot: number): { wall: WallSpec; gap: number } | null {
  const [a, b, c, d] = footprintAABB(item, x, z, rot);
  const gaps: [WallId, number][] = [
    ['west', a + HALF_W],
    ['east', HALF_W - b],
    ['north', c + HALF_D],
    ['south', HALF_D - d],
  ];
  gaps.sort((p, q) => p[1] - q[1]);
  return { wall: WALLS[gaps[0][0]], gap: gaps[0][1] };
}

function snapFloor(doc: DesignDoc, item: ItemInstance, x: number, z: number, rot: number, mode: SnapMode, autoOrient: boolean): SnapOut {
  const guides: Guide[] = [];
  if (mode === 'off') return { x, z, rot, guides };
  if (mode === 'grid') {
    return { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, rot, guides };
  }
  const def = getDef(item.type);

  // Auto-orient furniture that wants its back against a wall.
  if (autoOrient && def.againstWall) {
    const near = nearestWall(item, x, z, rot);
    if (near && near.gap < AUTO_ORIENT) {
      rot = wallFacingRotation(near.wall);
    }
  }

  // Flush against walls when close.
  if (def.placement !== 'rug') {
    const [a, b, c, d] = footprintAABB(item, x, z, rot);
    if (a + HALF_W < WALL_SNAP) x += -HALF_W + FLUSH_GAP - a;
    else if (HALF_W - b < WALL_SNAP) x += HALF_W - FLUSH_GAP - b;
    if (c + HALF_D < WALL_SNAP) z += -HALF_D + FLUSH_GAP - c;
    else if (HALF_D - d < WALL_SNAP) z += HALF_D - FLUSH_GAP - d;
  }

  // Align centres and edges with other floor items (and rugs).
  const [a, b, c, d] = footprintAABB(item, x, z, rot);
  const mine = { x: [a, x, b], z: [c, z, d] };
  let bestX: { delta: number; value: number; other: [number, number, number, number] } | null = null;
  let bestZ: { delta: number; value: number; other: [number, number, number, number] } | null = null;
  const skip = descendants(doc, item.id);
  for (const other of doc.items) {
    if (other.id === item.id || skip.has(other.id)) continue;
    const op = getDef(other.type).placement;
    if (op !== 'floor' && op !== 'rug') continue;
    const pose = worldPose(doc, other);
    const bb = footprintAABB(other, pose.x, pose.z, pose.rot);
    const theirs = { x: [bb[0], pose.x, bb[1]], z: [bb[2], pose.z, bb[3]] };
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        // only compare like with like (centre-centre, edge-edge)
        if ((i === 1) !== (j === 1)) continue;
        const dx = theirs.x[j] - mine.x[i];
        if (Math.abs(dx) < ALIGN_SNAP && (!bestX || Math.abs(dx) < Math.abs(bestX.delta))) bestX = { delta: dx, value: theirs.x[j], other: bb };
        const dz = theirs.z[j] - mine.z[i];
        if (Math.abs(dz) < ALIGN_SNAP && (!bestZ || Math.abs(dz) < Math.abs(bestZ.delta))) bestZ = { delta: dz, value: theirs.z[j], other: bb };
      }
    }
  }
  const y = 0.02;
  if (bestX) {
    x += bestX.delta;
    const z0 = Math.min(c, bestX.other[2]) - 0.15;
    const z1 = Math.max(d, bestX.other[3]) + 0.15;
    guides.push({ a: [bestX.value, y, z0], b: [bestX.value, y, z1] });
  }
  if (bestZ) {
    z += bestZ.delta;
    const x0 = Math.min(a, bestZ.other[0]) - 0.15;
    const x1 = Math.max(b, bestZ.other[1]) + 0.15;
    guides.push({ a: [x0, y, bestZ.value], b: [x1, y, bestZ.value] });
  }
  return { x, z, rot, guides };
}

// ── Public placement API ───────────────────────────────────────────────────

export interface FloorTarget {
  x: number;
  z: number;
  rot: number;
  /** last valid position, used to slide instead of jumping */
  prev?: [number, number];
  autoOrient?: boolean;
}

/** Place a floor/rug/ceiling item (or a surface item on the floor). */
export function placeOnFloor(doc: DesignDoc, item: ItemInstance, t: FloorTarget, mode: SnapMode): PlacementResult {
  const def = getDef(item.type);
  const y = def.placement === 'ceiling' ? ROOM.height : 0;
  const snapped = def.placement === 'ceiling' ? { x: t.x, z: t.z, rot: t.rot, guides: [] as Guide[] } : snapFloor(doc, item, t.x, t.z, t.rot, mode, !!t.autoOrient);
  let { x, z } = snapped;
  const rot = snapped.rot;
  [x, z] = clampToRoom(item, x, z, rot);
  const base: ItemInstance = { ...item, position: [x, y, z], rotation: rot, parentId: undefined, wall: undefined };
  if (def.placement === 'rug') {
    return { item: base, valid: true, guides: snapped.guides };
  }
  const obs = obstacles(doc, item);
  if (!collides(boxesAt(item, { x, y, z, rot }), obs)) {
    return { item: base, valid: true, guides: snapped.guides };
  }
  // Slide: push out of whatever we hit, but never teleport far from the cursor.
  const pushed = pushOut(item, x, y, z, rot, obs);
  if (pushed && Math.hypot(pushed[0] - x, pushed[1] - z) < 0.45) {
    return { item: { ...base, position: [pushed[0], y, pushed[1]] }, valid: true, guides: [] };
  }
  if (t.prev) {
    // Try moving along one axis only (slide along the obstacle).
    for (const [sx, sz] of [
      [x, t.prev[1]],
      [t.prev[0], z],
    ] as [number, number][]) {
      const [cx, cz] = clampToRoom(item, sx, sz, rot);
      if (!collides(boxesAt(item, { x: cx, y, z: cz, rot }), obs)) {
        return { item: { ...base, position: [cx, y, cz] }, valid: true, guides: [] };
      }
    }
    return { item: { ...base, position: [t.prev[0], y, t.prev[1]] }, valid: !collides(boxesAt(item, { x: t.prev[0], y, z: t.prev[1], rot }), obs), guides: [] };
  }
  return { item: base, valid: false, guides: [] };
}

/** Find a free spot near (x, z) for a new/duplicated floor or ceiling item. */
export function findFloorSpot(doc: DesignDoc, item: ItemInstance, x: number, z: number, rot: number, maxR = 4): ItemInstance | null {
  const def = getDef(item.type);
  const y = def.placement === 'ceiling' ? ROOM.height : 0;
  if (def.placement === 'rug') {
    const [cx, cz] = clampToRoom(item, x, z, rot);
    return { ...item, position: [cx, 0, cz], rotation: rot, parentId: undefined, wall: undefined };
  }
  const obs = obstacles(doc, item);
  for (const r of [rot, rot + Math.PI / 2]) {
    const res = searchFree(item, x, y, z, r, obs, maxR, 0.05);
    if (res) return { ...item, position: [res[0], y, res[1]], rotation: r, parentId: undefined, wall: undefined };
  }
  return null;
}

// ── Wall items ─────────────────────────────────────────────────────────────

function wallRectsBlocked(wall: WallSpec, u: number, y: number, w: number, h: number): boolean {
  for (const o of wall.openings) {
    const pad = 0.06;
    if (Math.abs(u - o.u) < (w + o.width) / 2 + pad && y - h / 2 < o.sill + o.height + pad && y + h / 2 > o.sill - pad) return true;
  }
  return false;
}

export function wallPose(wallId: WallId, u: number, y: number): Pose {
  const wall = WALLS[wallId];
  const [x, z] = wallToWorld(wall, u, 0);
  return { x, y, z, rot: wallFacingRotation(wall) };
}

export interface WallTarget {
  wall: WallId;
  u: number;
  y: number;
  prev?: { wall: WallId; u: number; y: number };
}

function wallValid(doc: DesignDoc, item: ItemInstance, wall: WallSpec, u: number, y: number, obs: Box[]): boolean {
  const [w, h] = itemSize(item.type, item.variant);
  if (!getDef(item.type).coversOpenings && wallRectsBlocked(wall, u, y, w, h)) return false;
  const pose = wallPose(wall.id, u, y);
  return !collides(boxesAt(item, pose), obs) && !!doc;
}

function clampWall(item: ItemInstance, wall: WallSpec, u: number, y: number): [number, number] {
  const [w, h] = itemSize(item.type, item.variant);
  const m = 0.03;
  const floorGap = getDef(item.type).coversOpenings ? 0.015 : 0.12;
  return [clamp(u, w / 2 + m, wall.length - w / 2 - m), clamp(y, h / 2 + floorGap, ROOM.height - h / 2 - 0.04)];
}

export function placeOnWall(doc: DesignDoc, item: ItemInstance, t: WallTarget, mode: SnapMode): PlacementResult {
  const wall = WALLS[t.wall];
  const def = getDef(item.type);
  let [u, y] = clampWall(item, wall, t.u, t.y);
  const guides: Guide[] = [];
  const [w] = itemSize(item.type, item.variant);

  if (mode === 'grid') {
    u = Math.round(u * 10) / 10;
    y = Math.round(y * 10) / 10;
  } else if (mode === 'smart') {
    // Snap horizontally to centres of furniture in front of this wall, wall centre, other wall items.
    let bestU: { d: number; v: number } | null = { d: wall.length / 2 - u, v: wall.length / 2 };
    if (Math.abs(bestU.d) > 0.08) bestU = null;
    let bestY: { d: number; v: number } | null = def.mountHeight ? { d: def.mountHeight - y, v: def.mountHeight } : null;
    if (bestY && Math.abs(bestY.d) > 0.08) bestY = null;
    for (const other of doc.items) {
      if (other.id === item.id) continue;
      const op = getDef(other.type).placement;
      const pose = worldPose(doc, other);
      const proj = worldToWall(wall, pose.x, pose.z);
      if (op === 'floor' && proj.offset < 1.6 && proj.offset > -0.1) {
        const d = proj.u - u;
        if (Math.abs(d) < 0.1 && (!bestU || Math.abs(d) < Math.abs(bestU.d))) bestU = { d, v: proj.u };
      }
      if (op === 'wall' && other.wall === wall.id) {
        const d = proj.u - u;
        if (Math.abs(d) < 0.08 && (!bestU || Math.abs(d) < Math.abs(bestU.d))) bestU = { d, v: proj.u };
        const dy = pose.y - y;
        if (Math.abs(dy) < 0.08 && (!bestY || Math.abs(dy) < Math.abs(bestY.d))) bestY = { d: dy, v: pose.y };
      }
    }
    if (def.coversOpenings) {
      for (const o of wall.openings) {
        const d = o.u - u;
        if (Math.abs(d) < 0.3 && (!bestU || Math.abs(d) < Math.abs(bestU.d))) bestU = { d, v: o.u };
      }
    }
    const off = 0.01;
    if (bestU) {
      u = bestU.v;
      const [ax, az] = wallToWorld(wall, u, off);
      guides.push({ a: [ax, 0.02, az], b: [ax, ROOM.height - 0.02, az] });
    }
    if (bestY) {
      y = bestY.v;
      const [ax, az] = wallToWorld(wall, Math.max(0, u - w / 2 - 0.6), off);
      const [bx, bz] = wallToWorld(wall, Math.min(wall.length, u + w / 2 + 0.6), off);
      guides.push({ a: [ax, y, az], b: [bx, y, bz] });
    }
    [u, y] = clampWall(item, wall, u, y);
  }

  const obs = obstacles(doc, item);
  const make = (uu: number, yy: number): ItemInstance => {
    const p = wallPose(wall.id, uu, yy);
    return { ...item, wall: wall.id, parentId: undefined, position: [p.x, p.y, p.z], rotation: p.rot };
  };
  if (wallValid(doc, item, wall, u, y, obs)) return { item: make(u, y), valid: true, guides };

  // Search nearby along the wall plane (short range while dragging).
  const step = 0.03;
  const maxR = t.prev ? 0.36 : wall.length;
  for (let r = step; r < maxR; r += step) {
    for (const [du, dy] of [
      [r, 0],
      [-r, 0],
      [0, r],
      [0, -r],
      [r, r],
      [-r, r],
      [r, -r],
      [-r, -r],
    ]) {
      const [cu, cy] = clampWall(item, wall, u + du, y + dy);
      if (wallValid(doc, item, wall, cu, cy, obs)) return { item: make(cu, cy), valid: true, guides: [] };
    }
  }
  if (t.prev) {
    const pw = WALLS[t.prev.wall];
    const p = wallPose(pw.id, t.prev.u, t.prev.y);
    return {
      item: { ...item, wall: pw.id, parentId: undefined, position: [p.x, p.y, p.z], rotation: p.rot },
      valid: wallValid(doc, item, pw, t.prev.u, t.prev.y, obs),
      guides: [],
    };
  }
  return { item: make(u, y), valid: false, guides: [] };
}

/** Find a free spot on a wall for a new item, preferring `wallId` near `u`. */
export function findWallSpot(doc: DesignDoc, item: ItemInstance, wallIds: WallId[], u?: number): ItemInstance | null {
  const def = getDef(item.type);
  const obs = obstacles(doc, item);
  if (def.coversOpenings && u === undefined) {
    for (const wid of wallIds) {
      for (const o of WALLS[wid].openings) {
        if (o.kind === 'door') continue;
        const [cu, cy] = clampWall(item, WALLS[wid], o.u, def.mountHeight ?? 1.4);
        if (wallValid(doc, item, WALLS[wid], cu, cy, obs)) {
          const p = wallPose(wid, cu, cy);
          return { ...item, wall: wid, parentId: undefined, position: [p.x, p.y, p.z], rotation: p.rot };
        }
      }
    }
  }
  for (const wid of wallIds) {
    const wall = WALLS[wid];
    const start = u ?? wall.length / 2;
    const y0 = def.mountHeight ?? 1.5;
    for (let r = 0; r < wall.length; r += 0.05) {
      for (const s of r === 0 ? [1] : [1, -1]) {
        for (const dy of [0, 0.2, -0.2, 0.4]) {
          const [cu, cy] = clampWall(item, wall, start + r * s, y0 + dy);
          if (wallValid(doc, item, wall, cu, cy, obs)) {
            const p = wallPose(wid, cu, cy);
            return { ...item, wall: wid, parentId: undefined, position: [p.x, p.y, p.z], rotation: p.rot };
          }
        }
      }
    }
  }
  return null;
}

/** Wall-local coordinates of a wall item. */
export function wallCoords(item: ItemInstance): { u: number; y: number } | null {
  if (!item.wall) return null;
  const { u } = worldToWall(WALLS[item.wall], item.position[0], item.position[2]);
  return { u, y: item.position[1] };
}

// ── Surface items ──────────────────────────────────────────────────────────

/** Surfaces of an item in world space. */
export function worldSurfaces(doc: DesignDoc, parent: ItemInstance): (Surface & { pose: Pose; index: number })[] {
  const pose = worldPose(doc, parent);
  return surfaces(parent.type, parent.variant).map((s, index) => ({ ...s, pose, index }));
}

/** Pick the surface of `parent` under a world hit point. */
export function surfaceAt(doc: DesignDoc, parent: ItemInstance, hx: number, hy: number, hz: number): number {
  const pose = worldPose(doc, parent);
  const [lx, lz] = rotateXZ(hx - pose.x, hz - pose.z, -pose.rot);
  const ly = hy - pose.y;
  let best = -1;
  let bestY = -Infinity;
  surfaces(parent.type, parent.variant).forEach((s, i) => {
    const tol = 0.08;
    if (Math.abs(lx - s.x) <= s.w / 2 + tol && Math.abs(lz - s.z) <= s.d / 2 + tol && s.y <= ly + 0.08 && s.y > bestY) {
      best = i;
      bestY = s.y;
    }
  });
  return best;
}

export interface SurfaceTarget {
  parentId: string;
  surface: number;
  /** world hit position */
  x: number;
  z: number;
  /** local rotation relative to parent */
  rot: number;
  prev?: ItemInstance;
}

export function placeOnSurface(doc: DesignDoc, item: ItemInstance, t: SurfaceTarget, mode: SnapMode): PlacementResult {
  const parent = findItem(doc, t.parentId);
  if (!parent) return { item, valid: false, guides: [] };
  const s = surfaces(parent.type, parent.variant)[t.surface];
  const [w, h, d] = itemSize(item.type, item.variant);
  const pose = worldPose(doc, parent);
  let [lx, lz] = rotateXZ(t.x - pose.x, t.z - pose.z, -pose.rot);
  if (s.clearance !== undefined && h > s.clearance + 0.01) {
    return t.prev ? { item: t.prev, valid: true, guides: [] } : { item, valid: false, guides: [] };
  }
  const [hx, hz] = aabbHalf(w / 2, d / 2, t.rot);
  const fit = (v: number, c: number, half: number, ext: number) => (half * 2 >= ext ? c : clamp(v, c - ext / 2 + half, c + ext / 2 - half));
  if (mode === 'grid') {
    lx = Math.round(lx * 20) / 20;
    lz = Math.round(lz * 20) / 20;
  } else if (mode === 'smart') {
    // centre snap on the surface
    if (Math.abs(lx - s.x) < 0.04) lx = s.x;
    if (Math.abs(lz - s.z) < 0.04) lz = s.z;
  }
  lx = fit(lx, s.x, hx, s.w);
  lz = fit(lz, s.z, hz, s.d);

  const make = (x: number, z: number): ItemInstance => ({ ...item, parentId: parent.id, wall: undefined, position: [x, s.y, z], rotation: t.rot });
  const obs = obstacles(doc, item, parent.id);
  const test = (x: number, z: number) => {
    const cand = make(x, z);
    return !collides(boxesAt(cand, worldPose(doc, cand)), obs);
  };
  if (test(lx, lz)) return { item: make(lx, lz), valid: true, guides: [] };
  // search the whole surface when nothing is known, stay local while dragging
  const maxR = t.prev ? 0.3 : Math.max(s.w, s.d);
  for (let r = 0.02; r < maxR; r += 0.02) {
    const n = Math.max(8, Math.round((2 * Math.PI * r) / 0.02));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const x = fit(lx + Math.cos(a) * r, s.x, hx, s.w);
      const z = fit(lz + Math.sin(a) * r, s.z, hz, s.d);
      if (test(x, z)) return { item: make(x, z), valid: true, guides: [] };
    }
  }
  return t.prev ? { item: t.prev, valid: true, guides: [] } : { item: make(lx, lz), valid: false, guides: [] };
}

/** Find a free spot on any surface of `parent`. */
export function findSurfaceSpot(doc: DesignDoc, item: ItemInstance, parent: ItemInstance): ItemInstance | null {
  const pose = worldPose(doc, parent);
  const list = surfaces(parent.type, parent.variant);
  // prefer the top-most surface
  const order = list.map((s, i) => [s, i] as const).sort((a, b) => b[0].y - a[0].y);
  for (const [s, i] of order) {
    const [wx, wz] = rotateXZ(s.x, s.z, pose.rot);
    const res = placeOnSurface(doc, item, { parentId: parent.id, surface: i, x: pose.x + wx, z: pose.z + wz, rot: 0 }, 'off');
    if (res.valid) return res.item;
  }
  return null;
}

// ── Validation & helpers ───────────────────────────────────────────────────

/** True if the item currently intersects anything it shouldn't. */
export function isColliding(doc: DesignDoc, item: ItemInstance): boolean {
  const def = getDef(item.type);
  if (def.placement === 'rug') return false;
  const pose = worldPose(doc, item);
  return collides(boxesAt(item, pose), obstacles(doc, item, item.parentId));
}

/** Rotate an item in place, nudging it slightly if needed. Returns null if it can't rotate. */
export function rotateItem(doc: DesignDoc, item: ItemInstance, rot: number): ItemInstance | null {
  const def = getDef(item.type);
  if (def.placement === 'wall') return null;
  if (item.parentId) {
    const cand = { ...item, rotation: rot };
    const parent = findItem(doc, item.parentId)!;
    const pose = worldPose(doc, cand);
    const idx = surfaceAt(doc, parent, pose.x, pose.y + 0.01, pose.z);
    const res = placeOnSurface(doc, item, { parentId: parent.id, surface: Math.max(0, idx), x: pose.x, z: pose.z, rot }, 'off');
    return res.valid ? res.item : null;
  }
  const x = item.position[0];
  const z = item.position[2];
  const y = item.position[1];
  const [cx, cz] = clampToRoom(item, x, z, rot);
  if (def.placement === 'rug') return { ...item, rotation: rot, position: [cx, y, cz] };
  const obs = obstacles(doc, item);
  const pushed = pushOut(item, cx, y, cz, rot, obs);
  if (pushed && Math.hypot(pushed[0] - x, pushed[1] - z) < 0.5) {
    return { ...item, rotation: rot, position: [pushed[0], y, pushed[1]] };
  }
  return null;
}

export function snapRotation(rot: number, free: boolean): number {
  return free ? rot : snapAngle(rot, Math.PI / 12);
}
