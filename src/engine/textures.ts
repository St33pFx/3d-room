import type { TextureSpec } from '../core/materials';

// Procedural, tileable texture synthesis on the CPU. Every generator writes a
// colour buffer and a height buffer; normal and roughness maps are derived from
// those. Deterministic (seeded) so designs look identical between sessions.

export interface TextureMaps {
  size: number;
  color: Uint8ClampedArray; // RGBA
  normal?: Uint8ClampedArray; // RGBA
  rough?: Uint8ClampedArray; // RGBA (G channel used)
}

type RGB = [number, number, number];

// ── Utilities ──────────────────────────────────────────────────────────────

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function scale(a: RGB, s: number): RGB {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function fract(x: number): number {
  return x - Math.floor(x);
}

export function rng(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

class Noise {
  private perm = new Uint8Array(512);
  private vals = new Float32Array(256);
  constructor(seed: number) {
    const r = rng(seed + 1);
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    for (let i = 0; i < 256; i++) this.vals[i] = r();
  }
  private h(ix: number, iy: number): number {
    return this.vals[this.perm[(this.perm[ix & 255] + iy) & 255]];
  }
  /** Tileable value noise; x, y in [0, px) x [0, py) wrap seamlessly. */
  get(x: number, y: number, px: number, py: number = px): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    let fx = x - ix;
    let fy = y - iy;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const x0 = ((ix % px) + px) % px;
    const y0 = ((iy % py) + py) % py;
    const x1 = (x0 + 1) % px;
    const y1 = (y0 + 1) % py;
    const a = this.h(x0, y0);
    const b = this.h(x1, y0);
    const c = this.h(x0, y1);
    const d = this.h(x1, y1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  /** fbm over the unit tile; u, v in [0,1). fx, fy = base frequencies (integers). */
  fbm(u: number, v: number, fx: number, fy: number, oct = 4): number {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    for (let o = 0; o < oct; o++) {
      sum += amp * this.get(u * fx, v * fy, fx, fy);
      norm += amp;
      amp *= 0.5;
      fx *= 2;
      fy *= 2;
    }
    return sum / norm;
  }
}

class Buffers {
  color: Float32Array;
  height: Float32Array;
  rough: Float32Array;
  constructor(public size: number) {
    this.color = new Float32Array(size * size * 3);
    this.height = new Float32Array(size * size);
    this.rough = new Float32Array(size * size).fill(1);
  }
  set(i: number, c: RGB, h = 0, r = 1) {
    this.color[i * 3] = c[0];
    this.color[i * 3 + 1] = c[1];
    this.color[i * 3 + 2] = c[2];
    this.height[i] = h;
    this.rough[i] = r;
  }
}

// ── Wood grain helper (used by furniture wood, planks, herringbone, slats) ──

function grain(n: Noise, u: number, v: number, offset: number, rings = 22): { dark: number; fiber: number } {
  // u runs along the grain. v across. Both in [0,1) and the result tiles.
  const warp = n.fbm(u, v, 2, 4, 3) * 1.1;
  const t = v * rings + warp * 2.2 + offset;
  const band = fract(t);
  const ring = Math.pow(smoothstep(0.0, 0.85, band) * (1 - smoothstep(0.85, 1.0, band)), 1.6);
  const fiber = n.get(u * 6, v * 380, 6, 380);
  const fine = n.get(u * 3, v * 140, 3, 140);
  return { dark: ring * 0.5 + fine * 0.32 + fiber * 0.18, fiber };
}

// ── Generators ─────────────────────────────────────────────────────────────

type Gen = (b: Buffers, spec: TextureSpec, n: Noise, r: () => number) => void;

const woodgrain: Gen = (b, spec, n) => {
  const [c0, c1, c2] = spec.colors.map(hexToRgb) as RGB[];
  const S = b.size;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      const g = grain(n, u, v, 0, 22);
      const tone = n.fbm(u, v, 1, 2, 2);
      let c = mix(c2, c1, g.dark * 0.75);
      c = mix(c, c0, 0.4 + tone * 0.3);
      b.set(y * S + x, c, -g.dark * 0.6 + g.fiber * 0.25, 0.92 + g.dark * 0.16);
    }
  }
};

/** Rasterise rectangles (in tile units, wrapping) into an id buffer. */
function rasterRects(
  S: number,
  tile: number,
  rects: { x0: number; y0: number; x1: number; y1: number }[],
): { id: Int32Array; lu: Float32Array; lv: Float32Array } {
  const id = new Int32Array(S * S).fill(-1);
  const lu = new Float32Array(S * S);
  const lv = new Float32Array(S * S);
  const k = S / tile;
  rects.forEach((rc, i) => {
    const px0 = Math.round(rc.x0 * k);
    const px1 = Math.round(rc.x1 * k);
    const py0 = Math.round(rc.y0 * k);
    const py1 = Math.round(rc.y1 * k);
    for (let py = py0; py < py1; py++) {
      const yy = ((py % S) + S) % S;
      for (let px = px0; px < px1; px++) {
        const xx = ((px % S) + S) % S;
        const j = yy * S + xx;
        id[j] = i;
        lu[j] = (px - px0 + 0.5) / Math.max(1, px1 - px0);
        lv[j] = (py - py0 + 0.5) / Math.max(1, py1 - py0);
      }
    }
  });
  return { id, lu, lv };
}

function plankShade(
  b: Buffers,
  n: Noise,
  colors: RGB[],
  rects: { x0: number; y0: number; x1: number; y1: number; vertical?: boolean; tint: number; off: number }[],
  tile: number,
  seam: number,
) {
  const S = b.size;
  const { id, lu, lv } = rasterRects(S, tile, rects);
  const [c0, c1, c2] = colors;
  for (let j = 0; j < S * S; j++) {
    const i = id[j];
    if (i < 0) {
      b.set(j, scale(c1, 0.45), -1, 1.1);
      continue;
    }
    const rc = rects[i];
    const lenPx = ((rc.vertical ? rc.y1 - rc.y0 : rc.x1 - rc.x0) / tile) * S;
    const widPx = ((rc.vertical ? rc.x1 - rc.x0 : rc.y1 - rc.y0) / tile) * S;
    const along = rc.vertical ? lv[j] : lu[j];
    const across = rc.vertical ? lu[j] : lv[j];
    const g = grain(n, fract(along * 0.37 + rc.off), fract(across * 0.11 + rc.off * 3.1), rc.off * 7, 26);
    let c = mix(c2, c1, g.dark * 0.55);
    c = mix(c, c0, 0.5);
    c = scale(c, 0.92 + rc.tint * 0.14);
    // Bevel at plank edges
    const ea = Math.min(along, 1 - along) * lenPx;
    const ec = Math.min(across, 1 - across) * widPx;
    const e = Math.min(ea, ec);
    const bevel = smoothstep(0, seam, e);
    c = scale(c, 0.72 + 0.28 * bevel);
    b.set(j, c, bevel * 0.8 - g.dark * 0.25 + g.fiber * 0.1, 0.9 + g.dark * 0.2 + (1 - bevel) * 0.2);
  }
}

const planks: Gen = (b, spec, n, r) => {
  const colors = spec.colors.map(hexToRgb);
  const rows = 12; // 2.4m / 0.2m
  const rects: { x0: number; y0: number; x1: number; y1: number; tint: number; off: number }[] = [];
  const T = 1;
  for (let row = 0; row < rows; row++) {
    const y0 = row / rows;
    const y1 = (row + 1) / rows;
    let x = r();
    const start = x;
    while (x < start + 1 - 1e-6) {
      const len = Math.min(0.32 + r() * 0.42, start + 1 - x);
      if (start + 1 - (x + len) < 0.12) {
        rects.push({ x0: x, y0, x1: start + 1, y1, tint: r(), off: r() });
        break;
      }
      rects.push({ x0: x, y0, x1: x + len, y1, tint: r(), off: r() });
      x += len;
    }
  }
  plankShade(b, n, colors, rects, T, 2.2);
};

const herringbone: Gen = (b, spec, n, r) => {
  const colors = spec.colors.map(hexToRgb);
  const N = 5; // plank length / width
  const T = 2 * N; // tile in plank widths
  const rects: { x0: number; y0: number; x1: number; y1: number; vertical?: boolean; tint: number; off: number }[] = [];
  for (let j = -3; j <= 3; j++) {
    for (let k = -2 * T; k <= 2 * T; k++) {
      const hx = k + N * j;
      const hy = k - N * j;
      if (hx > T + N || hx + N < -N || hy > T + N || hy < -N - 1) {
        // still push wrapped copies only if in range; skip far ones
      }
      const inRange = (x: number, y: number) => x > -2 * T && x < 2 * T && y > -2 * T && y < 2 * T;
      if (!inRange(hx, hy)) continue;
      rects.push({ x0: hx, y0: hy, x1: hx + N, y1: hy + 1, tint: r(), off: r() });
      rects.push({ x0: hx, y0: hy + 1, x1: hx + 1, y1: hy + 1 + N, vertical: true, tint: r(), off: r() });
    }
  }
  // Keep only rects that touch the tile (wrapping handles the rest).
  const vis = rects.filter((rc) => rc.x1 > 0 && rc.x0 < T && rc.y1 > 0 && rc.y0 < T);
  plankShade(b, n, colors, vis, T, 1.6);
};

const slats: Gen = (b, spec, n, r) => {
  const colors = spec.colors.map(hexToRgb);
  const count = 8;
  const S = b.size;
  const gap = colors[3];
  const offs = Array.from({ length: count }, () => [r(), r()]);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      const k = Math.floor(u * count);
      const lu = u * count - k;
      const j = y * S + x;
      const edge = Math.min(lu, 1 - lu) * (S / count);
      if (edge < 3.5) {
        b.set(j, scale(gap, 1), -1.5, 1.1);
        continue;
      }
      const g = grain(n, fract(v + offs[k][0]), fract(lu * 0.15 + offs[k][1]), offs[k][0] * 5, 12);
      let c = mix(colors[2], colors[1], g.dark);
      c = mix(c, colors[0], 0.4);
      c = scale(c, 0.92 + offs[k][1] * 0.14);
      const bevel = smoothstep(3.5, 7, edge);
      c = scale(c, 0.8 + 0.2 * bevel);
      b.set(j, c, bevel - g.dark * 0.2, 0.95 + g.dark * 0.1);
    }
  }
};

