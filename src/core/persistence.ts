import { CATALOG, getDef } from './catalog';
import { MATERIALS } from './materials';
import type { DesignDoc, EnvironmentState, ItemInstance } from './types';
import { WALL_IDS } from './room';

// Saving and loading designs (localStorage + JSON files) with validation so a
// damaged or hand-edited file can never break the app.

export interface SavedProject {
  id: string;
  name: string;
  updatedAt: number;
  thumbnail?: string;
  doc: DesignDoc;
  env?: Partial<EnvironmentState>;
}

const KEY_PROJECTS = 'atelier.projects.v1';
const KEY_AUTOSAVE = 'atelier.autosave.v1';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function listProjects(): SavedProject[] {
  const s = storage();
  if (!s) return [];
  try {
    const raw = JSON.parse(s.getItem(KEY_PROJECTS) ?? '[]') as SavedProject[];
    return raw
      .map((p) => ({ ...p, doc: sanitizeDoc(p.doc) }))
      .filter((p): p is SavedProject & { doc: DesignDoc } => !!p.doc)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function writeProjects(list: SavedProject[]): boolean {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(KEY_PROJECTS, JSON.stringify(list));
    return true;
  } catch {
    // Quota: drop thumbnails of the oldest projects and retry once.
    try {
      const slim = list.map((p, i) => (i > 3 ? { ...p, thumbnail: undefined } : p));
      s.setItem(KEY_PROJECTS, JSON.stringify(slim));
      return true;
    } catch {
      return false;
    }
  }
}

export function saveProject(p: SavedProject): boolean {
  const list = listProjects().filter((x) => x.id !== p.id);
  list.unshift(p);
  return writeProjects(list);
}

export function deleteProject(id: string): void {
  writeProjects(listProjects().filter((x) => x.id !== id));
}

export function renameProject(id: string, name: string): void {
  writeProjects(listProjects().map((p) => (p.id === id ? { ...p, name, doc: { ...p.doc, name } } : p)));
}

export interface AutosaveData {
  doc: DesignDoc;
  env: EnvironmentState;
  projectId: string | null;
}

export function writeAutosave(data: AutosaveData): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(KEY_AUTOSAVE, JSON.stringify(data));
  } catch {
    /* ignore quota errors for autosave */
  }
}

export function readAutosave(): AutosaveData | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = JSON.parse(s.getItem(KEY_AUTOSAVE) ?? 'null');
    if (!raw) return null;
    const doc = sanitizeDoc(raw.doc);
    if (!doc) return null;
    return { doc, env: raw.env, projectId: raw.projectId ?? null };
  } catch {
    return null;
  }
}

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Validate and repair a design document. Returns null if unusable. */
export function sanitizeDoc(input: unknown): DesignDoc | null {
  if (!input || typeof input !== 'object') return null;
  const d = input as Partial<DesignDoc>;
  if (!Array.isArray(d.items) || !d.finishes) return null;
  const mat = (id: unknown, fallback: string) => (typeof id === 'string' && MATERIALS[id] ? id : fallback);
  const walls = {} as DesignDoc['finishes']['walls'];
  for (const w of WALL_IDS) walls[w] = mat(d.finishes.walls?.[w], 'paint-white');
  const ids = new Set<string>();
  const items: ItemInstance[] = [];
  for (const raw of d.items as Partial<ItemInstance>[]) {
    if (!raw || typeof raw.type !== 'string' || !CATALOG[raw.type] || typeof raw.id !== 'string' || ids.has(raw.id)) continue;
    const def = getDef(raw.type);
    const p = Array.isArray(raw.position) ? raw.position : [0, 0, 0];
    const materials: Record<string, string> = {};
    for (const slot of def.slots) materials[slot.id] = mat(raw.materials?.[slot.id], slot.default);
    ids.add(raw.id);
    items.push({
      id: raw.id,
      type: raw.type,
      position: [num(p[0]), num(p[1]), num(p[2])],
      rotation: num(raw.rotation),
      materials,
      variant: Math.max(0, Math.min(def.variants.length - 1, Math.round(num(raw.variant)))),
      wall: def.placement === 'wall' && raw.wall && WALL_IDS.includes(raw.wall) ? raw.wall : undefined,
      parentId: typeof raw.parentId === 'string' ? raw.parentId : undefined,
      dimmer: raw.dimmer === undefined ? undefined : Math.max(0, Math.min(1.5, num(raw.dimmer, 1))),
      locked: !!raw.locked || undefined,
    });
  }
  // Drop children whose parent vanished.
  const valid = items.filter((i) => !i.parentId || ids.has(i.parentId));
  return {
    version: 1,
    name: typeof d.name === 'string' && d.name.trim() ? d.name.slice(0, 80) : 'Sin título',
    finishes: {
      floor: mat(d.finishes.floor, 'floor-oak-planks'),
      walls,
      ceiling: mat(d.finishes.ceiling, 'paint-white'),
      trim: mat(d.finishes.trim, 'paint-white'),
      frames: mat(d.finishes.frames, 'steel-black'),
    },
    items: valid,
    bookmarks: Array.isArray(d.bookmarks) ? d.bookmarks.filter((b) => b && Array.isArray(b.position) && Array.isArray(b.target)).slice(0, 24) : [],
  };
}

export function exportJSON(doc: DesignDoc, env: EnvironmentState): string {
  return JSON.stringify({ app: 'atelier', version: 1, doc, env }, null, 2);
}

export function importJSON(text: string): { doc: DesignDoc; env?: Partial<EnvironmentState> } | null {
  try {
    const raw = JSON.parse(text);
    const doc = sanitizeDoc(raw.doc ?? raw);
    if (!doc) return null;
    return { doc, env: raw.env };
  } catch {
    return null;
  }
}
