import { defaultMaterials, getDef } from './catalog';
import type { DesignDoc, ItemInstance, RoomFinishes, Vec3, WallId } from './types';
import { WALLS, wallFacingRotation, wallToWorld } from './room';

// Starter designs. One carefully composed layout with three distinct moods,
// plus an empty shell to start from scratch.

let counter = 0;
export function newId(prefix = 'it'): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}${counter.toString(36)}`;
}

function item(id: string, type: string, position: Vec3, rotation = 0, extra: Partial<ItemInstance> = {}): ItemInstance {
  const { materials, ...rest } = extra;
  return { id, type, position, rotation, ...rest, materials: { ...defaultMaterials(type), ...(materials ?? {}) } };
}

function onWall(id: string, type: string, wall: WallId, u: number, y: number, extra: Partial<ItemInstance> = {}): ItemInstance {
  const w = WALLS[wall];
  const [x, z] = wallToWorld(w, u, 0);
  return item(id, type, [x, y, z], wallFacingRotation(w), { wall, ...extra });
}

const PI = Math.PI;

function baseLayout(): ItemInstance[] {
  const tableX = 1.95;
  const tableZ = -0.85;
  const chairR = 0.66;
  return [
    // Living
    item('rug-living', 'rug-rect', [-1.45, 0, -1.3], 0, { variant: 1 }),
    item('sofa', 'sofa', [-1.45, 0, -2.8 + 0.49 + 0.004], 0, { variant: 1 }),
    item('coffee', 'coffee-round', [-1.45, 0, -1.12], 0),
    item('coffee-books', 'books', [0.15, 0.36, 0.12], 0.3, { parentId: 'coffee' }),
    item('coffee-vase', 'vase', [-0.17, 0.36, -0.12], 0, { parentId: 'coffee' }),
    item('lounge', 'lounge-chair', [-2.3, 0, -0.12], 2.4),
    item('tub', 'tub-chair', [-0.45, 0, -0.18], -2.3),
    item('side', 'side-table', [0.12, 0, -2.8 + 0.225 + 0.004], 0),
    item('side-lamp', 'table-lamp', [0, 0.52, 0], 0, { parentId: 'side' }),
    item('arc', 'arc-lamp', [-2.75, 0, -2.04], 0.905),
    item('fiddle', 'plant-fiddle', [-3.2, 0, 0.23], 0.4, { variant: 1 }),
    item('shelf', 'bookshelf', [-3.6 + 0.19 + 0.004, 0, 1.35], PI / 2),
    item('shelf-plant', 'plant-small', [0.27, 0.03 + ((2.0 - 0.03) / 5) * 3, 0], 0, { parentId: 'shelf' }),
    item('shelf-vase', 'vase', [0.25, 0.03 + ((2.0 - 0.03) / 5) * 1, 0], 0, { parentId: 'shelf', variant: 1, materials: { vase: 'ceramic-black' } }),
    item('shelf-sculpture', 'sculpture', [0.25, 0.03 + ((2.0 - 0.03) / 5) * 2, 0], 0.4, { parentId: 'shelf' }),
    item('olive', 'plant-olive', [-3.1, 0, 2.3], 0),
    onWall('art-living', 'art-frame', 'north', 4.25, 1.62, { variant: 0, materials: { art: 'art-arches', frame: 'oak' } }),

    // Dining
    item('rug-dining', 'rug-round', [tableX, 0, tableZ], 0, { variant: 1 }),
    item('dining', 'dining-round', [tableX, 0, tableZ], 0),
    item('dining-branches', 'vase-branches', [0, 0.75, 0], 0, { parentId: 'dining' }),
    item('chair-n', 'dining-chair', [tableX, 0, tableZ - chairR], 0),
    item('chair-s', 'dining-chair', [tableX, 0, tableZ + chairR], PI),
    item('chair-w', 'dining-chair', [tableX - chairR, 0, tableZ], PI / 2),
    item('chair-e', 'dining-chair', [tableX + chairR, 0, tableZ], -PI / 2),
    item('pendant', 'pendant-globe', [tableX, 2.85, tableZ], 0, { variant: 1 }),
    item('sideboard', 'sideboard', [3.6 - 0.23 - 0.004, 0, -0.85], -PI / 2),
    item('sb-vase', 'vase', [-0.55, 0.72, 0], 0, { parentId: 'sideboard', variant: 1 }),
    item('sb-books', 'books', [0.05, 0.72, 0.02], -0.1, { parentId: 'sideboard' }),
    item('sb-candles', 'candles', [0.5, 0.72, 0], 0, { parentId: 'sideboard' }),
    onWall('art-dining', 'art-frame', 'east', 1.95, 1.75, { variant: 1, materials: { art: 'art-blocks', frame: 'ash-black' } }),
    item('snake', 'plant-snake', [3.3, 0, 0.55], 0),
  ];
}

type Theme = {
  id: string;
  name: string;
  description: string;
  finishes: RoomFinishes;
  materials: Record<string, Record<string, string>>;
};

const THEMES: Theme[] = [
  {
    id: 'casa-luz',
    name: 'Casa Luz',
    description: 'Roble claro, lino y travertino bañados de luz natural.',
    finishes: {
      floor: 'floor-oak-planks',
      walls: { north: 'paint-warm-white', south: 'paint-warm-white', east: 'wall-limewash', west: 'paint-warm-white' },
      ceiling: 'paint-white',
      trim: 'paint-warm-white',
      frames: 'steel-black',
    },
    materials: {},
  },
  {
    id: 'nogal-noche',
    name: 'Nogal Nocturno',
    description: 'Verde bosque, nogal en espiga y piel coñac. Íntimo y envolvente.',
    finishes: {
      floor: 'floor-herringbone-walnut',
      walls: { north: 'paint-forest', south: 'paint-forest', east: 'wall-walnut-slats', west: 'paint-forest' },
      ceiling: 'paint-bone',
      trim: 'paint-forest',
      frames: 'bronze',
    },
    materials: {
      sofa: { upholstery: 'velvet-mustard', legs: 'walnut' },
      'rug-living': { rug: 'rug-charcoal' },
      coffee: { top: 'marble-nero', base: 'marble-nero' },
      lounge: { frame: 'walnut', cushion: 'leather-black' },
      tub: { upholstery: 'velvet-terracotta', base: 'bronze' },
      dining: { top: 'walnut', base: 'walnut' },
      'rug-dining': { rug: 'rug-border' },
      'chair-n': { frame: 'walnut', seat: 'leather-cognac' },
      'chair-s': { frame: 'walnut', seat: 'leather-cognac' },
      'chair-e': { frame: 'walnut', seat: 'leather-cognac' },
      'chair-w': { frame: 'walnut', seat: 'leather-cognac' },
      sideboard: { body: 'lacquer-black', legs: 'bronze' },
      shelf: { wood: 'walnut' },
      'art-living': { art: 'art-sun', frame: 'brass' },
      'art-dining': { art: 'art-landscape', frame: 'brass' },
      pendant: { shade: 'shade-opal', metal: 'bronze' },
    },
  },
  {
    id: 'terracota',
    name: 'Terracota Mediterránea',
    description: 'Cal, terrazo y bouclé con acentos de barro cocido.',
    finishes: {
      floor: 'floor-terrazzo',
      walls: { north: 'wall-limewash', south: 'wall-limewash', east: 'wall-limewash-terra', west: 'wall-limewash' },
      ceiling: 'paint-warm-white',
      trim: 'paint-bone',
      frames: 'oak',
    },
    materials: {
      sofa: { upholstery: 'boucle-cream', legs: 'oak' },
      'rug-living': { rug: 'rug-abstract' },
      coffee: { top: 'oak', base: 'oak' },
      lounge: { frame: 'oak', cushion: 'linen-sage' },
      tub: { upholstery: 'velvet-terracotta', base: 'oak' },
      dining: { top: 'travertine', base: 'travertine' },
      'rug-dining': { rug: 'rug-jute' },
      sideboard: { body: 'oak-white', legs: 'oak' },
      'art-living': { art: 'art-lines', frame: 'oak' },
      'art-dining': { art: 'art-sun', frame: 'oak' },
      pendant: { shade: 'shade-paper', metal: 'brass' },
    },
  },
];

export interface PresetInfo {
  id: string;
  name: string;
  description: string;
  swatch: string[];
}

export const PRESETS: PresetInfo[] = [
  ...THEMES.map((t) => ({ id: t.id, name: t.name, description: t.description, swatch: [t.finishes.floor, t.finishes.walls.north, t.finishes.walls.east] })),
  { id: 'empty', name: 'Lienzo en blanco', description: 'La estancia vacía, lista para empezar desde cero.', swatch: ['floor-oak-light', 'paint-white', 'paint-white'] },
];

export function createPreset(id: string): DesignDoc {
  if (id === 'empty') {
    return {
      version: 1,
      name: 'Lienzo en blanco',
      finishes: {
        floor: 'floor-oak-light',
        walls: { north: 'paint-white', south: 'paint-white', east: 'paint-white', west: 'paint-white' },
        ceiling: 'paint-white',
        trim: 'paint-white',
        frames: 'steel-black',
      },
      items: [],
      bookmarks: [],
    };
  }
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
  const items = baseLayout().map((it) => {
    const m = theme.materials[it.id];
    return m ? { ...it, materials: { ...it.materials, ...m } } : it;
  });
  // Validate material slots exist (defensive, keeps presets in sync with catalog).
  for (const it of items) {
    const slots = new Set(getDef(it.type).slots.map((s) => s.id));
    for (const k of Object.keys(it.materials)) if (!slots.has(k)) delete it.materials[k];
  }
  return { version: 1, name: theme.name, finishes: structuredClone(theme.finishes), items, bookmarks: [] };
}
