import * as THREE from 'three';
import { getDef, itemSize } from '../core/catalog';
import type { ItemInstance } from '../core/types';
import { rng } from './textures';
import type { MaterialLibrary } from './MaterialLibrary';
import { bendX, box, cushion, cyl, lathe, leafGeometry, mergeAll, rbox, roundedDisc, sphere, tint, tube, worldUVs } from './geo';

// Procedural models for every catalogue item. Each builder composes simple
// primitives; `finalize` bakes them into a few merged meshes per item with
// metric UVs so procedural textures keep a real-world scale.

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const PI = Math.PI;

interface AddOpts {
  rx?: number;
  ry?: number;
  rz?: number;
  keepUV?: boolean;
  noShadow?: boolean;
  glow?: boolean;
  grain?: 0 | 1 | 2;
}

export class BuildCtx {
  readonly group = new THREE.Group();
  readonly rand: () => number;
  private glowMats = new Map<string, THREE.MeshStandardMaterial>();
  constructor(
    public lib: MaterialLibrary,
    public item: ItemInstance,
    public size: [number, number, number],
  ) {
    let h = 0;
    for (const c of item.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    this.rand = rng(h % 100000);
  }
  mat(slot: string): THREE.MeshStandardMaterial {
    const def = getDef(this.item.type);
    const s = def.slots.find((x) => x.id === slot);
    return this.lib.get(this.item.materials[slot] ?? s?.default ?? 'paint-white');
  }
  fixed(id: string): THREE.MeshStandardMaterial {
    return this.lib.get(id);
  }
  /** Per-instance material whose emissive intensity follows the lamp state. */
  glow(slotOrId: string, isSlot = true): THREE.MeshStandardMaterial {
    const id = isSlot ? (this.item.materials[slotOrId] ?? getDef(this.item.type).slots.find((x) => x.id === slotOrId)?.default ?? 'fx-bulb') : slotOrId;
    let m = this.glowMats.get(id);
    if (!m) {
      m = this.lib.unique(id);
      if (!m.emissive || m.emissive.getHex() === 0) m.emissive = new THREE.Color('#ffd7a0');
      m.userData.glowBase = m.userData.def?.emissive ? 1 : 0.6;
      this.glowMats.set(id, m);
    }
    return m;
  }
  add(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, o: AddOpts = {}): THREE.Mesh {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
    m.userData = { ...o };
    this.group.add(m);
    return m;
  }
}

type Builder = (c: BuildCtx) => void;

// ── Seating ────────────────────────────────────────────────────────────────

function legsAt(c: BuildCtx, mat: THREE.Material, pts: [number, number][], h: number, r0 = 0.022, r1 = 0.014) {
  for (const [x, z] of pts) c.add(cyl(r0, r1, h, 16), mat, x, h / 2, z);
}

const sofa: Builder = (c) => {
  const [w, h, d] = c.size;
  const up = c.mat('upholstery');
  const legs = c.mat('legs');
  const legH = 0.09;
  const baseTop = 0.36;
  const arm = 0.17;
  const armH = 0.62;
  legsAt(c, legs, [
    [-w / 2 + 0.09, -d / 2 + 0.09],
    [w / 2 - 0.09, -d / 2 + 0.09],
    [-w / 2 + 0.09, d / 2 - 0.09],
    [w / 2 - 0.09, d / 2 - 0.09],
  ], legH + 0.02, 0.022, 0.016);
  // base
  c.add(rbox(w, baseTop - legH, d, 0.035), up, 0, (legH + baseTop) / 2, 0);
  // back frame
  c.add(rbox(w, h - baseTop + 0.02, 0.18, 0.06), up, 0, baseTop + (h - baseTop) / 2 - 0.01, -d / 2 + 0.09);
  // arms
  for (const s of [-1, 1]) c.add(cushion(arm, armH - legH, d, 0.07, 0.05), up, s * (w / 2 - arm / 2), (legH + armH) / 2 + 0.005, 0);
  // seat cushions
  const n = w < 2.0 ? 2 : w < 2.6 ? 3 : 4;
  const inner = w - 2 * arm - 0.01;
  const cw = inner / n;
  const seatD = d - 0.2;
  for (let i = 0; i < n; i++) {
    const x = -inner / 2 + cw * (i + 0.5);
    c.add(cushion(cw - 0.012, 0.15, seatD, 0.055, 0.22), up, x, baseTop + 0.07, d / 2 - seatD / 2 - 0.005);
    // back cushion, leaning back
    c.add(cushion(cw - 0.014, 0.44, 0.19, 0.07, 0.25), up, x, baseTop + 0.15 + 0.2, -d / 2 + 0.18 + 0.1, { rx: -0.16 });
  }
  // a throw pillow for character
  c.add(cushion(0.44, 0.42, 0.12, 0.05, 0.9, 7), c.fixed('fx-pillow'), -w / 2 + arm + 0.3, baseTop + 0.3, -d / 2 + 0.4, { rx: -0.3, rz: 0.12, ry: 0.25 });
};

const sectional: Builder = (c) => {
  const [w, h, d] = c.size;
  const up = c.mat('upholstery');
  const backD = 0.98;
  const chaiseW = 1.0;
  const plinth = 0.06;
  const baseTop = 0.34;
  const arm = 0.2;
  // plinths
  c.add(rbox(w - 0.04, plinth, backD - 0.04, 0.01), c.fixed('fx-black'), 0, plinth / 2, -d / 2 + backD / 2);
  c.add(rbox(chaiseW - 0.04, plinth, d - backD, 0.01), c.fixed('fx-black'), w / 2 - chaiseW / 2, plinth / 2, -d / 2 + backD + (d - backD) / 2 - 0.02);
  // bases
  c.add(cushion(w, baseTop - plinth, backD, 0.06, 0.05), up, 0, (plinth + baseTop) / 2, -d / 2 + backD / 2);
  c.add(cushion(chaiseW, baseTop - plinth, d - backD + 0.02, 0.06, 0.05), up, w / 2 - chaiseW / 2, (plinth + baseTop) / 2, -d / 2 + backD + (d - backD) / 2 - 0.01);
  // back & arm
  c.add(cushion(w, h - baseTop + 0.04, 0.24, 0.1, 0.12), up, 0, baseTop + (h - baseTop) / 2 - 0.02, -d / 2 + 0.12);
  c.add(cushion(arm, 0.6 - plinth, backD, 0.09, 0.1), up, -w / 2 + arm / 2, 0.3 + plinth / 2, -d / 2 + backD / 2);
  // seats
  const runW = w - arm - chaiseW;
  c.add(cushion(runW / 2 - 0.01, 0.16, backD - 0.24, 0.08, 0.25), up, -w / 2 + arm + runW / 4, baseTop + 0.07, -d / 2 + 0.24 + (backD - 0.24) / 2);
  c.add(cushion(runW / 2 - 0.01, 0.16, backD - 0.24, 0.08, 0.25), up, -w / 2 + arm + (3 * runW) / 4, baseTop + 0.07, -d / 2 + 0.24 + (backD - 0.24) / 2);
  c.add(cushion(chaiseW - 0.02, 0.16, d - 0.25, 0.08, 0.2), up, w / 2 - chaiseW / 2, baseTop + 0.07, -d / 2 + 0.24 + (d - 0.24) / 2);
  // loose back cushions
  for (const x of [-w / 2 + arm + 0.4, -w / 2 + arm + 1.05, w / 2 - 0.5]) {
    c.add(cushion(0.62, 0.42, 0.18, 0.08, 0.35), up, x, baseTop + 0.32, -d / 2 + 0.33, { rx: -0.2 });
  }
};

const loungeChair: Builder = (c) => {
  const [w, , d] = c.size;
  const wood = c.mat('frame');
  const cush = c.mat('cushion');
  const sideX = w / 2 - 0.03;
  for (const s of [-1, 1]) {
    // front & back legs (slightly splayed), armrest plank
    c.add(box(0.045, 0.6, 0.05), wood, s * sideX, 0.3, d / 2 - 0.12, { rx: 0.08 });
    c.add(box(0.045, 0.52, 0.05), wood, s * sideX, 0.26, -d / 2 + 0.1, { rx: -0.22 });
    c.add(rbox(0.07, 0.03, d - 0.08, 0.012), wood, s * sideX, 0.6, 0.0, { rx: 0.06 });
    // side rail
    c.add(box(0.035, 0.05, d - 0.2), wood, s * sideX, 0.24, -0.02, { rx: 0.1 });
  }
  // seat frame rails
  c.add(box(w - 0.06, 0.05, 0.035), wood, 0, 0.26, d / 2 - 0.13);
  // seat & back cushions
  c.add(cushion(w - 0.14, 0.13, d - 0.24, 0.05, 0.22), cush, 0, 0.33, 0.04, { rx: -0.08 });
  c.add(cushion(w - 0.16, 0.5, 0.12, 0.05, 0.25), cush, 0, 0.64, -d / 2 + 0.17, { rx: -0.32 });
  // back slats behind cushion
  c.add(box(w - 0.08, 0.04, 0.03), wood, 0, 0.84, -d / 2 + 0.06, { rx: -0.32 });
  for (const s of [-1, 1]) c.add(box(0.04, 0.6, 0.035), wood, s * (w / 2 - 0.07), 0.58, -d / 2 + 0.1, { rx: -0.32 });
};

const tubChair: Builder = (c) => {
  const [w, h] = c.size;
  const up = c.mat('upholstery');
  const base = c.mat('base');
  const R = w / 2;
  const shell = new THREE.Shape();
  const a0 = -PI / 2 + 0.95;
  const a1 = -PI / 2 - 0.95 + 2 * PI;
  const inner = R - 0.12;
  shell.absarc(0, 0, R - 0.03, a0, a1, false);
  shell.absarc(0, 0, inner, a1, a0, true);
  const shellH = h - 0.2;
  const g = new THREE.ExtrudeGeometry(shell, { depth: shellH - 0.06, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.03, bevelSegments: 5, curveSegments: 48 });
  g.rotateX(-PI / 2);
  c.add(g, up, 0, 0.13 + 0.05, 0);
  c.add(roundedDisc(R - 0.02, 0.24, 0.08), up, 0, 0.13 + 0.12, 0);
  c.add(cushion(R * 1.25, 0.12, R * 1.2, 0.06, 0.3), up, 0, 0.43, 0.04);
  c.add(cyl(R * 0.62, R * 0.66, 0.12, 48), base, 0, 0.07, 0);
  c.add(cyl(R * 0.66, R * 0.66, 0.015, 48), c.fixed('fx-rubber'), 0, 0.0075, 0);
};

const diningChair: Builder = (c) => {
  const [w, h, d] = c.size;
  const wood = c.mat('frame');
  const seat = c.mat('seat');
  const seatY = 0.45;
  const lx = w / 2 - 0.035;
  const lz = d / 2 - 0.04;
  for (const s of [-1, 1]) {
    c.add(cyl(0.017, 0.013, seatY, 12), wood, s * lx, seatY / 2, lz, { rx: 0.04 });
    // back leg continues up as a post
    c.add(cyl(0.017, 0.015, h - 0.02, 12), wood, s * (lx - 0.005), (h - 0.02) / 2, -lz + 0.01, { rx: -0.07 });
  }
  // seat
  c.add(rbox(w - 0.02, 0.035, d - 0.05, 0.012), wood, 0, seatY - 0.02, 0.01);
  c.add(cushion(w - 0.06, 0.045, d - 0.1, 0.02, 0.25), seat, 0, seatY + 0.02, 0.025);
  // curved back rest
  const bb = new THREE.BoxGeometry(w - 0.02, 0.11, 0.022, 16, 1, 1);
  bendX(bb, 0.55);
  c.add(bb, wood, 0, h - 0.1, -lz - 0.03, { rx: -0.07 });
  // stretchers
  c.add(cyl(0.008, 0.008, w - 0.06, 8), wood, 0, 0.17, 0, { rz: PI / 2 });
};

const ottoman: Builder = (c) => {
  const [w, h] = c.size;
  const up = c.mat('upholstery');
  const g = roundedDisc(w / 2, h - 0.02, 0.12, 64);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const r = Math.hypot(pos.getX(i), pos.getZ(i));
    if (y > 0) pos.setY(i, y + 0.03 * (1 - Math.pow(r / (w / 2), 2)));
  }
  g.computeVertexNormals();
  c.add(g, up, 0, h / 2, 0);
};

