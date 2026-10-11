import type { MaterialCategory } from './materials';
import type { PlacementKind } from './types';

// Furniture & decor catalogue metadata. Geometry builders live in the engine;
// everything placement related (footprints, surfaces, wall offsets) is here so
// it can be unit-tested without WebGL.

export type CatalogCategory = 'seating' | 'tables' | 'storage' | 'lighting' | 'decor' | 'plants' | 'rugs' | 'wall';

export const CATALOG_CATEGORIES: { id: CatalogCategory; label: string }[] = [
  { id: 'seating', label: 'Asientos' },
  { id: 'tables', label: 'Mesas' },
  { id: 'storage', label: 'Almacenaje' },
  { id: 'lighting', label: 'Iluminación' },
  { id: 'plants', label: 'Plantas' },
  { id: 'decor', label: 'Objetos' },
  { id: 'rugs', label: 'Alfombras' },
  { id: 'wall', label: 'Pared' },
];

export interface MaterialSlot {
  id: string;
  label: string;
  categories: MaterialCategory[];
  default: string;
}

export interface Variant {
  label: string;
  /** width (x), height (y), depth (z) in meters */
  size: [number, number, number];
}

/** Local collision rectangle, optionally limited to a vertical band. */
export interface Collider {
  x: number;
  z: number;
  w: number;
  d: number;
  y0?: number;
  y1?: number;
}

/** A horizontal surface (local coords) that accepts 'surface' items. */
export interface Surface {
  x: number;
  z: number;
  w: number;
  d: number;
  y: number;
  /** vertical clearance above the surface (shelves) */
  clearance?: number;
}

export interface LightSpec {
  kind: 'point' | 'spot';
  /** local position of the light source */
  pos: [number, number, number];
  intensity: number; // candela-ish for point lights
  distance: number;
  /** Kelvin */
  temperature: number;
  /** spot only */
  angle?: number;
  target?: [number, number, number];
}

export interface ItemDef {
  type: string;
  name: string;
  designer?: string;
  category: CatalogCategory;
  placement: PlacementKind;
  variants: Variant[];
  slots: MaterialSlot[];
  colliders?: (size: [number, number, number]) => Collider[];
  surfaces?: (size: [number, number, number]) => Surface[];
  light?: (size: [number, number, number]) => LightSpec;
  /** Furniture that prefers its back against a wall (auto orientation). */
  againstWall?: boolean;
  /** Wall items: default height of the item's center. */
  mountHeight?: number;
  /** Wall items allowed in front of windows (curtains); they snap to openings. */
  coversOpenings?: boolean;
  price?: number;
  tags?: string[];
}

const fabricLeather: MaterialCategory[] = ['fabric', 'leather'];
const woodMetal: MaterialCategory[] = ['wood', 'metal', 'lacquer'];
const tops: MaterialCategory[] = ['wood', 'stone', 'lacquer', 'glass'];