function veins(n: Noise, u: number, v: number, freq: number): number {
  const w1 = n.fbm(u, v, 3, 3, 5);
  const w2 = n.fbm(fract(u + 0.31), fract(v + 0.57), 2, 2, 4);
  const t = (u + v) * freq + w1 * 6 + w2 * 3;
  const s = Math.abs(Math.sin(t * Math.PI));
  return Math.pow(1 - s, 9);
}

function gridSeams(b: Buffers, grid: number | undefined, groutColor: RGB, r: () => number) {
  if (!grid) return;
  const S = b.size;
  const cell = S / grid;
  const tints = Array.from({ length: grid * grid }, () => 0.96 + r() * 0.08);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const j = y * S + x;
      const cx = Math.floor(x / cell);
      const cy = Math.floor(y / cell);
      const ex = Math.min(x - cx * cell, (cx + 1) * cell - x);
      const ey = Math.min(y - cy * cell, (cy + 1) * cell - y);
      const e = Math.min(ex, ey);
      const t = tints[cy * grid + cx];
      for (let c = 0; c < 3; c++) b.color[j * 3 + c] *= t;
      if (e < 1.6) {
        b.color[j * 3] = groutColor[0];
        b.color[j * 3 + 1] = groutColor[1];
        b.color[j * 3 + 2] = groutColor[2];
        b.height[j] = -1;
        b.rough[j] = 1.4;
      }
    }
  }
}