const bench: Builder = (c) => {
  const [w, h, d] = c.size;
  const wood = c.mat('wood');
  const slats = 5;
  const sw = d / slats;
  for (let i = 0; i < slats; i++) {
    c.add(rbox(w, 0.03, sw - 0.01, 0.006), wood, 0, h - 0.015, -d / 2 + sw * (i + 0.5));
  }
  for (const s of [-1, 1]) {
    c.add(box(0.04, h - 0.03, d - 0.04), wood, s * (w / 2 - 0.12), (h - 0.03) / 2, 0);
  }
  c.add(box(w - 0.24, 0.04, 0.03), wood, 0, 0.12, 0);
};

// ── Tables ─────────────────────────────────────────────────────────────────

const coffeeRound: Builder = (c) => {
  const [w, h] = c.size;
  const top = c.mat('top');
  const base = c.mat('base');
  c.add(roundedDisc(w / 2, 0.045, 0.012, 96), top, 0, h - 0.0225, 0);
  // sculpted twin-drum base
  c.add(cyl(w * 0.22, w * 0.24, h - 0.045, 64), base, -w * 0.08, (h - 0.045) / 2, 0.02);
  c.add(cyl(w * 0.16, w * 0.17, h - 0.045, 64), base, w * 0.18, (h - 0.045) / 2, -0.05);
};

