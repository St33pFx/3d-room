import * as THREE from 'three';
import { HALF_D, HALF_W, ROOM, WALL_IDS, WALLS, type Opening, type WallSpec } from '../core/room';
import type { RoomFinishes, WallId } from '../core/types';
import type { MaterialLibrary } from './MaterialLibrary';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { box, cyl, mergeAll, rbox, worldUVs } from './geo';

// The architectural shell: walls with real openings, floor, ceiling,
// joinery (windows, garden door, entry door, baseboards) and the garden that
// is visible through the glazing.

const T = ROOM.wallThickness;

/** Invisible material that still casts shadows (used for cut-away walls). */
function ghost(): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  m.name = 'ghost';
  return m;
}

export interface WallParts {
  id: WallId;
  mesh: THREE.Mesh;
  stub: THREE.Mesh;
  joinery: THREE.Group;
  cut: boolean;
}

export class RoomShell {
  readonly group = new THREE.Group();
  readonly walls = new Map<WallId, WallParts>();
  floor!: THREE.Mesh;
  ceiling!: THREE.Mesh;
  readonly pickables: THREE.Object3D[] = [];
  /** glass panes, for window-light placement */
  readonly openings: { wall: WallSpec; opening: Opening }[] = [];
  private ghostMat = ghost();
  private revealMat: THREE.MeshStandardMaterial;
  private trimMeshes: THREE.Mesh[] = [];
  private frameMeshes: THREE.Mesh[] = [];
  private exterior = new THREE.Group();
  private finishes?: RoomFinishes;
  ceilingVisible = true;

  constructor(private lib: MaterialLibrary) {
    this.revealMat = new THREE.MeshStandardMaterial({ color: '#efebe4', roughness: 0.9 });
    this.group.name = 'shell';
    this.buildFloorCeiling();
    for (const id of WALL_IDS) this.buildWall(WALLS[id]);
    this.buildExterior();
    this.group.add(this.exterior);
  }