const defs: ItemDef[] = [
  // ── Seating ──────────────────────────────────────────────────────────────
  {
    type: 'sofa',
    name: 'Sofá Arlo',
    designer: 'Estudio Norte',
    category: 'seating',
    placement: 'floor',
    againstWall: true,
    variants: [
      { label: '2 plazas', size: [1.9, 0.8, 0.98] },
      { label: '3 plazas', size: [2.3, 0.8, 0.98] },
      { label: '4 plazas', size: [2.75, 0.8, 0.98] },
    ],
    slots: [
      { id: 'upholstery', label: 'Tapicería', categories: fabricLeather, default: 'linen-oat' },
      { id: 'legs', label: 'Patas', categories: woodMetal, default: 'oak' },
    ],
    price: 2490,
  },
  {
    type: 'sectional',
    name: 'Sofá modular Dune',
    designer: 'Lune & Co.',
    category: 'seating',
    placement: 'floor',
    againstWall: true,
    variants: [
      { label: 'Chaise derecha', size: [2.9, 0.74, 1.7] },
      { label: 'Chaise larga', size: [3.3, 0.74, 1.9] },
    ],
    slots: [{ id: 'upholstery', label: 'Tapicería', categories: fabricLeather, default: 'boucle-cream' }],
    colliders: ([w, h, d]) => [
      { x: 0, z: -d / 2 + 0.5, w, d: 1.0, y1: h },
      { x: w / 2 - 0.5, z: 0.5, w: 1.0, d: d - 1.0, y1: h },
    ],
    price: 3890,
  },
  {
    type: 'lounge-chair',
    name: 'Butaca Hvile',
    designer: 'Estudio Norte',
    category: 'seating',
    placement: 'floor',
    variants: [{ label: 'Estándar', size: [0.76, 0.8, 0.84] }],
    slots: [
      { id: 'frame', label: 'Estructura', categories: ['wood'], default: 'walnut' },
      { id: 'cushion', label: 'Cojines', categories: fabricLeather, default: 'leather-cognac' },
    ],
    price: 1290,
  },
  {
    type: 'tub-chair',
    name: 'Butaca Pebble',
    designer: 'Lune & Co.',
    category: 'seating',
    placement: 'floor',
    variants: [{ label: 'Estándar', size: [0.82, 0.72, 0.78] }],
    slots: [
      { id: 'upholstery', label: 'Tapicería', categories: fabricLeather, default: 'boucle-sand' },
      { id: 'base', label: 'Base', categories: woodMetal, default: 'brass' },
    ],
    price: 990,
  },
  {
    type: 'dining-chair',
    name: 'Silla Fika',
    designer: 'Hjem',
    category: 'seating',
    placement: 'floor',
    variants: [{ label: 'Estándar', size: [0.48, 0.8, 0.52] }],
    slots: [
      { id: 'frame', label: 'Estructura', categories: ['wood', 'lacquer'], default: 'oak' },
      { id: 'seat', label: 'Asiento', categories: ['fabric', 'leather', 'wood'], default: 'leather-tan' },
    ],
    // Seat block stays below table tops so chairs can tuck under tables.
    colliders: ([w, h, d]) => [
      { x: 0, z: 0.03, w, d: d - 0.06, y0: 0, y1: 0.68 },
      { x: 0, z: -d / 2 + 0.04, w, d: 0.08, y0: 0, y1: h },
    ],
    price: 340,
  },
  {
    type: 'ottoman',
    name: 'Puf Moon',
    category: 'seating',
    placement: 'floor',
    variants: [
      { label: 'Pequeño', size: [0.5, 0.4, 0.5] },
      { label: 'Grande', size: [0.75, 0.4, 0.75] },
    ],
    slots: [{ id: 'upholstery', label: 'Tapicería', categories: fabricLeather, default: 'velvet-terracotta' }],
    price: 290,
  },
  {
    type: 'bench',
    name: 'Banco Linje',
    category: 'seating',
    placement: 'floor',
    againstWall: true,
    variants: [
      { label: '120 cm', size: [1.2, 0.45, 0.38] },
      { label: '160 cm', size: [1.6, 0.45, 0.38] },
    ],
    slots: [{ id: 'wood', label: 'Madera', categories: ['wood', 'lacquer'], default: 'oak' }],
    surfaces: ([w, h, d]) => [{ x: 0, z: 0, w: w - 0.04, d: d - 0.04, y: h }],
    price: 460,
  },

  // ── Tables ───────────────────────────────────────────────────────────────
  {
    type: 'coffee-round',
    name: 'Mesa de centro Orbe',
    designer: 'Pietra',
    category: 'tables',
    placement: 'floor',
    variants: [
      { label: 'Ø 90', size: [0.9, 0.36, 0.9] },
      { label: 'Ø 110', size: [1.1, 0.36, 1.1] },
    ],
    slots: [
      { id: 'top', label: 'Sobre', categories: tops, default: 'travertine' },
      { id: 'base', label: 'Base', categories: ['stone', 'wood', 'metal', 'lacquer'], default: 'travertine' },
    ],
    surfaces: ([w, h]) => [{ x: 0, z: 0, w: w * 0.68, d: w * 0.68, y: h }],
    price: 1150,
  },
  {
    type: 'coffee-rect',
    name: 'Mesa de centro Plano',
    category: 'tables',
    placement: 'floor',
    variants: [
      { label: '120 × 60', size: [1.2, 0.38, 0.6] },
      { label: '140 × 70', size: [1.4, 0.38, 0.7] },
    ],
    slots: [
      { id: 'wood', label: 'Madera', categories: ['wood', 'lacquer'], default: 'walnut' },
      { id: 'legs', label: 'Patas', categories: woodMetal, default: 'walnut' },
    ],
    surfaces: ([w, h, d]) => [{ x: 0, z: 0, w: w - 0.06, d: d - 0.06, y: h }],
    price: 720,
  },
  {
    type: 'side-table',
    name: 'Mesa auxiliar Disco',
    category: 'tables',
    placement: 'floor',
    variants: [{ label: 'Estándar', size: [0.45, 0.52, 0.45] }],
    slots: [
      { id: 'top', label: 'Sobre', categories: tops, default: 'marble-nero' },
      { id: 'base', label: 'Base', categories: woodMetal, default: 'steel-black' },
    ],
    surfaces: ([w, h]) => [{ x: 0, z: 0, w: w * 0.7, d: w * 0.7, y: h }],
    price: 380,
  },
  {
    type: 'dining-round',
    name: 'Mesa de comedor Luna',
    designer: 'Hjem',
    category: 'tables',
    placement: 'floor',
    variants: [
      { label: 'Ø 110', size: [1.1, 0.75, 1.1] },
      { label: 'Ø 130', size: [1.3, 0.75, 1.3] },
    ],
    slots: [
      { id: 'top', label: 'Sobre', categories: tops, default: 'oak' },
      { id: 'base', label: 'Pie', categories: ['wood', 'metal', 'stone', 'lacquer'], default: 'oak' },
    ],
    surfaces: ([w, h]) => [{ x: 0, z: 0, w: w * 0.7, d: w * 0.7, y: h }],
    colliders: ([w, h]) => [
      { x: 0, z: 0, w: w * 0.86, d: w * 0.86, y0: h - 0.05, y1: h },
      { x: 0, z: 0, w: w * 0.5, d: w * 0.5, y0: 0, y1: h - 0.05 },
    ],
    price: 1480,
  },
  {
    type: 'dining-rect',
    name: 'Mesa Refectorio',
    category: 'tables',
    placement: 'floor',
    variants: [
      { label: '180 × 90', size: [1.8, 0.75, 0.9] },
      { label: '220 × 100', size: [2.2, 0.75, 1.0] },
    ],
    slots: [
      { id: 'top', label: 'Sobre', categories: tops, default: 'walnut' },
      { id: 'legs', label: 'Patas', categories: woodMetal, default: 'walnut' },
    ],
    surfaces: ([w, h, d]) => [{ x: 0, z: 0, w: w - 0.1, d: d - 0.1, y: h }],
    colliders: ([w, h, d]) => [
      { x: 0, z: 0, w, d, y0: h - 0.05, y1: h },
      { x: -w / 2 + 0.08, z: -d / 2 + 0.08, w: 0.12, d: 0.12, y0: 0, y1: h },
      { x: w / 2 - 0.08, z: -d / 2 + 0.08, w: 0.12, d: 0.12, y0: 0, y1: h },
      { x: -w / 2 + 0.08, z: d / 2 - 0.08, w: 0.12, d: 0.12, y0: 0, y1: h },
      { x: w / 2 - 0.08, z: d / 2 - 0.08, w: 0.12, d: 0.12, y0: 0, y1: h },
    ],
    price: 1890,
  },
  {
    type: 'desk',
    name: 'Escritorio Atelier',
    category: 'tables',
    placement: 'floor',
    againstWall: true,
    variants: [{ label: '140 × 65', size: [1.4, 0.75, 0.65] }],
    slots: [
      { id: 'top', label: 'Sobre', categories: ['wood', 'lacquer'], default: 'oak-white' },
      { id: 'frame', label: 'Estructura', categories: woodMetal, default: 'steel-black' },
    ],
    surfaces: ([w, h, d]) => [{ x: 0, z: 0, w: w - 0.06, d: d - 0.06, y: h }],
    colliders: ([w, h, d]) => [
      { x: 0, z: 0, w, d, y0: h - 0.05, y1: h },
      { x: -w / 2 + 0.08, z: -d / 2 + 0.08, w: 0.12, d: 0.12, y0: 0, y1: h },
      { x: w / 2 - 0.08, z: -d / 2 + 0.08, w: 0.12, d: 0.12, y0: 0, y1: h },
      { x: -w / 2 + 0.08, z: d / 2 - 0.08, w: 0.12, d: 0.12, y0: 0, y1: h },
      { x: w / 2 - 0.08, z: d / 2 - 0.08, w: 0.12, d: 0.12, y0: 0, y1: h },
    ],
    price: 840,
  },

  // ── Storage ──────────────────────────────────────────────────────────────
  {
    type: 'bookshelf',
    name: 'Librería Stack',
    designer: 'Estudio Norte',
    category: 'storage',
    placement: 'floor',
    againstWall: true,
    variants: [
      { label: '120 cm', size: [1.2, 2.0, 0.38] },
      { label: '80 cm', size: [0.8, 2.0, 0.38] },
    ],
    slots: [
      { id: 'wood', label: 'Madera', categories: ['wood', 'lacquer'], default: 'oak' },
      { id: 'books', label: 'Libros', categories: ['paper'], default: 'paper-books' },
    ],
    surfaces: ([w, h, d]) => {
      const out: Surface[] = [];
      const levels = 5;
      const step = (h - 0.03) / levels;
      for (let i = 1; i < levels; i++) {
        out.push({ x: w * 0.22, z: 0, w: w * 0.5, d: d - 0.06, y: i * step + 0.03, clearance: step - 0.03 });
      }
      out.push({ x: 0, z: 0, w: w - 0.04, d: d - 0.04, y: h });
      return out;
    },
    price: 1340,
  },
  {
    type: 'sideboard',
    name: 'Aparador Mira',
    category: 'storage',
    placement: 'floor',
    againstWall: true,
    variants: [
      { label: '160 cm', size: [1.6, 0.72, 0.46] },
      { label: '200 cm', size: [2.0, 0.72, 0.46] },
    ],
    slots: [
      { id: 'body', label: 'Cuerpo', categories: ['wood', 'lacquer'], default: 'walnut' },
      { id: 'legs', label: 'Patas', categories: woodMetal, default: 'brass' },
    ],
    surfaces: ([w, h, d]) => [{ x: 0, z: 0, w: w - 0.04, d: d - 0.06, y: h }],
    price: 1650,
  },
  {
    type: 'media-console',
    name: 'Mueble TV Low',
    category: 'storage',
    placement: 'floor',
    againstWall: true,
    variants: [
      { label: '180 cm', size: [1.8, 0.44, 0.42] },
      { label: '220 cm', size: [2.2, 0.44, 0.42] },
    ],
    slots: [
      { id: 'body', label: 'Cuerpo', categories: ['wood', 'lacquer'], default: 'oak' },
      { id: 'fronts', label: 'Frentes', categories: ['wood', 'lacquer', 'fabric'], default: 'rattan' },
    ],
    surfaces: ([w, h, d]) => [{ x: 0, z: 0, w: w - 0.04, d: d - 0.06, y: h }],
    price: 990,
  },

  // ── Lighting ─────────────────────────────────────────────────────────────
  {
    type: 'arc-lamp',
    name: 'Lámpara de arco Halo',
    category: 'lighting',
    placement: 'floor',
    variants: [{ label: 'Estándar', size: [0.4, 2.05, 1.55] }],
    slots: [
      { id: 'metal', label: 'Metal', categories: ['metal'], default: 'brass' },
      { id: 'base', label: 'Base', categories: ['stone', 'metal'], default: 'marble-carrara' },
    ],
    colliders: ([, h, d]) => [
      { x: 0, z: -d / 2 + 0.2, w: 0.4, d: 0.4, y1: h },
      { x: 0, z: d / 2 - 0.25, w: 0.5, d: 0.5, y0: h - 0.42, y1: h },
    ],
    light: ([, h, d]) => ({ kind: 'spot', pos: [0, h - 0.22, d / 2 - 0.25], intensity: 9, distance: 7, temperature: 2700, angle: 0.9, target: [0, 0, d / 2 - 0.25] }),
    price: 690,
  },
  {
    type: 'tripod-lamp',
    name: 'Lámpara trípode Ojai',
    category: 'lighting',
    placement: 'floor',
    variants: [{ label: 'Estándar', size: [0.52, 1.62, 0.52] }],
    slots: [
      { id: 'wood', label: 'Trípode', categories: ['wood', 'metal'], default: 'walnut' },
      { id: 'shade', label: 'Pantalla', categories: ['shade'], default: 'shade-linen' },
    ],
    light: ([, h]) => ({ kind: 'point', pos: [0, h - 0.22, 0], intensity: 5, distance: 6, temperature: 2700 }),
    price: 420,
  },
  {
    type: 'table-lamp',
    name: 'Lámpara de mesa Bulbo',
    category: 'lighting',
    placement: 'surface',
    variants: [{ label: 'Estándar', size: [0.3, 0.48, 0.3] }],
    slots: [
      { id: 'base', label: 'Base', categories: ['ceramic', 'metal', 'stone'], default: 'ceramic-sand' },
      { id: 'shade', label: 'Pantalla', categories: ['shade'], default: 'shade-linen' },
    ],
    light: ([, h]) => ({ kind: 'point', pos: [0, h - 0.13, 0], intensity: 2.6, distance: 4, temperature: 2600 }),
    price: 210,
  },
  {
    type: 'pendant-globe',
    name: 'Colgante Opal',
    category: 'lighting',
    placement: 'ceiling',
    variants: [
      { label: 'Ø 35', size: [0.35, 0.95, 0.35] },
      { label: 'Ø 50', size: [0.5, 1.05, 0.5] },
    ],
    slots: [
      { id: 'shade', label: 'Globo', categories: ['shade'], default: 'shade-opal' },
      { id: 'metal', label: 'Florón', categories: ['metal'], default: 'brass' },
    ],
    light: ([w, h]) => ({ kind: 'point', pos: [0, -h + w / 2, 0], intensity: 6, distance: 7, temperature: 2700 }),
    price: 360,
  },
  {
    type: 'pendant-dome',
    name: 'Colgante Cúpula',
    category: 'lighting',
    placement: 'ceiling',
    variants: [{ label: 'Ø 50', size: [0.5, 1.0, 0.5] }],
    slots: [
      { id: 'shade', label: 'Cúpula', categories: ['metal', 'lacquer', 'shade'], default: 'lacquer-olive' },
    ],
    light: ([, h]) => ({ kind: 'spot', pos: [0, -h + 0.12, 0], intensity: 14, distance: 6, temperature: 2700, angle: 1.0, target: [0, -h - 2, 0] }),
    price: 290,
  },
  {
    type: 'sconce',
    name: 'Aplique Arc',
    category: 'lighting',
    placement: 'wall',
    mountHeight: 1.75,
    variants: [{ label: 'Estándar', size: [0.18, 0.3, 0.22] }],
    slots: [
      { id: 'metal', label: 'Metal', categories: ['metal'], default: 'brass' },
      { id: 'shade', label: 'Difusor', categories: ['shade'], default: 'shade-opal' },
    ],
    light: ([, , d]) => ({ kind: 'point', pos: [0, 0.02, d * 0.6], intensity: 1.8, distance: 3.5, temperature: 2700 }),
    price: 180,
  },

  // ── Plants ───────────────────────────────────────────────────────────────
  {
    type: 'plant-fiddle',
    name: 'Ficus lyrata',
    category: 'plants',
    placement: 'floor',
    variants: [
      { label: 'Mediano', size: [0.7, 1.55, 0.7] },
      { label: 'Grande', size: [0.85, 1.95, 0.85] },
    ],
    slots: [
      { id: 'pot', label: 'Maceta', categories: ['ceramic', 'stone'], default: 'ceramic-terracotta' },
      { id: 'leaf', label: 'Follaje', categories: ['plant'], default: 'leaf-green' },
    ],
    colliders: ([w, h]) => [
      { x: 0, z: 0, w: 0.4, d: 0.4, y1: 0.5 },
      { x: 0, z: 0, w: w * 0.85, d: w * 0.85, y0: 0.5, y1: h },
    ],
    price: 140,
  },
  {
    type: 'plant-olive',
    name: 'Olivo en maceta',
    category: 'plants',
    placement: 'floor',
    variants: [{ label: 'Estándar', size: [0.75, 1.65, 0.75] }],
    slots: [
      { id: 'pot', label: 'Maceta', categories: ['ceramic', 'stone'], default: 'ceramic-sand' },
      { id: 'leaf', label: 'Follaje', categories: ['plant'], default: 'leaf-olive' },
    ],
    colliders: ([w, h]) => [
      { x: 0, z: 0, w: 0.46, d: 0.46, y1: 0.55 },
      { x: 0, z: 0, w: w * 0.85, d: w * 0.85, y0: 0.9, y1: h },
    ],
    price: 160,
  },
  {
    type: 'plant-snake',
    name: 'Sansevieria',
    category: 'plants',
    placement: 'floor',
    variants: [{ label: 'Estándar', size: [0.38, 0.9, 0.38] }],
    slots: [
      { id: 'pot', label: 'Maceta', categories: ['ceramic', 'stone', 'wood'], default: 'ceramic-black' },
      { id: 'leaf', label: 'Follaje', categories: ['plant'], default: 'leaf-dark' },
    ],
    price: 65,
  },
  {
    type: 'plant-small',
    name: 'Pilea en maceta',
    category: 'plants',
    placement: 'surface',
    variants: [{ label: 'Estándar', size: [0.24, 0.3, 0.24] }],
    slots: [
      { id: 'pot', label: 'Maceta', categories: ['ceramic', 'stone'], default: 'ceramic-white' },
      { id: 'leaf', label: 'Follaje', categories: ['plant'], default: 'leaf-green' },
    ],
    price: 28,
  },

  // ── Decor ────────────────────────────────────────────────────────────────
  {
    type: 'vase-branches',
    name: 'Jarrón con ramas',
    category: 'decor',
    placement: 'surface',
    variants: [{ label: 'Estándar', size: [0.3, 0.75, 0.3] }],
    slots: [{ id: 'vase', label: 'Jarrón', categories: ['ceramic', 'glass', 'stone'], default: 'ceramic-sand' }],
    price: 85,
  },
  {
    type: 'vase',
    name: 'Ánfora',
    category: 'decor',
    placement: 'surface',
    variants: [
      { label: 'Baja', size: [0.2, 0.24, 0.2] },
      { label: 'Alta', size: [0.22, 0.38, 0.22] },
    ],
    slots: [{ id: 'vase', label: 'Material', categories: ['ceramic', 'glass', 'stone'], default: 'ceramic-terracotta' }],
    price: 48,
  },
  {
    type: 'books',
    name: 'Pila de libros',
    category: 'decor',
    placement: 'surface',
    variants: [{ label: 'Estándar', size: [0.3, 0.13, 0.24] }],
    slots: [],
    price: 60,
  },
  {
    type: 'bowl',
    name: 'Cuenco de fruta',
    category: 'decor',
    placement: 'surface',
    variants: [{ label: 'Estándar', size: [0.34, 0.14, 0.34] }],
    slots: [{ id: 'bowl', label: 'Cuenco', categories: ['ceramic', 'wood', 'stone'], default: 'ceramic-white' }],
    price: 45,
  },
  {
    type: 'candles',
    name: 'Candelabros',
    category: 'decor',
    placement: 'surface',
    variants: [{ label: 'Trío', size: [0.22, 0.32, 0.12] }],
    slots: [{ id: 'metal', label: 'Metal', categories: ['metal'], default: 'brass' }],
    price: 70,
  },
  {
    type: 'sculpture',
    name: 'Escultura Ola',
    category: 'decor',
    placement: 'surface',
    variants: [{ label: 'Estándar', size: [0.2, 0.3, 0.12] }],
    slots: [{ id: 'material', label: 'Material', categories: ['stone', 'ceramic', 'metal', 'wood'], default: 'marble-carrara' }],
    price: 120,
  },
  {
    type: 'throw-blanket',
    name: 'Manta de lana',
    category: 'decor',
    placement: 'surface',
    variants: [{ label: 'Estándar', size: [0.5, 0.06, 0.38] }],
    slots: [{ id: 'fabric', label: 'Tejido', categories: ['fabric'], default: 'velvet-mustard' }],
    price: 75,
  },

  // ── Rugs ─────────────────────────────────────────────────────────────────
  {
    type: 'rug-rect',
    name: 'Alfombra rectangular',
    category: 'rugs',
    placement: 'rug',
    variants: [
      { label: '160 × 230', size: [2.3, 0.012, 1.6] },
      { label: '200 × 300', size: [3.0, 0.012, 2.0] },
      { label: '250 × 350', size: [3.5, 0.012, 2.5] },
    ],
    slots: [{ id: 'rug', label: 'Diseño', categories: ['rug'], default: 'rug-berber' }],
    price: 640,
  },
  {
    type: 'rug-round',
    name: 'Alfombra redonda',
    category: 'rugs',
    placement: 'rug',
    variants: [
      { label: 'Ø 160', size: [1.6, 0.012, 1.6] },
      { label: 'Ø 200', size: [2.0, 0.012, 2.0] },
      { label: 'Ø 250', size: [2.5, 0.012, 2.5] },
    ],
    slots: [{ id: 'rug', label: 'Diseño', categories: ['rug'], default: 'rug-jute' }],
    price: 420,
  },
  {
    type: 'rug-runner',
    name: 'Alfombra de pasillo',
    category: 'rugs',
    placement: 'rug',
    variants: [{ label: '80 × 250', size: [2.5, 0.012, 0.8] }],
    slots: [{ id: 'rug', label: 'Diseño', categories: ['rug'], default: 'rug-stripes' }],
    price: 260,
  },

  // ── Wall ─────────────────────────────────────────────────────────────────
  {
    type: 'art-frame',
    name: 'Obra enmarcada',
    category: 'wall',
    placement: 'wall',
    mountHeight: 1.55,
    variants: [
      { label: 'Vertical 70 × 100', size: [0.7, 1.0, 0.035] },
      { label: 'Apaisada 120 × 80', size: [1.2, 0.8, 0.035] },
      { label: 'Grande 100 × 130', size: [1.0, 1.3, 0.035] },
      { label: 'Lámina 40 × 50', size: [0.4, 0.5, 0.03] },
    ],
    slots: [
      { id: 'art', label: 'Obra', categories: ['art'], default: 'art-arches' },
      { id: 'frame', label: 'Marco', categories: ['wood', 'metal', 'lacquer'], default: 'oak' },
    ],
    price: 320,
  },
  {
    type: 'mirror-round',
    name: 'Espejo Sol',
    category: 'wall',
    placement: 'wall',
    mountHeight: 1.6,
    variants: [
      { label: 'Ø 70', size: [0.7, 0.7, 0.03] },
      { label: 'Ø 90', size: [0.9, 0.9, 0.03] },
    ],
    slots: [{ id: 'frame', label: 'Marco', categories: ['metal', 'wood'], default: 'brass' }],
    price: 280,
  },
  {
    type: 'wall-shelf',
    name: 'Estante flotante',
    category: 'wall',
    placement: 'wall',
    mountHeight: 1.35,
    variants: [
      { label: '80 cm', size: [0.8, 0.035, 0.24] },
      { label: '120 cm', size: [1.2, 0.035, 0.24] },
    ],
    slots: [{ id: 'wood', label: 'Madera', categories: ['wood', 'lacquer'], default: 'walnut' }],
    surfaces: ([w, h, d]) => [{ x: 0, z: 0, w: w - 0.02, d: d - 0.02, y: h / 2, clearance: 0.6 }],
    price: 120,
  },
  {
    type: 'curtains',
    name: 'Cortinas de lino',
    category: 'wall',
    placement: 'wall',
    coversOpenings: true,
    mountHeight: 1.33,
    variants: [
      { label: 'Ventana 190', size: [1.9, 2.62, 0.13] },
      { label: 'Ventanal 300', size: [3.0, 2.62, 0.13] },
    ],
    slots: [
      { id: 'fabric', label: 'Tejido', categories: ['fabric'], default: 'linen-oat' },
      { id: 'rod', label: 'Barra', categories: ['metal', 'wood'], default: 'brass' },
    ],
    // only the gathered side panels occupy space; the window stays clear
    colliders: ([w, h, d]) => [
      { x: -w / 2 + 0.2, z: d / 2, w: 0.4, d, y0: -h / 2, y1: h / 2 },
      { x: w / 2 - 0.2, z: d / 2, w: 0.4, d, y0: -h / 2, y1: h / 2 },
    ],
    price: 230,
  },
  {
    type: 'tv',
    name: 'Televisor 65"',
    category: 'wall',
    placement: 'wall',
    mountHeight: 1.25,
    variants: [{ label: '65"', size: [1.45, 0.84, 0.04] }],
    slots: [],
    price: 1290,
  },
];