const marble: Gen = (b, spec, n, r) => {
  const [c0, c1, c2] = spec.colors.map(hexToRgb) as RGB[];
  const S = b.size;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      const cloud = n.fbm(u, v, 4, 4, 5);
      const vn = veins(n, u, v, 2);
      const vn2 = veins(n, fract(u + 0.5), fract(v * 1 + 0.25), 3) * 0.5;
      let c = mix(c0, c2, smoothstep(0.35, 0.8, cloud) * 0.6);
      c = mix(c, c1, Math.min(1, vn * 0.9 + vn2 * 0.6));
      b.set(y * S + x, c, -vn * 0.2, 1 + vn * 0.3);
    }
  }
  gridSeams(b, spec.grid, scale(c1, 1.05), r);
};

const travertine: Gen = (b, spec, n, r) => {
  const [c0, c1, c2] = spec.colors.map(hexToRgb) as RGB[];
  const S = b.size;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      const w = n.fbm(u, v, 2, 3, 4);
      const band = Math.sin((v * 18 + w * 4) * Math.PI) * 0.5 + 0.5;
      const pore = n.get(u * 96, v * 220, 96, 220);
      const isPore = pore > 0.9 ? smoothstep(0.9, 0.97, pore) * 0.7 : 0;
      let c = mix(c0, c2, band * 0.45);
      c = mix(c, c1, n.fbm(fract(u + 0.3), v, 6, 10, 3) * 0.5);
      c = mix(c, scale(c1, 0.75), isPore * 0.8);
      b.set(y * S + x, c, -isPore * 1.2 + band * 0.1, 1 + isPore * 0.3);
    }
  }
  gridSeams(b, spec.grid, scale(c0, 0.82), r);
};

const concrete: Gen = (b, spec, n) => {
  const [c0, c1, c2] = spec.colors.map(hexToRgb) as RGB[];
  const S = b.size;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      const blot = n.fbm(u, v, 3, 3, 5);
      const speck = n.get(u * 260, v * 260, 260, 260);
      let c = mix(c0, c1, smoothstep(0.3, 0.75, blot) * 0.8);
      c = mix(c, c2, smoothstep(0.55, 0.9, n.fbm(fract(u + 0.5), v, 5, 5, 3)) * 0.5);
      c = scale(c, 0.96 + speck * 0.08);
      b.set(y * S + x, c, blot * 0.6 + speck * 0.4, 0.9 + blot * 0.25);
    }
  }
  gridSeams(b, spec.grid, scale(c1, 0.85), rng((spec.seed ?? 1) + 3));
};