const coffeeRect: Builder = (c) => {
  const [w, h, d] = c.size;
  const wood = c.mat('wood');
  const legs = c.mat('legs');
  c.add(rbox(w, 0.04, d, 0.012), wood, 0, h - 0.02, 0);
  c.add(rbox(w - 0.12, 0.025, d - 0.12, 0.008), wood, 0, 0.12, 0);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    c.add(rbox(0.045, h - 0.04, 0.045, 0.01), legs, sx * (w / 2 - 0.05), (h - 0.04) / 2, sz * (d / 2 - 0.05));
  }
};

const sideTable: Builder = (c) => {
  const [w, h] = c.size;
  const top = c.mat('top');
  const base = c.mat('base');
  c.add(roundedDisc(w / 2, 0.025, 0.008, 64), top, 0, h - 0.0125, 0);
  c.add(cyl(0.018, 0.018, h - 0.04, 16), base, 0, (h - 0.04) / 2 + 0.015, 0);
  c.add(roundedDisc(w * 0.32, 0.02, 0.006, 48), base, 0, 0.01, 0);
  c.add(cyl(0.05, 0.05, 0.02, 24), base, 0, h - 0.035, 0);
};

const diningRound: Builder = (c) => {
  const [w, h] = c.size;
  const top = c.mat('top');
  const base = c.mat('base');
  c.add(roundedDisc(w / 2, 0.035, 0.01, 96), top, 0, h - 0.0175, 0);
  c.add(cyl(w * 0.3, w * 0.3, 0.02, 64), top, 0, h - 0.045, 0);
  const prof: [number, number][] = [
    [0, 0],
    [w * 0.24, 0],
    [w * 0.24, 0.02],
    [w * 0.2, 0.04],
    [0.07, 0.16],
    [0.055, 0.3],
    [0.055, h - 0.32],
    [0.075, h - 0.12],
    [0.16, h - 0.055],
    [0, h - 0.055],
  ];
  c.add(lathe(prof, 64), base, 0, 0, 0);
};

const diningRect: Builder = (c) => {
  const [w, h, d] = c.size;
  const top = c.mat('top');
  const legs = c.mat('legs');
  c.add(rbox(w, 0.04, d, 0.01), top, 0, h - 0.02, 0);
  c.add(box(w - 0.2, 0.08, 0.025), legs, 0, h - 0.08, d / 2 - 0.09);
  c.add(box(w - 0.2, 0.08, 0.025), legs, 0, h - 0.08, -d / 2 + 0.09);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const g = lathe([[0, 0], [0.022, 0], [0.032, h - 0.06], [0, h - 0.06]], 20);
    c.add(g, legs, sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.08));
  }
};

const desk: Builder = (c) => {
  const [w, h, d] = c.size;
  const top = c.mat('top');
  const frame = c.mat('frame');
  c.add(rbox(w, 0.03, d, 0.008), top, 0, h - 0.015, 0);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) c.add(box(0.025, h - 0.03, 0.025), frame, sx * (w / 2 - 0.04), (h - 0.03) / 2, sz * (d / 2 - 0.04));
    c.add(box(0.02, 0.02, d - 0.08), frame, sx * (w / 2 - 0.04), 0.12, 0);
  }
  c.add(box(w - 0.08, 0.025, 0.02), frame, 0, h - 0.045, -d / 2 + 0.04);
  // drawer
  c.add(rbox(0.42, 0.1, d - 0.12, 0.006), top, w / 2 - 0.3, h - 0.085, 0.02);
  c.add(box(0.12, 0.012, 0.012), frame, w / 2 - 0.3, h - 0.085, d / 2 - 0.04);
};

// ── Storage ────────────────────────────────────────────────────────────────

const BOOK_COLORS = ['#e8e0cf', '#b55e3c', '#2f4a3a', '#283550', '#c99a4f', '#3b3936', '#d9cdb8', '#8f9a80', '#7a3b2e', '#f1ece3', '#5a6a7a', '#a4553a'];

