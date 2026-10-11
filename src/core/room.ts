import type { WallId } from './types';

// Architectural shell of the studio apartment. The room is fixed (the product
// is about furnishing and finishing a space) but every surface is customisable.

export const ROOM = {
  width: 7.2, // interior, along X
  depth: 5.6, // interior, along Z
  height: 2.85,
  wallThickness: 0.18,
  baseboard: 0.09,
};

export const HALF_W = ROOM.width / 2;
export const HALF_D = ROOM.depth / 2;

export type OpeningKind = 'window' | 'glassdoor' | 'door';

export interface Opening {
  id: string;
  kind: OpeningKind;
  /** Center along the wall (meters from the wall's start, see WallSpec). */
  u: number;
  width: number;
  sill: number;
  height: number;
}

export interface WallSpec {
  id: WallId;
  label: string;
  /** Interior-face point where u = 0. */
  origin: [number, number];
  /** Unit direction of increasing u (x, z). */
  dir: [number, number];
  /** Unit normal pointing into the room (x, z). */
  normal: [number, number];
  length: number;
  openings: Opening[];
}

export const WALLS: Record<WallId, WallSpec> = {
  north: {
    id: 'north',
    label: 'Pared del fondo',
    origin: [-HALF_W, -HALF_D],
    dir: [1, 0],
    normal: [0, 1],
    length: ROOM.width,
    openings: [
      { id: 'win-a', kind: 'window', u: 2.1, width: 2.4, sill: 0.84, height: 1.56 },
      { id: 'win-b', kind: 'window', u: 5.75, width: 1.3, sill: 0.42, height: 1.98 },
    ],
  },
  south: {
    id: 'south',
    label: 'Pared frontal',
    origin: [HALF_W, HALF_D],
    dir: [-1, 0],
    normal: [0, -1],
    length: ROOM.width,
    openings: [],
  },
  west: {
    id: 'west',
    label: 'Pared izquierda',
    origin: [-HALF_W, HALF_D],
    dir: [0, -1],
    normal: [1, 0],
    length: ROOM.depth,
    openings: [{ id: 'garden-door', kind: 'glassdoor', u: 3.85, width: 1.5, sill: 0, height: 2.4 }],
  },
  east: {
    id: 'east',
    label: 'Pared derecha',
    origin: [HALF_W, -HALF_D],
    dir: [0, 1],
    normal: [-1, 0],
    length: ROOM.depth,
    openings: [{ id: 'entry-door', kind: 'door', u: 4.6, width: 0.92, sill: 0, height: 2.12 }],
  },
};

export const WALL_IDS: WallId[] = ['north', 'east', 'south', 'west'];

/** Convert wall-local (u, offset from wall face) to world XZ. */
export function wallToWorld(wall: WallSpec, u: number, offset = 0): [number, number] {
  return [
    wall.origin[0] + wall.dir[0] * u + wall.normal[0] * offset,
    wall.origin[1] + wall.dir[1] * u + wall.normal[1] * offset,
  ];
}

/** Project a world XZ point onto the wall: returns u and distance from face. */
export function worldToWall(wall: WallSpec, x: number, z: number): { u: number; offset: number } {
  const dx = x - wall.origin[0];
  const dz = z - wall.origin[1];
  return {
    u: dx * wall.dir[0] + dz * wall.dir[1],
    offset: dx * wall.normal[0] + dz * wall.normal[1],
  };
}

/** Y-rotation that makes an item's local +Z face away from the wall (into the room). */
export function wallFacingRotation(wall: WallSpec): number {
  return Math.atan2(wall.normal[0], wall.normal[1]);
}

/** Areas in front of doors that must stay clear of furniture (x, z, halfW, halfD). */
export function doorClearances(): { cx: number; cz: number; hw: number; hd: number; rot: number }[] {
  const out: { cx: number; cz: number; hw: number; hd: number; rot: number }[] = [];
  for (const wall of Object.values(WALLS)) {
    for (const o of wall.openings) {
      if (o.kind === 'window') continue;
      const depth = o.kind === 'door' ? o.width * 0.95 : 0.7;
      const [cx, cz] = wallToWorld(wall, o.u, depth / 2);
      out.push({ cx, cz, hw: o.width / 2 + 0.04, hd: depth / 2, rot: wallFacingRotation(wall) });
    }
  }
  return out;
}