const terrazzo: Gen = (b, spec, n, r) => {
  const cols = spec.colors.map(hexToRgb);
  const S = b.size;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      const t = n.fbm(u, v, 6, 6, 3);
      b.set(y * S + x, scale(cols[0], 0.97 + t * 0.06), 0, 1);
    }
  }
  const chips = Math.floor(S * S * 0.0016);
  for (let k = 0; k < chips; k++) {
    const cx = r() * S;
    const cy = r() * S;
    const big = r() < 0.12;
    const rad = (big ? 9 + r() * 14 : 2 + r() * 6) * (S / 1024);
    const col = cols[1 + Math.floor(r() * (cols.length - 1))];
    const rot = r() * Math.PI;
    const ax = 0.6 + r() * 0.6;
    const R = Math.ceil(rad * 1.6) + 1;
    const jag = r() * 10;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const lx = (dx * Math.cos(rot) - dy * Math.sin(rot)) / ax;
        const ly = dx * Math.sin(rot) + dy * Math.cos(rot);
        const ang = Math.atan2(ly, lx);
        const rr = rad * (0.82 + 0.18 * Math.sin(ang * 5 + jag) * Math.cos(ang * 3 - jag));
        if (lx * lx + ly * ly > rr * rr) continue;
        const px = (((Math.floor(cx + dx)) % S) + S) % S;
        const py = (((Math.floor(cy + dy)) % S) + S) % S;
        const j = py * S + px;
        b.set(j, scale(col, 0.95 + r() * 0.08), 0.15, 0.8);
      }
    }
  }
};

const linen: Gen = (b, spec, n) => {
  const [c0] = spec.colors.map(hexToRgb) as RGB[];
  const S = b.size;
  const threads = S / 4;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      const tx = Math.sin(u * threads * Math.PI * 2) * 0.5 + 0.5;
      const ty = Math.sin(v * threads * Math.PI * 2) * 0.5 + 0.5;
      const checker = (Math.floor(u * threads) + Math.floor(v * threads)) % 2;
      const h = checker ? tx : ty;
      const slubX = n.get(u * 4, v * threads, 4, threads);
      const slubY = n.get(u * threads, v * 4, threads, 4);
      const slub = (slubX + slubY) * 0.5;
      const c = scale(c0, 0.9 + h * 0.08 + (slub - 0.5) * 0.05);
      b.set(y * S + x, c, h * 0.7 + slub * 0.15, 1);
    }
  }
};

const boucle: Gen = (b, spec, n, r) => {
  const [c0] = spec.colors.map(hexToRgb) as RGB[];
  const S = b.size;
  const h = b.height;
  const loops = Math.floor((S * S) / 26);
  for (let k = 0; k < loops; k++) {
    const cx = r() * S;
    const cy = r() * S;
    const rad = 2.2 + r() * 3.2;
    const R = Math.ceil(rad);
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy) / rad;
        if (d > 1) continue;
        const px = (((Math.floor(cx + dx)) % S) + S) % S;
        const py = (((Math.floor(cy + dy)) % S) + S) % S;
        const j = py * S + px;
        // ring-shaped loop
        const ring = 1 - Math.abs(d - 0.6) / 0.4;
        h[j] = Math.max(h[j], Math.max(0, ring));
      }
    }
  }
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const j = y * S + x;
      const t = n.fbm(x / S, y / S, 4, 4, 2);
      const c = scale(c0, 0.78 + h[j] * 0.24 + (t - 0.5) * 0.08);
      b.set(j, c, h[j], 1);
    }
  }
};

const velvet: Gen = (b, spec, n) => {
  const [c0] = spec.colors.map(hexToRgb) as RGB[];
  const S = b.size;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      const crush = n.fbm(u, v, 3, 3, 4);
      const fine = n.get(u * 200, v * 200, 200, 200);
      const c = scale(c0, 0.88 + crush * 0.22 + fine * 0.03);
      b.set(y * S + x, c, crush * 0.6 + fine * 0.2, 0.9 + crush * 0.2);
    }
  }
};

const leather: Gen = (b, spec, n) => {
  const [c0, c1] = spec.colors.map(hexToRgb) as RGB[];
  const S = b.size;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      const cell = Math.abs(n.get(u * 60, v * 60, 60, 60) - 0.5) * 2;
      const crease = Math.pow(1 - cell, 6);
      const patina = n.fbm(u, v, 2, 2, 4);
      let c = mix(c0, c1, patina * 0.6);
      c = scale(c, 1 - crease * 0.15);
      b.set(y * S + x, c, -crease, 0.9 + crease * 0.2 + patina * 0.15);
    }
  }
};