function bookRow(c: BuildCtx, x0: number, x1: number, y: number, z: number, maxH: number, depth: number): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  let x = x0;
  while (x < x1 - 0.03) {
    const bw = 0.018 + c.rand() * 0.035;
    if (x + bw > x1) break;
    const bh = Math.min(maxH - 0.02, 0.18 + c.rand() * 0.12);
    const bd = depth * (0.7 + c.rand() * 0.25);
    const col = BOOK_COLORS[Math.floor(c.rand() * BOOK_COLORS.length)];
    const g = box(bw, bh, bd);
    tint(g, col);
    const lean = c.rand() < 0.08 && x + bw + 0.06 < x1 ? 0.22 : 0;
    g.rotateZ(-lean);
    g.translate(x + bw / 2 + (lean ? bh * 0.11 : 0), y + bh / 2 - (lean ? bh * 0.02 : 0), z - (depth - bd) / 2);
    out.push(g);
    x += bw + (lean ? 0.06 : 0.002);
  }
  return out;
}

const bookshelf: Builder = (c) => {
  const [w, h, d] = c.size;
  const wood = c.mat('wood');
  const t = 0.028;
  for (const s of [-1, 1]) c.add(box(t, h, d), wood, s * (w / 2 - t / 2), h / 2, 0, { grain: 1 });
  c.add(box(w, t, d), wood, 0, h - t / 2, 0, { grain: 0 });
  c.add(box(w - 2 * t, 0.06, d - 0.03), wood, 0, 0.03, 0.015, { grain: 0 });
  c.add(box(w - 2 * t, h - 0.06, 0.012), wood, 0, h / 2 + 0.03, -d / 2 + 0.006, { grain: 1 });
  const levels = 5;
  const step = (h - 0.03) / levels;
  const books: THREE.BufferGeometry[] = [];
  for (let i = 1; i < levels; i++) {
    const y = i * step + 0.03;
    c.add(box(w - 2 * t, 0.025, d - 0.015), wood, 0, y - 0.0125, 0.008, { grain: 0 });
  }
  for (let i = 0; i < levels; i++) {
    const y = i === 0 ? 0.06 : i * step + 0.03;
    const maxH = step - 0.03;
    // books on the left part of each shelf (decor space on the right)
    books.push(...bookRow(c, -w / 2 + t + 0.01, -w / 2 + t + (w - 2 * t) * (i % 2 === 0 ? 0.45 : 0.38), y, 0, maxH, d - 0.06));
    if (i === 0) books.push(...bookRow(c, w * 0.05, w / 2 - t - 0.02, y, 0, maxH, d - 0.06));
  }
  if (books.length) {
    const m = c.add(mergeAll(books), c.fixed('fx-books'));
    m.userData.keepUV = true;
  }
};

const sideboard: Builder = (c) => {
  const [w, h, d] = c.size;
  const body = c.mat('body');
  const legs = c.mat('legs');
  const legH = 0.16;
  const bodyH = h - legH;
  c.add(rbox(w, bodyH, d - 0.02, 0.008), body, 0, legH + bodyH / 2, -0.01);
  const doors = w > 1.8 ? 4 : 3;
  const dw = (w - 0.03) / doors;
  for (let i = 0; i < doors; i++) {
    const x = -w / 2 + 0.015 + dw * (i + 0.5);
    c.add(rbox(dw - 0.008, bodyH - 0.04, 0.02, 0.004), body, x, legH + bodyH / 2, d / 2 - 0.01, { grain: 1 });
    // fluted fronts: subtle vertical grooves
    for (let k = 1; k < 8; k++) {
      c.add(box(0.004, bodyH - 0.06, 0.003), c.fixed('fx-black'), x - dw / 2 + (dw / 8) * k, legH + bodyH / 2, d / 2 + 0.0005, { noShadow: true });
    }
    c.add(cyl(0.012, 0.012, 0.05, 16), legs, x + (i % 2 === 0 ? dw / 2 - 0.04 : -dw / 2 + 0.04), legH + bodyH / 2, d / 2 + 0.02, { rx: PI / 2 });
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    c.add(cyl(0.016, 0.01, legH, 12), legs, sx * (w / 2 - 0.08), legH / 2, sz * (d / 2 - 0.07));
  }
};

const mediaConsole: Builder = (c) => {
  const [w, h, d] = c.size;
  const body = c.mat('body');
  const fronts = c.mat('fronts');
  const plinth = 0.06;
  c.add(box(w - 0.1, plinth, d - 0.1), c.fixed('fx-black'), 0, plinth / 2, 0);
  c.add(rbox(w, h - plinth, d, 0.006), body, 0, plinth + (h - plinth) / 2, 0);
  const n = 3;
  const fw = (w - 0.06) / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.03 + fw * (i + 0.5);
    c.add(box(fw - 0.03, h - plinth - 0.07, 0.01), fronts, x, plinth + (h - plinth) / 2, d / 2 + 0.002);
    c.add(rbox(fw - 0.008, h - plinth - 0.03, 0.012, 0.003), body, x, plinth + (h - plinth) / 2, d / 2 - 0.004);
  }
};

// ── Lighting ───────────────────────────────────────────────────────────────

const arcLamp: Builder = (c) => {
  const [, h, d] = c.size;
  const metal = c.mat('metal');
  const base = c.mat('base');
  const bz = -d / 2 + 0.2;
  const sz = d / 2 - 0.25;
  c.add(rbox(0.32, 0.12, 0.32, 0.02), base, 0, 0.06, bz);
  const pts = [V(0, 0.12, bz), V(0, 1.1, bz - 0.02), V(0, 1.75, bz + 0.12), V(0, h - 0.02, (bz + sz) / 2 - 0.05), V(0, h - 0.05, sz - 0.12), V(0, h - 0.12, sz)];
  c.add(tube(pts, 0.012, 96, 10), metal);
  const dome = lathe([[0.004, 0.2], [0.06, 0.195], [0.13, 0.16], [0.18, 0.09], [0.205, 0.0], [0.2, 0.0], [0.175, 0.085], [0.125, 0.15], [0.058, 0.185], [0.004, 0.19]], 48);
  c.add(dome, metal, 0, h - 0.33, sz);
  c.add(sphere(0.05, 20, 12), c.glow('fx-bulb', false), 0, h - 0.27, sz, { glow: true, noShadow: true });
};

