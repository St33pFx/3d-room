import { create } from 'zustand';
import { defaultMaterials, getDef, itemSize } from '../core/catalog';
import { descendants, findFloorSpot, findItem, findSurfaceSpot, findWallSpot, rotateItem, wallCoords } from '../core/placement';
import { createPreset, newId } from '../core/presets';
import { readAutosave, saveProject, writeAutosave, type SavedProject } from '../core/persistence';
import type { CameraBookmark, CameraMode, DesignDoc, EnvironmentState, ItemInstance, RoomFinishes, Selection, SnapMode, WallId } from '../core/types';
import { WALLS } from '../core/room';

// Global app state. The design document is immutable: every edit creates a
// new doc, which makes undo/redo a matter of keeping references.

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

interface HistoryEntry {
  doc: DesignDoc;
  label: string;
}

export type Quality = 'high' | 'balanced';

export interface UIState {
  hidden: boolean;
  library: boolean;
  inspector: boolean;
  snap: SnapMode;
  quality: Quality;
  shortcuts: boolean;
  projects: boolean;
  onboarding: boolean;
  libraryCategory: string;
}

export interface AppState {
  doc: DesignDoc;
  past: HistoryEntry[];
  future: HistoryEntry[];
  gesture: { base: DesignDoc; label: string } | null;
  selection: Selection;
  hovered: string | null;
  invalid: boolean;
  env: EnvironmentState;
  timelapse: boolean;
  camera: { mode: CameraMode; shot: number; tour: boolean };
  ui: UIState;
  toasts: Toast[];
  projectId: string | null;
  dirty: boolean;
  lastSavedAt: number | null;
  ready: boolean;
  loading: { done: number; total: number; label: string };

  commit: (doc: DesignDoc, label: string) => void;
  beginGesture: (label: string) => void;
  preview: (doc: DesignDoc) => void;
  endGesture: () => void;
  cancelGesture: () => void;
  undo: () => void;
  redo: () => void;

  select: (s: Selection) => void;
  hover: (id: string | null) => void;
  setInvalid: (v: boolean) => void;

  addItem: (type: string, hint?: AddHint) => ItemInstance | null;
  updateItem: (id: string, patch: Partial<ItemInstance>, label: string) => void;
  removeItem: (id: string) => void;
  duplicateItem: (id: string) => void;
  rotateBy: (id: string, delta: number) => void;
  setFinish: (kind: keyof RoomFinishes, value: string, wall?: WallId | 'all') => void;
  addBookmark: (b: CameraBookmark) => void;
  removeBookmark: (id: string) => void;

  setEnv: (patch: Partial<EnvironmentState>) => void;
  setTimelapse: (on: boolean) => void;
  setCamera: (patch: Partial<AppState['camera']>) => void;
  setUI: (patch: Partial<UIState>) => void;
  toast: (text: string, action?: Toast['action']) => void;
  dismissToast: (id: number) => void;

  loadDoc: (doc: DesignDoc, opts?: { projectId?: string | null; env?: Partial<EnvironmentState>; label?: string }) => void;
  newFromPreset: (presetId: string) => void;
  saveCurrent: (thumbnail?: string, asNew?: boolean) => SavedProject | null;
  rename: (name: string) => void;
  setLoading: (l: Partial<AppState['loading']>) => void;
  setReady: () => void;
}

export interface AddHint {
  /** preferred floor point */
  x?: number;
  z?: number;
  /** walls ordered by preference */
  walls?: WallId[];
  /** preferred parent for surface items */
  parentId?: string;
  rotation?: number;
}

const HISTORY_LIMIT = 120;
let toastId = 1;

function defaultEnv(): EnvironmentState {
  return { time: 17.25, orientation: 0, lampMode: 'auto', exposure: 1 };
}

function initial(): { doc: DesignDoc; env: EnvironmentState; projectId: string | null; restored: boolean } {
  const saved = readAutosave();
  if (saved) return { doc: saved.doc, env: { ...defaultEnv(), ...saved.env }, projectId: saved.projectId, restored: true };
  return { doc: createPreset('casa-luz'), env: defaultEnv(), projectId: null, restored: false };
}

const init = initial();

