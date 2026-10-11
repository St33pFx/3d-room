import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Geometry helpers for procedural furniture modelling.

export function box(w: number, h: number, d: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d);
}

export function rbox(w: number, h: number, d: number, r: number, seg = 3): THREE.BufferGeometry {
  const rr = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  return new RoundedBoxGeometry(w, h, d, seg, Math.max(0.001, rr));
}

/** Upholstered cushion: a rounded box whose faces bulge out softly. */
export function cushion(w: number, h: number, d: number, r: number, puff = 0.18, seg = 5): THREE.BufferGeometry {
  const g = rbox(w, h, d, r, seg);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const fx = 1 - Math.pow(Math.abs(x) / hw, 2);
    const fy = 1 - Math.pow(Math.abs(y) / hh, 2);
    const fz = 1 - Math.pow(Math.abs(z) / hd, 2);
    // vertical puff on top/bottom faces, slight belly on the sides
    pos.setY(i, y * (1 + puff * fx * fz));
    pos.setZ(i, z * (1 + puff * 0.35 * fx * fy));
    pos.setX(i, x * (1 + puff * 0.15 * fy * fz));
  }
  g.computeVertexNormals();
  return g;
}

export function cyl(rt: number, rb: number, h: number, seg = 32, open = false): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
}

/** Lathe from [radius, y] pairs. */
export function lathe(profile: [number, number][], seg = 48): THREE.BufferGeometry {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)),
    seg,
  );
}

/** Disc with a softly rounded edge (table tops, cushions). */
export function roundedDisc(r: number, h: number, edge: number, seg = 64): THREE.BufferGeometry {
  const pts: [number, number][] = [[0, -h / 2]];
  const e = Math.min(edge, h / 2, r);
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * (Math.PI / 2);
    pts.push([r - e + Math.cos(a) * e, -h / 2 + e + Math.sin(a) * e]);
  }
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    pts.push([r - e + Math.cos(a) * e, h / 2 - e + Math.sin(a) * e]);
  }
  pts.push([0, h / 2]);
  return lathe(pts, seg);
}

export function tube(points: THREE.Vector3[], radius: number, tubular = 48, radial = 10): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return new THREE.TubeGeometry(curve, tubular, radius, radial, false);
}

export function sphere(r: number, ws = 32, hs = 20): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, ws, hs);
}

/** Bend a geometry along X around the Y axis (positive k bends toward -Z). */
export function bendX(g: THREE.BufferGeometry, radius: number): THREE.BufferGeometry {
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const a = x / radius;
    const r = radius - z;
    pos.setX(i, Math.sin(a) * r);
    pos.setZ(i, radius - Math.cos(a) * r);
  }
  g.computeVertexNormals();
  return g;
}

/** Leaf shape lying in XY (y along the leaf), bent and cupped. */
export function leafGeometry(length: number, width: number, opts: { fiddle?: boolean; bend?: number; cup?: number; tip?: number } = {}): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const L = length;
  const W = width / 2;
  if (opts.fiddle) {
    s.moveTo(0, 0);
    s.bezierCurveTo(W * 0.5, L * 0.05, W * 0.9, L * 0.25, W * 0.8, L * 0.45);
    s.bezierCurveTo(W * 1.05, L * 0.7, W * 1.0, L * 0.95, 0, L);
    s.bezierCurveTo(-W * 1.0, L * 0.95, -W * 1.05, L * 0.7, -W * 0.8, L * 0.45);
    s.bezierCurveTo(-W * 0.9, L * 0.25, -W * 0.5, L * 0.05, 0, 0);
  } else {
    const tip = opts.tip ?? 1;
    s.moveTo(0, 0);
    s.bezierCurveTo(W * 1.1, L * 0.2, W * 1.0, L * 0.7 * tip, 0, L);
    s.bezierCurveTo(-W * 1.0, L * 0.7 * tip, -W * 1.1, L * 0.2, 0, 0);
  }
  const g = new THREE.ShapeGeometry(s, 6);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const bend = opts.bend ?? 0.25;
  const cup = opts.cup ?? 0.3;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const t = y / L;
    uv.setXY(i, x / (2 * W) + 0.5, t);
    // droop along the length and cup across the width
    const z = -bend * L * t * t + cup * (x * x) / (W || 1);
    pos.setZ(i, z);
  }
  g.computeVertexNormals();
  return g;
}

/** Merge geometries after making their attribute sets compatible. */
export function mergeAll(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prepared = geos.map((g) => {
    let gg = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(gg.attributes)) {
      if (!['position', 'normal', 'uv', 'color'].includes(name)) gg.deleteAttribute(name);
    }
    if (!gg.attributes.uv) {
      gg.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2));
    }
    if (!gg.attributes.normal) gg.computeVertexNormals();
    if (gg === g) gg = g.clone();
    return gg;
  });
  const hasColor = prepared.some((g) => g.attributes.color);
  if (hasColor) {
    for (const g of prepared) {
      if (!g.attributes.color) {
        const arr = new Float32Array(g.attributes.position.count * 3).fill(1);
        g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
      }
    }
  } else {
    for (const g of prepared) if (g.attributes.color) g.deleteAttribute('color');
  }
  const merged = mergeGeometries(prepared, false);
  return merged ?? prepared[0];
}

/** Paint a whole geometry with a vertex colour. */
export function tint(g: THREE.BufferGeometry, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
  return g;
}

/**
 * Box-projected UVs in meters, computed in the item's local frame so textures
 * keep a real-world scale. The grain (texture U) follows the longest axis of
 * each part.
 */
export function worldUVs(g: THREE.BufferGeometry, grainAxis?: 0 | 1 | 2) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nor = g.attributes.normal as THREE.BufferAttribute;
  if (!nor) return;
  g.computeBoundingBox();
  const size = new THREE.Vector3();
  g.boundingBox!.getSize(size);
  const ext = [size.x, size.y, size.z];
  const grain = grainAxis ?? (ext.indexOf(Math.max(...ext)) as 0 | 1 | 2);
  const uvs = new Float32Array(pos.count * 2);
  const p = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    p[0] = pos.getX(i);
    p[1] = pos.getY(i);
    p[2] = pos.getZ(i);
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    const dom = nx > ny && nx > nz ? 0 : ny > nz ? 1 : 2;
    const others = [0, 1, 2].filter((a) => a !== dom);
    let ua = others[0];
    let va = others[1];
    if (va === grain) [ua, va] = [va, ua];
    else if (ua !== grain && ext[va] > ext[ua]) [ua, va] = [va, ua];
    uvs[i * 2] = p[ua];
    uvs[i * 2 + 1] = p[va];
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
}