const tripodLamp: Builder = (c) => {
  const [, h] = c.size;
  const wood = c.mat('wood');
  const shadeM = c.glow('shade');
  const top = h - 0.36;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI * 2 + PI / 6;
    const foot = V(Math.cos(a) * 0.24, 0, Math.sin(a) * 0.24);
    const head = V(Math.cos(a) * 0.025, top, Math.sin(a) * 0.025);
    const len = foot.distanceTo(head);
    const g = cyl(0.012, 0.016, len, 12);
    const mid = foot.clone().add(head).multiplyScalar(0.5);
    const m = c.add(g, wood, mid.x, mid.y, mid.z);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), head.clone().sub(foot).normalize());
  }
  c.add(cyl(0.008, 0.008, 0.2, 8), c.fixed('fx-black'), 0, top + 0.1, 0);
  c.add(cyl(0.19, 0.24, 0.32, 48, true), shadeM, 0, h - 0.16, 0, { glow: true });
  c.add(sphere(0.04, 16, 10), c.glow('fx-bulb', false), 0, h - 0.22, 0, { glow: true, noShadow: true });
};

const tableLamp: Builder = (c) => {
  const [, h] = c.size;
  const base = c.mat('base');
  const shadeM = c.glow('shade');
  const bodyH = h * 0.55;
  c.add(
    lathe([[0, 0], [0.06, 0], [0.085, bodyH * 0.2], [0.095, bodyH * 0.5], [0.075, bodyH * 0.82], [0.025, bodyH * 0.95], [0.018, bodyH], [0, bodyH]], 48),
    base,
  );
  c.add(cyl(0.006, 0.006, 0.08, 8), c.fixed('fx-cord'), 0, bodyH + 0.04, 0);
  c.add(cyl(0.11, 0.15, h - bodyH - 0.02, 48, true), shadeM, 0, bodyH + (h - bodyH) / 2 + 0.01, 0, { glow: true });
  c.add(sphere(0.03, 16, 10), c.glow('fx-bulb', false), 0, h - 0.13, 0, { glow: true, noShadow: true });
};

const pendantGlobe: Builder = (c) => {
  const [w, h] = c.size;
  const metal = c.mat('metal');
  const r = w / 2;
  c.add(cyl(0.06, 0.06, 0.025, 32), metal, 0, -0.0125, 0);
  c.add(cyl(0.004, 0.004, h - w, 6), c.fixed('fx-cord'), 0, -(h - w) / 2, 0);
  c.add(cyl(0.03, 0.035, 0.05, 24), metal, 0, -(h - w) - 0.02, 0);
  c.add(sphere(r, 48, 32), c.glow('shade'), 0, -h + r, 0, { glow: true });
};

const pendantDome: Builder = (c) => {
  const [w, h] = c.size;
  const shade = c.mat('shade');
  c.add(cyl(0.06, 0.06, 0.025, 32), shade, 0, -0.0125, 0);
  c.add(cyl(0.004, 0.004, h - 0.2, 6), c.fixed('fx-cord'), 0, -(h - 0.2) / 2, 0);
  const r = w / 2;
  const dome = lathe([[0.02, 0.2], [0.05, 0.2], [0.12, 0.17], [r * 0.85, 0.08], [r, 0], [r - 0.006, 0], [r * 0.85 - 0.006, 0.075], [0.12, 0.162], [0.05, 0.192], [0.02, 0.192]], 64);
  c.add(dome, shade, 0, -h, 0);
  c.add(sphere(0.045, 16, 10), c.glow('fx-bulb', false), 0, -h + 0.1, 0, { glow: true, noShadow: true });
};

const sconce: Builder = (c) => {
  const [, , d] = c.size;
  const metal = c.mat('metal');
  c.add(cyl(0.05, 0.05, 0.015, 32), metal, 0, 0, 0.0075, { rx: PI / 2 });
  c.add(tube([V(0, 0, 0.01), V(0, 0.02, d * 0.35), V(0, 0.0, d * 0.6)], 0.008, 24, 8), metal);
  c.add(sphere(0.07, 32, 20), c.glow('shade'), 0, 0.02, d * 0.62, { glow: true });
};

// ── Plants ─────────────────────────────────────────────────────────────────

function pot(c: BuildCtx, r: number, h: number, mat: THREE.Material, flare = 1.0) {
  c.add(lathe([[0, 0.01], [r * 0.78, 0], [r * 0.82, 0.02], [r * flare, h], [r * flare - 0.015, h], [r * 0.8, 0.04], [0, 0.04]], 48), mat);
  c.add(cyl(r * flare - 0.02, r * flare - 0.02, 0.01, 32), c.fixed('soil'), 0, h - 0.04, 0);
}

const plantFiddle: Builder = (c) => {
  const [w, h] = c.size;
  const potH = 0.42;
  pot(c, 0.2, potH, c.mat('pot'), 1.0);
  const leafM = c.mat('leaf');
  const bark = c.fixed('bark');
  const trunkTop = h * 0.92;
  const trunk = [V(0, potH - 0.05, 0), V(0.02, potH + 0.3, 0.01), V(-0.02, h * 0.55, 0.02), V(0.01, trunkTop, 0)];
  c.add(tube(trunk, 0.018, 32, 8), bark);
  const leaves: THREE.BufferGeometry[] = [];
  const count = Math.round(26 + w * 14);
  const curve = new THREE.CatmullRomCurve3(trunk);
  for (let i = 0; i < count; i++) {
    const t = 0.35 + 0.65 * (i / count) + (c.rand() - 0.5) * 0.04;
    const p = curve.getPoint(Math.min(1, t));
    const size = 0.2 + c.rand() * 0.12 + (1 - t) * 0.06;
    const g = leafGeometry(size, size * 0.72, { fiddle: true, bend: 0.25 + c.rand() * 0.2, cup: 0.18 });
    const yaw = i * 2.4 + c.rand() * 0.6;
    const elev = 0.05 + t * 0.75 + (c.rand() - 0.5) * 0.3; // younger leaves point up
    const stem = 0.03 + c.rand() * 0.04;
    g.rotateX(-PI / 2);
    g.rotateY(PI);
    g.rotateX(-elev);
    g.rotateZ((c.rand() - 0.5) * 0.5);
    g.rotateY(yaw);
    g.translate(p.x + Math.sin(yaw) * stem, p.y, p.z + Math.cos(yaw) * stem);
    leaves.push(g);
  }
  const m = c.add(mergeAll(leaves), leafM);
  m.userData.keepUV = true;
};