const plaster: Gen = (b, spec, n) => {
  const cols = spec.colors.map(hexToRgb);
  const c0 = cols[0];
  const c1 = cols[1] ?? scale(c0, 0.94);
  const c2 = cols[2] ?? scale(c0, 1.03);
  const strong = cols.length > 1;
  const S = b.size;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      const cloud = n.fbm(u, v, 3, 3, 5);
      const strokes = n.fbm(u, v, 8, 3, 3);
      let c = mix(c0, c1, smoothstep(0.35, 0.85, cloud) * (strong ? 0.85 : 0.4));
      c = mix(c, c2, smoothstep(0.5, 0.9, strokes) * (strong ? 0.6 : 0.3));
      b.set(y * S + x, c, cloud * 0.5 + strokes * 0.5, 0.95 + cloud * 0.1);
    }
  }
};

const brick: Gen = (b, spec, n, r) => {
  const [wash, mortarC, brickC, wash2] = spec.colors.map(hexToRgb) as RGB[];
  const S = b.size;
  const cols = 5;
  const rows = 16;
  const bw = S / cols;
  const bh = S / rows;
  const tints: number[] = Array.from({ length: cols * rows }, () => r());
  for (let y = 0; y < S; y++) {
    const row = Math.floor(y / bh);
    const off = (row % 2) * bw * 0.5;
    for (let x = 0; x < S; x++) {
      const xx = (x + off) % S;
      const col = Math.floor(xx / bw);
      const lx = xx - col * bw;
      const ly = y - row * bh;
      const e = Math.min(lx, bw - lx, ly, bh - ly);
      const j = y * S + x;
      const u = x / S;
      const v = y / S;
      const washAmt = smoothstep(0.25, 0.75, n.fbm(u, v, 6, 6, 4)) * 0.75 + 0.2;
      if (e < 2.5) {
        b.set(j, mix(mortarC, wash, 0.7), -1, 1.1);
        continue;
      }
      const t = tints[row * cols + col];
      let c = scale(brickC, 0.85 + t * 0.3);
      c = mix(c, mix(wash, wash2, t), washAmt);
      const pit = n.get(u * 120, v * 120, 120, 120);
      const bevel = smoothstep(2.5, 6, e);
      b.set(j, scale(c, 0.9 + 0.1 * bevel), bevel * 0.8 + pit * 0.3, 1);
    }
  }
};

const zellige: Gen = (b, spec, n, r) => {
  const [c0, c1, c2, grout] = spec.colors.map(hexToRgb) as RGB[];
  const S = b.size;
  const count = 8;
  const cell = S / count;
  const tiles = Array.from({ length: count * count }, () => [r(), r(), r()]);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const cx = Math.floor(x / cell);
      const cy = Math.floor(y / cell);
      const lx = x - cx * cell;
      const ly = y - cy * cell;
      const e = Math.min(lx, cell - lx, ly, cell - ly);
      const j = y * S + x;
      if (e < 1.8) {
        b.set(j, grout, -1, 2.5);
        continue;
      }
      const t = tiles[cy * count + cx];
      const u = x / S;
      const v = y / S;
      const wob = n.fbm(u, v, 16, 16, 3);
      let c = mix(c0, t[0] < 0.5 ? c1 : c2, t[1] * 0.7);
      c = scale(c, 0.9 + wob * 0.18);
      // glaze pools darker at the edges
      c = scale(c, 0.85 + 0.15 * smoothstep(1.8, 7, e));
      b.set(j, c, wob * 1.2 + smoothstep(1.8, 5, e) * 0.6, 0.6 + wob * 0.6);
    }
  }
};

const rattan: Gen = (b, spec, n) => {
  const [c0, c1] = spec.colors.map(hexToRgb) as RGB[];
  const S = b.size;
  const k = 8;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      const cu = Math.floor(u * k);
      const cv = Math.floor(v * k);
      const over = (cu + cv) % 2 === 0;
      const lu = u * k - cu;
      const lv = v * k - cv;
      const strand = over ? Math.sin(lv * Math.PI) : Math.sin(lu * Math.PI);
      const f = n.get(u * (over ? 16 : 120), v * (over ? 120 : 16), over ? 16 : 120, over ? 120 : 16);
      const c = mix(c1, c0, strand * 0.8 + f * 0.2);
      b.set(y * S + x, c, strand + f * 0.2, 1);
    }
  }
};

const bark: Gen = (b, spec, n) => {
  const [c0, c1] = spec.colors.map(hexToRgb) as RGB[];
  const S = b.size;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      const s = n.fbm(u, v, 16, 2, 4);
      const c = mix(c1, c0, s);
      b.set(y * S + x, c, s, 1);
    }
  }
};

// ── Canvas-drawn (stretch) textures: rugs, art, leaves ────────────────────