  private buildFloorCeiling() {
    const g = new THREE.PlaneGeometry(ROOM.width, ROOM.depth);
    g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), -pos.getZ(i));
    this.floor = new THREE.Mesh(g, this.lib.get('floor-oak-planks'));
    this.floor.receiveShadow = true;
    this.floor.userData.surface = 'floor';
    this.floor.name = 'floor';
    this.group.add(this.floor);
    this.pickables.push(this.floor);

    // structural slab under the floor (visible from the dollhouse view)
    const slab = new THREE.Mesh(box(ROOM.width + 2 * T, 0.32, ROOM.depth + 2 * T), this.lib.get('ext-plinth'));
    slab.position.y = -0.16 - 0.001;
    slab.receiveShadow = true;
    this.group.add(slab);

    const cg = new THREE.BoxGeometry(ROOM.width + 2 * T, 0.12, ROOM.depth + 2 * T);
    const cuv = cg.attributes.uv as THREE.BufferAttribute;
    const cpos = cg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < cuv.count; i++) cuv.setXY(i, cpos.getX(i), cpos.getZ(i));
    this.ceiling = new THREE.Mesh(cg, this.lib.get('paint-white'));
    this.ceiling.position.y = ROOM.height + 0.06;
    this.ceiling.castShadow = true;
    this.ceiling.receiveShadow = true;
    this.ceiling.userData.surface = 'ceiling';
    this.ceiling.name = 'ceiling';
    this.group.add(this.ceiling);
    this.pickables.push(this.ceiling);
  }

  private wallMatrix(w: WallSpec): THREE.Matrix4 {
    const dir = new THREE.Vector3(w.dir[0], 0, w.dir[1]);
    const up = new THREE.Vector3(0, 1, 0);
    const n = new THREE.Vector3(w.normal[0], 0, w.normal[1]);
    const m = new THREE.Matrix4().makeBasis(dir, up, n);
    m.setPosition(w.origin[0], 0, w.origin[1]);
    return m;
  }

  private buildWall(w: WallSpec) {
    // North/south walls run past the corners so the shell is watertight.
    const ext = w.id === 'north' || w.id === 'south' ? T : 0;
    const shape = new THREE.Shape();
    shape.moveTo(-ext, 0);
    shape.lineTo(w.length + ext, 0);
    shape.lineTo(w.length + ext, ROOM.height);
    shape.lineTo(-ext, ROOM.height);
    shape.lineTo(-ext, 0);
    for (const o of w.openings) {
      const hole = new THREE.Path();
      const u0 = o.u - o.width / 2;
      const u1 = o.u + o.width / 2;
      const y0 = Math.max(0.0005, o.sill);
      hole.moveTo(u0, y0);
      hole.lineTo(u0, o.sill + o.height);
      hole.lineTo(u1, o.sill + o.height);
      hole.lineTo(u1, y0);
      hole.lineTo(u0, y0);
      shape.holes.push(hole);
      this.openings.push({ wall: w, opening: o });
    }
    const g = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 1 });
    g.translate(0, 0, -T);
    const matrix = this.wallMatrix(w);
    const mesh = new THREE.Mesh(g, [this.lib.get('paint-warm-white'), this.revealMat]);
    mesh.applyMatrix4(matrix);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.surface = 'wall';
    mesh.userData.wall = w.id;
    mesh.name = `wall-${w.id}`;
    this.group.add(mesh);
    this.pickables.push(mesh);

    // Low stub shown when the wall is cut away for the dollhouse view.
    const stubH = 0.14;
    const sg = new THREE.BoxGeometry(w.length + 2 * ext, stubH, T);
    sg.translate(w.length / 2, stubH / 2, -T / 2);
    const stub = new THREE.Mesh(sg, this.revealMat);
    stub.applyMatrix4(matrix);
    stub.visible = false;
    stub.receiveShadow = true;
    stub.userData.surface = 'wall';
    stub.userData.wall = w.id;
    this.group.add(stub);

    const joinery = new THREE.Group();
    joinery.applyMatrix4(matrix);
    this.buildJoinery(w, joinery);
    this.group.add(joinery);

    this.walls.set(w.id, { id: w.id, mesh, stub, joinery, cut: false });
  }

  private buildJoinery(w: WallSpec, g: THREE.Group) {
    // Coordinates: x = u along the wall, y up, z = into the room (0 = wall face).
    const trim = this.lib.get('paint-warm-white');
    const frame = this.lib.get('steel-black');
    const glass = this.lib.get('glass-clear');
    const addTrim = (geo: THREE.BufferGeometry, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(geo, trim);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      this.trimMeshes.push(m);
      return m;
    };
    const frameParts: THREE.BufferGeometry[] = [];
    const addFrame = (geo: THREE.BufferGeometry, x: number, y: number, z: number) => {
      geo.translate(x, y, z);
      frameParts.push(geo);
    };

    // Baseboards, interrupted by doors.
    const bh = ROOM.baseboard;
    const cuts = w.openings.filter((o) => o.sill < 0.01).map((o) => [o.u - o.width / 2 - 0.06, o.u + o.width / 2 + 0.06]);
    let start = 0;
    const segs: [number, number][] = [];
    for (const [a, b] of cuts.sort((p, q) => p[0] - q[0])) {
      if (a > start) segs.push([start, a]);
      start = b;
    }
    if (start < w.length) segs.push([start, w.length]);
    for (const [a, b] of segs) addTrim(box(b - a, bh, 0.016), (a + b) / 2, bh / 2, 0.008);

    for (const o of w.openings) {
      const u0 = o.u - o.width / 2;
      const u1 = o.u + o.width / 2;
      const top = o.sill + o.height;
      const fw = 0.05;
      const fd = 0.07;
      const zMid = -T / 2;
      if (o.kind === 'door') {
        // casing on the room side
        const cw = 0.07;
        addTrim(box(cw, top + cw, 0.02), u0 - cw / 2, (top + cw) / 2, 0.01);
        addTrim(box(cw, top + cw, 0.02), u1 + cw / 2, (top + cw) / 2, 0.01);
        addTrim(box(o.width + 2 * cw, cw, 0.02), o.u, top + cw / 2, 0.01);
        // jamb lining
        addTrim(box(0.02, top, T), u0 + 0.01, top / 2, -T / 2);
        addTrim(box(0.02, top, T), u1 - 0.01, top / 2, -T / 2);
        addTrim(box(o.width, 0.02, T), o.u, top - 0.01, -T / 2);
        // leaf with two shaker panels
        const leaf = addTrim(rbox(o.width - 0.05, top - 0.015, 0.04, 0.004), o.u, (top - 0.015) / 2, -0.035);
        leaf.userData.door = true;
        for (const [py, ph] of [
          [0.55, 0.75],
          [1.5, 0.95],
        ]) {
          addTrim(box(o.width - 0.26, ph, 0.012), o.u, py, -0.012);
        }
        // lever handle
        addFrame(cyl(0.025, 0.025, 0.012, 20).rotateX(Math.PI / 2), u1 - 0.1, 1.02, -0.005);
        addFrame(box(0.13, 0.016, 0.016), u1 - 0.15, 1.02, 0.03);
        addFrame(cyl(0.008, 0.008, 0.035, 10).rotateX(Math.PI / 2), u1 - 0.1, 1.02, 0.012);
        continue;
      }
      // window / glazed door frame (slim steel)
      addFrame(box(fw, o.height, fd), u0 + fw / 2, o.sill + o.height / 2, zMid);
      addFrame(box(fw, o.height, fd), u1 - fw / 2, o.sill + o.height / 2, zMid);
      addFrame(box(o.width, fw, fd), o.u, top - fw / 2, zMid);
      addFrame(box(o.width, fw, fd), o.u, o.sill + fw / 2, zMid);
      const panes = o.width > 1.6 ? 3 : 2;
      for (let i = 1; i < panes; i++) {
        addFrame(box(0.035, o.height, fd * 0.8), u0 + (o.width / panes) * i, o.sill + o.height / 2, zMid);
      }
      if (o.kind === 'window') {
        addFrame(box(o.width, 0.03, fd * 0.8), o.u, o.sill + o.height * 0.78, zMid);
        // interior sill board
        addTrim(rbox(o.width + 0.08, 0.03, T / 2 + 0.05, 0.006), o.u, o.sill - 0.015, -T / 4 + 0.025);
      } else {
        // door handles on the glazed door
        addFrame(box(0.02, 0.3, 0.02), o.u - 0.06, 1.05, zMid + fd / 2 + 0.03);
        addFrame(box(0.02, 0.3, 0.02), o.u + 0.06, 1.05, zMid + fd / 2 + 0.03);
        // threshold
        addTrim(box(o.width, 0.012, T), o.u, 0.006, -T / 2);
      }
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(o.width - 0.04, o.height - 0.04), glass);
      pane.position.set(o.u, o.sill + o.height / 2, zMid);
      pane.renderOrder = 2;
      pane.userData.glass = true;
      g.add(pane);
      // reveal returns (plaster) visible inside the opening are part of the wall sides
    }
    if (frameParts.length) {
      const fm = new THREE.Mesh(mergeAll(frameParts), frame);
      fm.castShadow = true;
      fm.receiveShadow = true;
      g.add(fm);
      this.frameMeshes.push(fm);
    }
  }

  private buildExterior() {
    const ex = this.exterior;
    ex.name = 'exterior';
    // lawn
    const lawn = new THREE.Mesh(new THREE.CircleGeometry(90, 64), this.lib.get('ext-lawn'));
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.y = -0.33;
    lawn.receiveShadow = true;
    const luv = lawn.geometry.attributes.uv as THREE.BufferAttribute;
    const lpos = lawn.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < luv.count; i++) luv.setXY(i, lpos.getX(i), lpos.getY(i));
    ex.add(lawn);

    // terrace deck outside the garden door
    const deck = new THREE.Mesh(box(3.2, 0.06, 4.6), this.lib.get('ext-deck'));
    deck.position.set(-HALF_W - T - 1.6, -0.06, -0.8);
    deck.receiveShadow = true;
    deck.castShadow = true;
    ex.add(deck);
    // gravel strip around the house
    const gravel = new THREE.Mesh(box(ROOM.width + 2 * T + 1.2, 0.04, ROOM.depth + 2 * T + 1.2), this.lib.get('ext-gravel'));
    gravel.position.set(0, -0.31, 0);
    gravel.receiveShadow = true;
    ex.add(gravel);

    // garden trees, hedge and a distant tree line
    const foliage = this.lib.get('ext-foliage');
    const trunk = this.lib.get('ext-bark');
    const rnd = mulberry(4);
    const leafGeos: THREE.BufferGeometry[] = [];
    const trunkGeos: THREE.BufferGeometry[] = [];
    const blob = (r: number, x: number, y: number, z: number, sy = 1) => {
      // lumpy icosphere so canopies read as foliage clusters, not balls
      const g = mergeVertices(new THREE.IcosahedronGeometry(r, 2).deleteAttribute('normal').deleteAttribute('uv'));
      const p = g.attributes.position as THREE.BufferAttribute;
      const seed = rnd() * 10;
      for (let i = 0; i < p.count; i++) {
        const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
        const k = 1 + 0.16 * Math.sin(vx * 5 + seed) * Math.cos(vz * 4.3 - seed) + 0.08 * Math.sin(vy * 7 + seed * 2);
        p.setXYZ(i, vx * k, vy * k * sy, vz * k);
      }
      g.computeVertexNormals();
      worldUVs(g);
      leafGeos.push(g.translate(x, y, z));
    };
    const tree = (x: number, z: number, s: number) => {
      const th = 1.9 * s;
      trunkGeos.push(cyl(0.07 * s, 0.13 * s, th + 0.6 * s, 7).translate(x, (th + 0.6 * s) / 2 - 0.33, z));
      const n = 9 + Math.floor(rnd() * 5);
      for (let k = 0; k < n; k++) {
        const a = rnd() * Math.PI * 2;
        const rr = rnd() * 0.9 * s;
        blob((0.55 + rnd() * 0.45) * s, x + Math.cos(a) * rr, th + 0.4 * s + rnd() * 1.5 * s, z + Math.sin(a) * rr, 0.85);
      }
    };
    const near: [number, number, number][] = [
      [-9.5, -12.5, 1.25],
      [-3.0, -15.5, 1.5],
      [4.5, -13.0, 1.15],
      [11.5, -11.5, 1.4],
      [-14.5, -4.0, 1.3],
      [-16.0, 5.5, 1.45],
      [14.0, 1.0, 1.2],
      [12.0, 13.0, 1.3],
      [-11.0, 15.0, 1.2],
    ];
    for (const [x, z, s] of near) tree(x, z, s);
    // distant tree line closing the horizon
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + rnd() * 0.08;
      const r = 34 + rnd() * 12;
      tree(Math.cos(a) * r, Math.sin(a) * r, 1.4 + rnd() * 1.1);
    }
    // clipped hedge behind the windows
    for (let i = 0; i < 26; i++) blob(0.5 + rnd() * 0.18, -13 + i * 1.0, 0.15, -12.5 + (rnd() - 0.5) * 0.3, 0.85);
    const leaves = new THREE.Mesh(mergeAll(leafGeos), foliage);
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    ex.add(leaves);
    const trunks = new THREE.Mesh(mergeAll(trunkGeos), trunk);
    trunks.castShadow = true;
    ex.add(trunks);
  }

  setFinishes(f: RoomFinishes) {
    const prev = this.finishes;
    this.finishes = f;
    if (!prev || prev.floor !== f.floor) this.floor.material = this.lib.get(f.floor);
    if ((!prev || prev.ceiling !== f.ceiling) && this.ceilingVisible) this.ceiling.material = this.lib.get(f.ceiling);
    for (const id of WALL_IDS) {
      const parts = this.walls.get(id)!;
      if (!prev || prev.walls[id] !== f.walls[id] || !parts.cut) {
        if (!parts.cut) (parts.mesh.material as THREE.Material[])[0] = this.lib.get(f.walls[id]);
        parts.mesh.userData.finish = f.walls[id];
      }
    }
    if (!prev || prev.trim !== f.trim) {
      const m = this.lib.get(f.trim);
      for (const t of this.trimMeshes) t.material = m;
      this.revealMat.color.set(this.lib.get(f.trim).userData.def?.category === 'paint' ? this.lib.get(f.trim).userData.def.color : '#efebe4');
    }
    if (!prev || prev.frames !== f.frames) {
      const m = this.lib.get(f.frames);
      for (const t of this.frameMeshes) t.material = m;
    }
  }

  /** Hide walls that face away from the camera (dollhouse cut-away). */
  updateCutaway(camPos: THREE.Vector3, enabled: boolean) {
    for (const id of WALL_IDS) {
      const w = WALLS[id];
      const parts = this.walls.get(id)!;
      // signed distance of the camera from the wall's interior face
      const d = (camPos.x - w.origin[0]) * w.normal[0] + (camPos.z - w.origin[1]) * w.normal[1];
      const inside = Math.abs(camPos.x) < HALF_W + 0.05 && Math.abs(camPos.z) < HALF_D + 0.05;
      const cut = enabled && d < 0.05 && !(inside && camPos.y < ROOM.height);
      if (cut === parts.cut) continue;
      parts.cut = cut;
      const mats = parts.mesh.material as THREE.Material[];
      mats[0] = cut ? this.ghostMat : this.lib.get(this.finishes?.walls[id] ?? 'paint-white');
      mats[1] = cut ? this.ghostMat : this.revealMat;

      parts.stub.visible = cut;
      parts.joinery.visible = !cut;
      parts.mesh.userData.cut = cut;
    }
    // Ceiling: visible only when the camera is below it.
    const showCeiling = !enabled || camPos.y < ROOM.height - 0.05;
    if (showCeiling !== this.ceilingVisible) {
      this.ceilingVisible = showCeiling;
      this.ceiling.material = showCeiling ? this.lib.get(this.finishes?.ceiling ?? 'paint-white') : this.ghostMat;

    }
  }

  /** Temporarily show everything (environment capture). */
  withAllVisible(fn: () => void) {
    const saved: [WallParts, THREE.Material[], boolean][] = [];
    for (const parts of this.walls.values()) {
      saved.push([parts, [...(parts.mesh.material as THREE.Material[])], parts.joinery.visible]);
      const id = parts.id;
      (parts.mesh.material as THREE.Material[])[0] = this.lib.get(this.finishes?.walls[id] ?? 'paint-white');
      (parts.mesh.material as THREE.Material[])[1] = this.revealMat;
      parts.joinery.visible = true;
    }
    const ceil = this.ceiling.material;
    this.ceiling.material = this.lib.get(this.finishes?.ceiling ?? 'paint-white');
    this.exterior.visible = true;
    fn();
    this.ceiling.material = ceil;
    for (const [parts, mats, jv] of saved) {
      (parts.mesh.material as THREE.Material[])[0] = mats[0];
      (parts.mesh.material as THREE.Material[])[1] = mats[1];
      parts.joinery.visible = jv;
    }
  }

  /** Materials of the garden, lit by the sky rather than the interior probe. */
  static readonly EXTERIOR_MATERIALS = ['ext-lawn', 'ext-deck', 'ext-gravel', 'ext-foliage', 'ext-bark', 'ext-plinth'];

  isCut(id: WallId): boolean {
    return this.walls.get(id)?.cut ?? false;
  }
}

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