const plantOlive: Builder = (c) => {
  const [w, h] = c.size;
  const potH = 0.46;
  pot(c, 0.22, potH, c.mat('pot'), 1.05);
  const bark = c.fixed('bark');
  const trunk = [V(0, potH - 0.05, 0), V(0.04, potH + 0.25, 0.02), V(-0.03, potH + 0.5, -0.02), V(0.02, h * 0.62, 0)];
  c.add(tube(trunk, 0.03, 32, 8), bark);
  const leafM = c.mat('leaf');
  const leaves: THREE.BufferGeometry[] = [];
  const clusters = 9;
  const branches: THREE.Vector3[][] = [];
  for (let k = 0; k < clusters; k++) {
    const a = (k / clusters) * PI * 2 + c.rand() * 0.5;
    const rr = w * (0.18 + c.rand() * 0.22);
    const cy = h * (0.68 + c.rand() * 0.24);
    const end = V(Math.cos(a) * rr, cy, Math.sin(a) * rr);
    const start = V(0.01, h * 0.6, 0);
    branches.push([start, start.clone().lerp(end, 0.5).add(V(0, 0.05, 0)), end]);
    c.add(tube([start, start.clone().lerp(end, 0.5).add(V(0, 0.05, 0)), end], 0.008, 12, 6), bark);
    const n = 46;
    for (let i = 0; i < n; i++) {
      const g = leafGeometry(0.07 + c.rand() * 0.03, 0.014, { bend: 0.2, cup: 0.1, tip: 0.8 });
      g.rotateX(-PI / 2 + (c.rand() - 0.3) * 1.6);
      g.rotateY(c.rand() * PI * 2);
      const off = V((c.rand() - 0.5) * 0.3, (c.rand() - 0.5) * 0.22, (c.rand() - 0.5) * 0.3);
      g.translate(end.x + off.x, end.y + off.y, end.z + off.z);
      leaves.push(g);
    }
  }
  const m = c.add(mergeAll(leaves), leafM);
  m.userData.keepUV = true;
};

const plantSnake: Builder = (c) => {
  const [, h] = c.size;
  const potH = 0.26;
  pot(c, 0.16, potH, c.mat('pot'), 0.95);
  const leaves: THREE.BufferGeometry[] = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const len = (h - potH) * (0.55 + c.rand() * 0.5);
    const g = leafGeometry(len, 0.055 + c.rand() * 0.02, { bend: -0.05, cup: 0.6, tip: 1.3 });
    const a = c.rand() * PI * 2;
    const rr = c.rand() * 0.08;
    g.rotateY(c.rand() * PI);
    g.rotateX((c.rand() - 0.5) * 0.35);
    g.rotateZ((c.rand() - 0.5) * 0.3);
    g.translate(Math.cos(a) * rr, potH - 0.04, Math.sin(a) * rr);
    leaves.push(g);
  }
  const m = c.add(mergeAll(leaves), c.mat('leaf'));
  m.userData.keepUV = true;
};

const plantSmall: Builder = (c) => {
  const [w, h] = c.size;
  const potH = h * 0.42;
  pot(c, w * 0.36, potH, c.mat('pot'), 1.0);
  const stems: THREE.BufferGeometry[] = [];
  const leaves: THREE.BufferGeometry[] = [];
  const n = 13;
  for (let i = 0; i < n; i++) {
    const a = i * 2.4;
    const rr = 0.03 + c.rand() * 0.07;
    const tipY = potH + 0.04 + c.rand() * (h - potH - 0.06);
    const tip = V(Math.cos(a) * rr, tipY, Math.sin(a) * rr);
    stems.push(tube([V(0, potH - 0.03, 0), V(tip.x * 0.4, (potH + tipY) / 2, tip.z * 0.4), tip], 0.0025, 8, 4));
    const disc = new THREE.CircleGeometry(0.03 + c.rand() * 0.015, 16);
    disc.rotateX(-PI / 2 + 0.35);
    disc.rotateY(a + PI / 2);
    disc.translate(tip.x, tip.y, tip.z);
    leaves.push(disc);
  }
  c.add(mergeAll(stems), c.fixed('fx-branch'));
  const m = c.add(mergeAll(leaves), c.mat('leaf'));
  m.userData.keepUV = true;
};

// ── Decor ──────────────────────────────────────────────────────────────────

function amphora(r: number, h: number): THREE.BufferGeometry {
  const t = 0.007;
  // smooth outer profile through a spline, then the lip and a shallow inside
  const outer = new THREE.SplineCurve([
    new THREE.Vector2(r * 0.5, 0),
    new THREE.Vector2(r * 0.9, h * 0.22),
    new THREE.Vector2(r, h * 0.45),
    new THREE.Vector2(r * 0.72, h * 0.74),
    new THREE.Vector2(r * 0.44, h * 0.9),
    new THREE.Vector2(r * 0.47, h),
  ]).getPoints(28);
  const pts: [number, number][] = [[0, 0], ...outer.map((p) => [p.x, p.y] as [number, number]), [r * 0.47 - t, h], [r * 0.4 - t, h * 0.9], [r * 0.55, h * 0.72], [0, h * 0.62]];
  return lathe(pts, 56);
}

const vaseBranches: Builder = (c) => {
  const [w, h] = c.size;
  const vh = h * 0.42;
  c.add(amphora(w * 0.42, vh), c.mat('vase'));
  const stems: THREE.BufferGeometry[] = [];
  const leaves: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2 + c.rand();
    const lean = 0.08 + c.rand() * 0.16;
    const top = V(Math.cos(a) * lean * 1.4, h - c.rand() * 0.12, Math.sin(a) * lean);
    const mid = V(top.x * 0.35, vh + (h - vh) * 0.45, top.z * 0.35);
    const pts = [V(0, vh * 0.6, 0), mid, top];
    stems.push(tube(pts, 0.003, 16, 4));
    const curve = new THREE.CatmullRomCurve3(pts);
    for (let k = 0; k < 14; k++) {
      const t = 0.45 + (k / 14) * 0.55;
      const p = curve.getPoint(t);
      const disc = new THREE.CircleGeometry(0.018 + c.rand() * 0.01, 10);
      disc.rotateX(-PI / 2 + (c.rand() - 0.5) * 1.4);
      disc.rotateY(c.rand() * PI * 2);
      disc.translate(p.x, p.y, p.z);
      leaves.push(disc);
    }
  }
  c.add(mergeAll(stems), c.fixed('fx-branch'));
  const m = c.add(mergeAll(leaves), c.lib.get('leaf-olive'));
  m.userData.keepUV = true;
};