function canvasGen(
  draw: (ctx: CanvasRenderingContext2D, S: number, cols: string[], r: () => number, n: Noise) => void,
  heightFromLuma = 0.4,
  fuzz = 0,
): Gen {
  return (b, spec, n, r) => {
    const S = b.size;
    const cv = makeCanvas(S);
    const ctx = cv.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    draw(ctx, S, spec.colors, r, n);
    const img = ctx.getImageData(0, 0, S, S).data;
    for (let j = 0; j < S * S; j++) {
      const x = j % S;
      const y = (j / S) | 0;
      let cr = img[j * 4] / 255;
      let cg = img[j * 4 + 1] / 255;
      let cb = img[j * 4 + 2] / 255;
      let h = (cr + cg + cb) / 3;
      if (fuzz > 0) {
        const wool = n.get((x / S) * 300, (y / S) * 300, 300, 300);
        const knot = Math.sin((x / S) * S * 0.9) * Math.sin((y / S) * S * 0.9);
        const f = 1 + (wool - 0.5) * fuzz + knot * fuzz * 0.15;
        cr *= f;
        cg *= f;
        cb *= f;
        h = h * heightFromLuma + wool * 0.7 + knot * 0.15;
      } else {
        const paper = n.get((x / S) * 180, (y / S) * 180, 180, 180);
        const f = 0.97 + paper * 0.05;
        cr *= f;
        cg *= f;
        cb *= f;
        h = h * heightFromLuma + paper * 0.3;
      }
      b.set(j, [cr, cg, cb], h, 1);
    }
  };
}

function wobblyLine(ctx: CanvasRenderingContext2D, pts: [number, number][], r: () => number, wob: number) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const jx = x + (r() - 0.5) * wob;
    const jy = y + (r() - 0.5) * wob;
    if (i === 0) ctx.moveTo(jx, jy);
    else ctx.lineTo(jx, jy);
  });
  ctx.stroke();
}