export const CATALOG: Record<string, ItemDef> = Object.fromEntries(defs.map((d) => [d.type, d]));
export const CATALOG_LIST = defs;

export function getDef(type: string): ItemDef {
  const d = CATALOG[type];
  if (!d) throw new Error(`Unknown item type ${type}`);
  return d;
}

export function itemSize(type: string, variant = 0): [number, number, number] {
  const d = getDef(type);
  return d.variants[Math.min(variant, d.variants.length - 1)].size;
}

export function defaultMaterials(type: string): Record<string, string> {
  return Object.fromEntries(getDef(type).slots.map((s) => [s.id, s.default]));
}

export function colliders(type: string, variant = 0): Collider[] {
  const def = getDef(type);
  const size = itemSize(type, variant);
  if (def.colliders) return def.colliders(size);
  const [w, h, d] = size;
  switch (def.placement) {
    case 'wall':
      // origin on the wall face at the item's vertical center, extends along +Z
      return [{ x: 0, z: d / 2, w, d, y0: -h / 2, y1: h / 2 }];
    case 'ceiling':
      // origin at the ceiling attachment point, hangs downward
      return [{ x: 0, z: 0, w, d, y0: -h, y1: 0 }];
    default:
      return [{ x: 0, z: 0, w, d, y0: 0, y1: h }];
  }
}

export function surfaces(type: string, variant = 0): Surface[] {
  const def = getDef(type);
  return def.surfaces ? def.surfaces(itemSize(type, variant)) : [];
}