const vase: Builder = (c) => {
  const [w, h] = c.size;
  c.add(amphora(w / 2, h), c.mat('vase'));
};

const books: Builder = (c) => {
  const [w, , d] = c.size;
  const geos: THREE.BufferGeometry[] = [];
  let y = 0;
  const n = 3 + Math.floor(c.rand() * 2);
  for (let i = 0; i < n; i++) {
    const bh = 0.025 + c.rand() * 0.02;
    const bw = w * (0.75 + c.rand() * 0.25);
    const bd = d * (0.8 + c.rand() * 0.2);
    const g = rbox(bw, bh, bd, 0.003, 1);
    tint(g, BOOK_COLORS[Math.floor(c.rand() * BOOK_COLORS.length)]);
    g.rotateY((c.rand() - 0.5) * 0.25);
    g.translate((c.rand() - 0.5) * 0.02, y + bh / 2, 0);
    geos.push(g);
    y += bh;
  }
  const m = c.add(mergeAll(geos), c.fixed('fx-books'));
  m.userData.keepUV = true;
};

const bowl: Builder = (c) => {
  const [w, h] = c.size;
  const r = w / 2;
  c.add(lathe([[0, 0], [r * 0.4, 0], [r * 0.85, h * 0.45], [r, h * 0.7], [r - 0.006, h * 0.7], [r * 0.82, h * 0.48], [r * 0.38, 0.012], [0, 0.012]], 48), c.mat('bowl'));
  const fruits: [string, number, number, number, number][] = [
    ['fx-orange', 0.0, 0.0, 0.04, 0.0],
    ['fx-orange', 0.07, 0.03, 0.038, 0.0],
    ['fx-lemon', -0.06, 0.04, 0.034, 0.3],
    ['fx-orange', -0.02, -0.07, 0.039, 0],
    ['fx-lemon', 0.05, -0.05, 0.033, 0.8],
  ];
  for (const [m, x, z, rr, rot] of fruits) {
    const g = sphere(rr, 20, 14);
    if (m === 'fx-lemon') g.scale(1.25, 0.95, 0.95);
    g.rotateY(rot);
    const dist = Math.hypot(x, z);
    c.add(g, c.fixed(m), x, 0.02 + rr + dist * 0.35, z);
  }
};

const candles: Builder = (c) => {
  const metal = c.mat('metal');
  const specs: [number, number, number][] = [
    [-0.07, 0.0, 0.14],
    [0.0, 0.02, 0.2],
    [0.07, -0.01, 0.11],
  ];
  for (const [x, z, hh] of specs) {
    c.add(lathe([[0, 0], [0.032, 0], [0.034, 0.008], [0.012, 0.02], [0.009, hh * 0.5], [0.014, hh * 0.9], [0.016, hh], [0, hh]], 32), metal, x, 0, z);
    c.add(cyl(0.011, 0.011, 0.12, 16), c.fixed('fx-wax'), x, hh + 0.06, z);
  }
};

const sculpture: Builder = (c) => {
  const [w, h] = c.size;
  const m = c.mat('material');
  c.add(rbox(w * 0.6, 0.04, 0.09, 0.008), m, 0, 0.02, 0);
  const ring = new THREE.TorusGeometry(h * 0.36, 0.028, 24, 64);
  c.add(ring, m, 0, 0.04 + h * 0.36 + 0.02, 0);
};

const throwBlanket: Builder = (c) => {
  const [w, h, d] = c.size;
  const f = c.mat('fabric');
  for (let i = 0; i < 3; i++) c.add(cushion(w - i * 0.01, h / 3, d - i * 0.008, 0.012, 0.3), f, i * 0.004, (h / 3) * (i + 0.5), 0);
};

// ── Rugs ───────────────────────────────────────────────────────────────────

const rugRect: Builder = (c) => {
  const [w, h, d] = c.size;
  const g = new THREE.BoxGeometry(w, h, d);
  // map the top face once over the rug, preserving the pattern's aspect
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, 0.5 - pos.getZ(i) / d);
  c.add(g, c.mat('rug'), 0, h / 2, 0, { keepUV: true });
};

const rugRound: Builder = (c) => {
  const [w, h] = c.size;
  const g = new THREE.CylinderGeometry(w / 2, w / 2, h, 96);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, 0.5 - pos.getZ(i) / w);
  const def = c.item.materials.rug ?? 'rug-jute';
  // stretch textures don't tile; tiled ones (jute) use metric UVs instead
  c.add(g, c.mat('rug'), 0, h / 2, 0, { keepUV: def !== 'rug-jute' && def !== 'rug-charcoal' });
};

// ── Wall ───────────────────────────────────────────────────────────────────

const artFrame: Builder = (c) => {
  const [w, h, d] = c.size;
  const frame = c.mat('frame');
  const fw = Math.min(0.035, w * 0.06);
  // frame sides
  c.add(box(w, fw, d), frame, 0, h / 2 - fw / 2, d / 2, { grain: 0 });
  c.add(box(w, fw, d), frame, 0, -h / 2 + fw / 2, d / 2, { grain: 0 });
  c.add(box(fw, h - 2 * fw, d), frame, -w / 2 + fw / 2, 0, d / 2, { grain: 1 });
  c.add(box(fw, h - 2 * fw, d), frame, w / 2 - fw / 2, 0, d / 2, { grain: 1 });
  // passe-partout and artwork
  const iw = w - 2 * fw;
  const ih = h - 2 * fw;
  c.add(box(iw, ih, 0.004), c.fixed('fx-white'), 0, 0, d - 0.012, { noShadow: true });
  const mat = w < 0.6 ? 0.06 : 0.0;
  const aw = iw - mat * 2;
  const ah = ih - mat * 2;
  const art = new THREE.PlaneGeometry(aw, ah);
  const uv = art.attributes.uv as THREE.BufferAttribute;
  // crop the square artwork to the frame's aspect
  const ax = aw >= ah ? 1 : aw / ah;
  const ay = ah >= aw ? 1 : ah / aw;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + (uv.getX(i) - 0.5) * ax, 0.5 + (uv.getY(i) - 0.5) * ay);
  c.add(art, c.mat('art'), 0, 0, d - 0.0095, { keepUV: true, noShadow: true });
};