export const useStore = create<AppState>()((set, get) => ({
  doc: init.doc,
  past: [],
  future: [],
  gesture: null,
  selection: null,
  hovered: null,
  invalid: false,
  env: init.env,
  timelapse: false,
  camera: { mode: 'orbit', shot: 0, tour: false },
  ui: {
    hidden: false,
    library: true,
    inspector: true,
    snap: 'smart',
    quality: 'high',
    shortcuts: false,
    projects: false,
    onboarding: !init.restored,
    libraryCategory: 'seating',
  },
  toasts: [],
  projectId: init.projectId,
  dirty: false,
  lastSavedAt: null,
  ready: false,
  loading: { done: 0, total: 1, label: 'Preparando el estudio' },

  commit: (doc, label) => {
    const { doc: prev, past } = get();
    if (doc === prev) return;
    set({ doc, past: [...past, { doc: prev, label }].slice(-HISTORY_LIMIT), future: [], dirty: true });
  },
  beginGesture: (label) => {
    if (get().gesture) return;
    set({ gesture: { base: get().doc, label } });
  },
  preview: (doc) => set({ doc }),
  endGesture: () => {
    const g = get().gesture;
    if (!g) return;
    const { doc, past } = get();
    if (doc === g.base) {
      set({ gesture: null });
      return;
    }
    set({ gesture: null, past: [...past, { doc: g.base, label: g.label }].slice(-HISTORY_LIMIT), future: [], dirty: true });
  },
  cancelGesture: () => {
    const g = get().gesture;
    if (!g) return;
    set({ doc: g.base, gesture: null, invalid: false });
  },
  undo: () => {
    const { past, future, doc, gesture } = get();
    if (gesture || !past.length) return;
    const entry = past[past.length - 1];
    set({ doc: entry.doc, past: past.slice(0, -1), future: [{ doc, label: entry.label }, ...future], dirty: true });
    fixSelection(get, set);
    get().toast(`Deshecho · ${entry.label}`);
  },
  redo: () => {
    const { past, future, doc, gesture } = get();
    if (gesture || !future.length) return;
    const entry = future[0];
    set({ doc: entry.doc, future: future.slice(1), past: [...past, { doc, label: entry.label }], dirty: true });
    fixSelection(get, set);
    get().toast(`Rehecho · ${entry.label}`);
  },

  select: (s) => set({ selection: s }),
  hover: (id) => {
    if (get().hovered !== id) set({ hovered: id });
  },
  setInvalid: (v) => {
    if (get().invalid !== v) set({ invalid: v });
  },

  addItem: (type, hint = {}) => {
    const { doc } = get();
    const def = getDef(type);
    const base: ItemInstance = {
      id: newId(type.split('-')[0]),
      type,
      position: [0, 0, 0],
      rotation: hint.rotation ?? 0,
      materials: defaultMaterials(type),
      variant: def.variants.length > 1 && def.placement === 'rug' ? 1 : 0,
    };
    let placed: ItemInstance | null = null;
    if (def.placement === 'wall') {
      placed = findWallSpot(doc, base, hint.walls ?? ['north', 'east', 'west', 'south']);
    } else if (def.placement === 'surface') {
      const parent = findItem(doc, hint.parentId);
      if (parent) placed = findSurfaceSpot(doc, base, parent);
      if (!placed) {
        // any furniture with a free surface near the hint point
        const candidates = doc.items
          .filter((i) => getDef(i.type).surfaces && !i.parentId)
          .sort((a, b) => Math.hypot(a.position[0] - (hint.x ?? 0), a.position[2] - (hint.z ?? 0)) - Math.hypot(b.position[0] - (hint.x ?? 0), b.position[2] - (hint.z ?? 0)));
        for (const c of candidates) {
          placed = findSurfaceSpot(doc, base, c);
          if (placed) break;
        }
      }
      if (!placed) placed = findFloorSpot(doc, base, hint.x ?? 0, hint.z ?? 0, base.rotation);
    } else {
      placed = findFloorSpot(doc, base, hint.x ?? 0, hint.z ?? 0, base.rotation);
    }
    if (!placed) {
      get().toast(`No queda espacio libre para ${def.name}`);
      return null;
    }
    get().commit({ ...doc, items: [...doc.items, placed] }, `Añadir ${def.name}`);
    set({ selection: { kind: 'item', id: placed.id } });
    return placed;
  },

  updateItem: (id, patch, label) => {
    const { doc } = get();
    const items = doc.items.map((i) => (i.id === id ? { ...i, ...patch } : i));
    get().commit({ ...doc, items }, label);
  },

  removeItem: (id) => {
    const { doc } = get();
    const it = findItem(doc, id);
    if (!it) return;
    const kill = descendants(doc, id);
    kill.add(id);
    const name = getDef(it.type).name;
    get().commit({ ...doc, items: doc.items.filter((i) => !kill.has(i.id)) }, `Eliminar ${name}`);
    set({ selection: null, hovered: null });
    get().toast(`${name} eliminado`, { label: 'Deshacer', run: () => get().undo() });
  },

  duplicateItem: (id) => {
    const { doc } = get();
    const src = findItem(doc, id);
    if (!src) return;
    const def = getDef(src.type);
    const copy: ItemInstance = { ...structuredClone(src), id: newId(src.type.split('-')[0]) };
    let placed: ItemInstance | null = null;
    if (def.placement === 'wall') {
      const wc = wallCoords(src);
      placed = findWallSpot(doc, copy, [src.wall ?? 'north', 'north', 'east', 'west', 'south'], wc ? wc.u + itemSize(src.type, src.variant)[0] + 0.15 : undefined);
    } else if (src.parentId) {
      const parent = findItem(doc, src.parentId);
      placed = parent ? findSurfaceSpot(doc, copy, parent) : null;
    } else {
      const w = itemSize(src.type, src.variant)[0];
      const [dx, dz] = [Math.cos(src.rotation) * (w + 0.1), -Math.sin(src.rotation) * (w + 0.1)];
      placed = findFloorSpot(doc, copy, src.position[0] + dx, src.position[2] + dz, src.rotation);
    }
    if (!placed) {
      get().toast('No hay espacio para duplicarlo');
      return;
    }
    // Duplicate children resting on the item too.
    const children = doc.items.filter((i) => i.parentId === id).map((c) => ({ ...structuredClone(c), id: newId(c.type.split('-')[0]), parentId: placed!.id }));
    get().commit({ ...doc, items: [...doc.items, placed, ...children] }, `Duplicar ${def.name}`);
    set({ selection: { kind: 'item', id: placed.id } });
    get().toast(`${def.name} duplicado`);
  },

  rotateBy: (id, delta) => {
    const { doc } = get();
    const it = findItem(doc, id);
    if (!it || getDef(it.type).placement === 'wall') return;
    const r = rotateItem(doc, it, it.rotation + delta);
    if (!r) {
      get().toast('No hay espacio para girarlo ahí');
      return;
    }
    get().commit({ ...doc, items: doc.items.map((i) => (i.id === id ? r : i)) }, `Girar ${getDef(it.type).name}`);
  },

  setFinish: (kind, value, wall) => {
    const { doc } = get();
    const f = structuredClone(doc.finishes);
    if (kind === 'walls') {
      if (!wall || wall === 'all') for (const w of Object.keys(f.walls) as WallId[]) f.walls[w] = value;
      else f.walls[wall] = value;
    } else {
      (f[kind] as string) = value;
    }
    const labels: Record<keyof RoomFinishes, string> = { floor: 'suelo', walls: 'paredes', ceiling: 'techo', trim: 'molduras', frames: 'carpintería' };
    get().commit({ ...doc, finishes: f }, `Cambiar ${kind === 'walls' && wall && wall !== 'all' ? WALLS[wall].label.toLowerCase() : labels[kind]}`);
  },

  addBookmark: (b) => {
    const { doc } = get();
    get().commit({ ...doc, bookmarks: [...doc.bookmarks, b] }, `Guardar vista ${b.name}`);
    get().toast(`Vista «${b.name}» guardada`);
  },
  removeBookmark: (id) => {
    const { doc } = get();
    get().commit({ ...doc, bookmarks: doc.bookmarks.filter((b) => b.id !== id) }, 'Eliminar vista');
  },

  setEnv: (patch) => set({ env: { ...get().env, ...patch } }),
  setTimelapse: (on) => set({ timelapse: on }),
  setCamera: (patch) => set({ camera: { ...get().camera, ...patch } }),
  setUI: (patch) => set({ ui: { ...get().ui, ...patch } }),
  toast: (text, action) => {
    const id = toastId++;
    set({ toasts: [...get().toasts.slice(-3), { id, text, action }] });
    setTimeout(() => get().dismissToast(id), action ? 5200 : 2600);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  loadDoc: (doc, opts = {}) => {
    const { doc: prev, past } = get();
    set({
      doc,
      past: opts.label ? [...past, { doc: prev, label: opts.label }] : [],
      future: [],
      selection: null,
      hovered: null,
      projectId: opts.projectId ?? null,
      env: opts.env ? { ...get().env, ...opts.env } : get().env,
      dirty: false,
    });
  },
  newFromPreset: (presetId) => {
    const doc = createPreset(presetId);
    get().loadDoc(doc, { projectId: null, label: `Plantilla ${doc.name}` });
    set({ dirty: true });
  },
  saveCurrent: (thumbnail, asNew) => {
    const { doc, env } = get();
    let id = get().projectId;
    if (!id || asNew) id = newId('prj');
    const p: SavedProject = { id, name: doc.name, updatedAt: Date.now(), thumbnail, doc, env };
    if (!saveProject(p)) {
      get().toast('No se pudo guardar: almacenamiento lleno');
      return null;
    }
    set({ projectId: id, dirty: false, lastSavedAt: p.updatedAt });
    return p;
  },
  rename: (name) => {
    const { doc } = get();
    if (!name.trim() || name === doc.name) return;
    get().commit({ ...doc, name: name.trim().slice(0, 80) }, 'Renombrar diseño');
  },
  setLoading: (l) => set({ loading: { ...get().loading, ...l } }),
  setReady: () => set({ ready: true }),
}));

function fixSelection(get: () => AppState, set: (p: Partial<AppState>) => void) {
  const s = get().selection;
  if (s?.kind === 'item' && !findItem(get().doc, s.id)) set({ selection: null });
}

// Autosave the working state (debounced).
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
useStore.subscribe((s, prev) => {
  const gestureEnded = !!prev.gesture && !s.gesture;
  if (s.doc === prev.doc && s.env === prev.env && !gestureEnded) return;
  if (s.gesture) return;
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    const st = useStore.getState();
    writeAutosave({ doc: st.doc, env: st.env, projectId: st.projectId });
  }, 500);
});

export const selectedItem = (s: AppState): ItemInstance | undefined => (s.selection?.kind === 'item' ? findItem(s.doc, s.selection.id) : undefined);