const rugBerber = canvasGen(
  (ctx, S, c, r) => {
    ctx.fillStyle = c[0];
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = c[1];
    ctx.lineWidth = S * 0.007;
    ctx.lineCap = 'round';
    const m = S * 0.07;
    const cols = 5;
    const rows = 7;
    const cw = (S - 2 * m) / cols;
    const rh = (S - 2 * m) / rows;
    for (let i = 0; i <= cols; i++) {
      for (let j = 0; j <= rows; j++) {
        const x = m + i * cw;
        const y = m + j * rh;
        if (i < cols && j < rows) {
          wobblyLine(ctx, [[x, y + rh / 2], [x + cw / 2, y], [x + cw, y + rh / 2], [x + cw / 2, y + rh], [x, y + rh / 2]], r, S * 0.006);
          if (r() < 0.5) {
            ctx.fillStyle = c[1];
            ctx.beginPath();
            ctx.arc(x + cw / 2, y + rh / 2, S * 0.006, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
    ctx.strokeStyle = c[2];
    ctx.lineWidth = S * 0.012;
    ctx.strokeRect(m * 0.5, m * 0.5, S - m, S - m);
  },
  0.5,
  0.35,
);

const rugBorder = canvasGen(
  (ctx, S, c) => {
    ctx.fillStyle = c[0];
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = c[1];
    ctx.lineWidth = S * 0.035;
    ctx.strokeRect(S * 0.06, S * 0.06, S * 0.88, S * 0.88);
    ctx.strokeStyle = c[2];
    ctx.lineWidth = S * 0.008;
    ctx.strokeRect(S * 0.1, S * 0.1, S * 0.8, S * 0.8);
  },
  0.4,
  0.3,
);

const rugAbstract = canvasGen(
  (ctx, S, c, r) => {
    ctx.fillStyle = c[0];
    ctx.fillRect(0, 0, S, S);
    const blobs: [string, number, number, number][] = [
      [c[1], 0.28, 0.32, 0.22],
      [c[2], 0.7, 0.62, 0.2],
      [c[3], 0.62, 0.22, 0.12],
      [c[1], 0.8, 0.88, 0.1],
      [c[2], 0.18, 0.82, 0.13],
    ];
    for (const [col, x, y, rad] of blobs) {
      ctx.fillStyle = col;
      ctx.beginPath();
      const pts = 9;
      for (let i = 0; i <= pts; i++) {
        const a = (i / pts) * Math.PI * 2;
        const rr = rad * S * (0.78 + r() * 0.35);
        const px = x * S + Math.cos(a) * rr;
        const py = y * S + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.quadraticCurveTo(x * S + Math.cos(a - 0.35) * rr * 1.15, y * S + Math.sin(a - 0.35) * rr * 1.15, px, py);
      }
      ctx.fill();
    }
    ctx.strokeStyle = c[3];
    ctx.lineWidth = S * 0.02;
    ctx.strokeRect(S * 0.03, S * 0.03, S * 0.94, S * 0.94);
  },
  0.4,
  0.35,
);

const rugStripes = canvasGen(
  (ctx, S, c, r) => {
    let y = 0;
    while (y < S) {
      const h = S * (0.01 + r() * 0.06);
      const k = r();
      ctx.fillStyle = k < 0.45 ? c[0] : k < 0.7 ? c[2] : k < 0.88 ? c[1] : c[3];
      ctx.fillRect(0, y, S, h + 1);
      y += h;
    }
  },
  0.4,
  0.3,
);

function paperBase(ctx: CanvasRenderingContext2D, S: number, col: string) {
  ctx.fillStyle = col;
  ctx.fillRect(0, 0, S, S);
}

const artArches = canvasGen((ctx, S, c) => {
  paperBase(ctx, S, c[0]);
  const arch = (x: number, w: number, h: number, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, S * 0.86);
    ctx.lineTo(x - w / 2, S * 0.86 - h + w / 2);
    ctx.arc(x, S * 0.86 - h + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(x + w / 2, S * 0.86);
    ctx.fill();
  };
  arch(S * 0.38, S * 0.36, S * 0.6, c[1]);
  arch(S * 0.62, S * 0.3, S * 0.42, c[2]);
  arch(S * 0.5, S * 0.14, S * 0.22, c[3]);
  ctx.fillStyle = c[4];
  ctx.beginPath();
  ctx.arc(S * 0.7, S * 0.24, S * 0.07, 0, Math.PI * 2);
  ctx.fill();
});

const artSun = canvasGen((ctx, S, c) => {
  paperBase(ctx, S, c[0]);
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, c[0]);
  g.addColorStop(1, c[2]);
  ctx.fillStyle = g;
  ctx.fillRect(S * 0.1, S * 0.1, S * 0.8, S * 0.8);
  ctx.fillStyle = c[1];
  ctx.beginPath();
  ctx.arc(S * 0.5, S * 0.56, S * 0.22, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = c[3];
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(S * 0.1, S * (0.56 + i * 0.075), S * 0.8, S * 0.035);
  }
});

const artLines = canvasGen((ctx, S, c, r) => {
  paperBase(ctx, S, c[0]);
  ctx.fillStyle = c[2];
  ctx.beginPath();
  ctx.ellipse(S * 0.6, S * 0.42, S * 0.16, S * 0.2, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = c[1];
  ctx.lineWidth = S * 0.008;
  ctx.lineCap = 'round';
  ctx.beginPath();
  let x = S * 0.25;
  let y = S * 0.75;
  ctx.moveTo(x, y);
  for (let i = 0; i < 9; i++) {
    const nx = S * (0.2 + r() * 0.6);
    const ny = S * (0.2 + r() * 0.6);
    ctx.bezierCurveTo(x + (r() - 0.5) * S * 0.5, y - S * 0.2, nx + (r() - 0.5) * S * 0.4, ny + S * 0.2, nx, ny);
    x = nx;
    y = ny;
  }
  ctx.stroke();
});

const artBlocks = canvasGen((ctx, S, c) => {
  paperBase(ctx, S, c[0]);
  ctx.fillStyle = c[1];
  ctx.fillRect(S * 0.1, S * 0.1, S * 0.8, S * 0.42);
  ctx.fillStyle = c[2];
  ctx.fillRect(S * 0.1, S * 0.55, S * 0.48, S * 0.35);
  ctx.fillStyle = c[3];
  ctx.fillRect(S * 0.61, S * 0.55, S * 0.29, S * 0.35);
  ctx.fillStyle = c[4];
  ctx.beginPath();
  ctx.arc(S * 0.66, S * 0.3, S * 0.11, 0, Math.PI * 2);
  ctx.fill();
});

const artLandscape = canvasGen((ctx, S, c, r) => {
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, c[0]);
  g.addColorStop(0.55, c[4]);
  g.addColorStop(1, c[0]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const layers = [c[1], c[2], c[3]];
  layers.forEach((col, li) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    const base = S * (0.5 + li * 0.14);
    ctx.moveTo(0, S);
    ctx.lineTo(0, base);
    for (let x = 0; x <= S; x += S / 40) {
      const y = base - Math.sin(x / S * 5 + li * 2) * S * 0.04 - r() * S * 0.015 - Math.sin(x / S * 13 + li) * S * 0.02;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(S, S);
    ctx.fill();
  });
});

const leaf = canvasGen(
  (ctx, S, c) => {
    // UV: u across the leaf (0..1), v along it (0 at stem, 1 at tip)
    const g = ctx.createLinearGradient(0, 0, S, 0);
    g.addColorStop(0, c[1]);
    g.addColorStop(0.5, c[0]);
    g.addColorStop(1, c[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = c[2];
    ctx.lineWidth = S * 0.018;
    ctx.beginPath();
    ctx.moveTo(S / 2, 0);
    ctx.lineTo(S / 2, S);
    ctx.stroke();
    ctx.lineWidth = S * 0.006;
    for (let i = 1; i < 9; i++) {
      const y = (i / 9) * S;
      ctx.beginPath();
      ctx.moveTo(S / 2, y);
      ctx.quadraticCurveTo(S * 0.3, y + S * 0.04, 0, y + S * 0.12);
      ctx.moveTo(S / 2, y);
      ctx.quadraticCurveTo(S * 0.7, y + S * 0.04, S, y + S * 0.12);
      ctx.stroke();
    }
  },
  0.6,
);

const GENERATORS: Record<string, Gen> = {
  woodgrain,
  planks,
  herringbone,
  slats,
  marble,
  travertine,
  concrete,
  terrazzo,
  linen,
  boucle,
  velvet,
  leather,
  plaster,
  brick,
  zellige,
  rattan,
  bark,
  'rug-berber': rugBerber,
  'rug-border': rugBorder,
  'rug-abstract': rugAbstract,
  'rug-stripes': rugStripes,
  'art-arches': artArches,
  'art-sun': artSun,
  'art-lines': artLines,
  'art-blocks': artBlocks,
  'art-landscape': artLandscape,
  leaf,
};

export function makeCanvas(size: number, h = size): HTMLCanvasElement {
  // Workers have no DOM: fall back to OffscreenCanvas (same 2D API subset).
  if (typeof document === 'undefined') return new OffscreenCanvas(size, h) as unknown as HTMLCanvasElement;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = h;
  return c;
}

/** Preferred resolution for a texture kind. */
export function defaultSize(spec: TextureSpec): number {
  switch (spec.kind) {
    case 'marble':
      // veined stone is expensive; furniture-scale pieces don't need 1k
      return spec.grid ? 1024 : 512;
    case 'planks':
    case 'herringbone':
    case 'rug-berber':
    case 'rug-border':
    case 'rug-abstract':
    case 'rug-stripes':
    case 'terrazzo':
    case 'brick':
      return 1024;
    case 'leaf':
      return 128;
    case 'linen':
    case 'velvet':
    case 'bark':
    case 'rattan':
      return 256;
    default:
      return 512;
  }
}

export function generateTexture(spec: TextureSpec, size = defaultSize(spec), withMaps = true): TextureMaps {
  const b = new Buffers(size);
  const n = new Noise(spec.seed ?? 7);
  const r = rng((spec.seed ?? 7) * 31 + 5);
  const gen = GENERATORS[spec.kind] ?? concrete;
  gen(b, spec, n, r);

  const S = size;
  const color = new Uint8ClampedArray(S * S * 4);
  for (let j = 0; j < S * S; j++) {
    color[j * 4] = b.color[j * 3] * 255;
    color[j * 4 + 1] = b.color[j * 3 + 1] * 255;
    color[j * 4 + 2] = b.color[j * 3 + 2] * 255;
    color[j * 4 + 3] = 255;
  }
  if (!withMaps) return { size, color };

  const normal = new Uint8ClampedArray(S * S * 4);
  const strength = (spec.bump ?? 0.4) * (S / 256);
  const H = b.height;
  for (let y = 0; y < S; y++) {
    const ym = ((y - 1 + S) % S) * S;
    const yp = ((y + 1) % S) * S;
    const y0 = y * S;
    for (let x = 0; x < S; x++) {
      const xm = (x - 1 + S) % S;
      const xp = (x + 1) % S;
      const dx = (H[y0 + xp] - H[y0 + xm]) * strength * 0.5;
      const dy = (H[yp + x] - H[ym + x]) * strength * 0.5;
      const len = Math.sqrt(dx * dx + dy * dy + 1);
      const j = (y0 + x) * 4;
      normal[j] = (-dx / len) * 127.5 + 127.5;
      normal[j + 1] = (dy / len) * 127.5 + 127.5;
      normal[j + 2] = (1 / len) * 127.5 + 127.5;
      normal[j + 3] = 255;
    }
  }
  const rough = new Uint8ClampedArray(S * S * 4);
  for (let j = 0; j < S * S; j++) {
    const v = Math.min(255, Math.max(0, b.rough[j] * 128));
    rough[j * 4] = v;
    rough[j * 4 + 1] = v;
    rough[j * 4 + 2] = v;
    rough[j * 4 + 3] = 255;
  }
  return { size, color, normal, rough };
}

export function mapsToCanvas(data: Uint8ClampedArray, size: number): HTMLCanvasElement {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d')!;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(data), size, size), 0, 0);
  return c;
}