const mirrorRound: Builder = (c) => {
  const [w, , d] = c.size;
  const r = w / 2;
  const ring = new THREE.TorusGeometry(r - 0.015, 0.015, 16, 96);
  c.add(ring, c.mat('frame'), 0, 0, d / 2);
  const disc = new THREE.CircleGeometry(r - 0.02, 96);
  c.add(disc, c.fixed('mirror'), 0, 0, d / 2 + 0.002, { keepUV: true, noShadow: true });
  c.add(cyl(r - 0.02, r - 0.02, 0.01, 64), c.fixed('fx-black'), 0, 0, 0.006, { rx: PI / 2 });
};

const wallShelf: Builder = (c) => {
  const [w, h, d] = c.size;
  c.add(rbox(w, h, d, 0.004), c.mat('wood'), 0, 0, d / 2, { grain: 0 });
};

const tv: Builder = (c) => {
  const [w, h, d] = c.size;
  c.add(rbox(w, h, 0.03, 0.004), c.fixed('fx-black'), 0, 0, d - 0.015);
  c.add(new THREE.PlaneGeometry(w - 0.012, h - 0.012), c.fixed('screen'), 0, 0, d + 0.0005, { keepUV: true, noShadow: true });
  c.add(box(0.3, 0.2, d - 0.03), c.fixed('fx-black'), 0, 0, (d - 0.03) / 2);
};

const BUILDERS: Record<string, Builder> = {
  sofa,
  sectional,
  'lounge-chair': loungeChair,
  'tub-chair': tubChair,
  'dining-chair': diningChair,
  ottoman,
  bench,
  'coffee-round': coffeeRound,
  'coffee-rect': coffeeRect,
  'side-table': sideTable,
  'dining-round': diningRound,
  'dining-rect': diningRect,
  desk,
  bookshelf,
  sideboard,
  'media-console': mediaConsole,
  'arc-lamp': arcLamp,
  'tripod-lamp': tripodLamp,
  'table-lamp': tableLamp,
  'pendant-globe': pendantGlobe,
  'pendant-dome': pendantDome,
  sconce,
  'plant-fiddle': plantFiddle,
  'plant-olive': plantOlive,
  'plant-snake': plantSnake,
  'plant-small': plantSmall,
  'vase-branches': vaseBranches,
  vase,
  books,
  bowl,
  candles,
  sculpture,
  'throw-blanket': throwBlanket,
  'rug-rect': rugRect,
  'rug-round': rugRound,
  'rug-runner': rugRect,
  'art-frame': artFrame,
  'mirror-round': mirrorRound,
  'wall-shelf': wallShelf,
  tv,
};

export interface BuiltItem {
  object: THREE.Group;
  glowMaterials: THREE.MeshStandardMaterial[];
}

/** Build and optimise the model for an item instance. */
export function buildItem(lib: MaterialLibrary, item: ItemInstance): BuiltItem {
  const size = itemSize(item.type, item.variant);
  const ctx = new BuildCtx(lib, item, size);
  const builder = BUILDERS[item.type];
  if (builder) builder(ctx);
  else ctx.add(box(size[0], size[1], size[2]), lib.get('paint-white'), 0, size[1] / 2, 0);
  return finalize(ctx.group);
}

/** Bake transforms, generate metric UVs and merge meshes that share a material. */
function finalize(group: THREE.Group): BuiltItem {
  const buckets = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; shadow: boolean; glow: boolean }>();
  const glowMaterials = new Set<THREE.MeshStandardMaterial>();
  group.updateMatrixWorld(true);
  for (const child of [...group.children]) {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) continue;
    const ud = mesh.userData as AddOpts;
    const g = mesh.geometry.clone();
    g.applyMatrix4(mesh.matrix);
    if (!ud.keepUV) {
      // metric UVs in item space; grain hint follows the part's rotation
      if (!g.attributes.normal) g.computeVertexNormals();
      worldUVs(g, ud.grain === undefined ? undefined : axisAfter(mesh, ud.grain));
    }
    const mat = mesh.material as THREE.MeshStandardMaterial;
    const def = mat.userData?.def;
    const transparent = mat.transparent || def?.category === 'glass';
    const shadow = !ud.noShadow && !transparent;
    if (ud.glow) glowMaterials.add(mat);
    const key = `${mat.uuid}|${shadow}|${!!ud.glow}`;
    let b = buckets.get(key);
    if (!b) {
      b = { mat, geos: [], shadow, glow: !!ud.glow };
      buckets.set(key, b);
    }
    b.geos.push(g);
    group.remove(mesh);
    mesh.geometry.dispose();
  }
  for (const b of buckets.values()) {
    const geo = b.geos.length === 1 ? b.geos[0] : mergeAll(b.geos);
    const m = new THREE.Mesh(geo, b.mat);
    m.castShadow = b.shadow;
    m.receiveShadow = true;
    m.userData.glow = b.glow;
    group.add(m);
  }
  return { object: group, glowMaterials: [...glowMaterials] };
}

/** Map a part-local grain axis to the item frame after the part's rotation. */
function axisAfter(mesh: THREE.Mesh, axis: 0 | 1 | 2): 0 | 1 | 2 {
  const v = new THREE.Vector3(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0).applyQuaternion(mesh.quaternion);
  const a = [Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)];
  return a.indexOf(Math.max(...a)) as 0 | 1 | 2;
}
