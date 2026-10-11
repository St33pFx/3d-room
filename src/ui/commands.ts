import { getDef } from '../core/catalog';
import { findItem, placeOnFloor, placeOnSurface, placeOnWall, surfaceAt, wallCoords, worldPose } from '../core/placement';
import { exportJSON, importJSON } from '../core/persistence';
import { getEngine } from '../engine/Engine';
import { useStore } from '../state/store';

// User commands shared by keyboard shortcuts, toolbars and menus.

/** Move the selected item by a small offset relative to the camera view. */
export function nudgeSelection(dx: number, dz: number) {
  const st = useStore.getState();
  if (st.selection?.kind !== 'item') return;
  const it = findItem(st.doc, st.selection.id);
  if (!it || it.locked) return;
  const def = getDef(it.type);
  // Make arrow keys camera-relative: rotate the offset by the view yaw.
  const eng = getEngine();
  let wx = dx;
  let wz = dz;
  if (eng) {
    const cam = eng.camera;
    const t = eng.rig.controls.target;
    const yaw = Math.atan2(cam.position.x - t.x, cam.position.z - t.z);
    const snapYaw = Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
    const c = Math.cos(snapYaw);
    const s = Math.sin(snapYaw);
    wx = dx * c + dz * s;
    wz = -dx * s + dz * c;
  }
  const doc = st.doc;
  let next = null;
  if (def.placement === 'wall') {
    const wc = wallCoords(it);
    if (!wc || !it.wall) return;
    // left/right slide along the wall; up/down move vertically
    const res = placeOnWall(doc, it, { wall: it.wall, u: wc.u + dx, y: wc.y - dz, prev: { wall: it.wall, u: wc.u, y: wc.y } }, 'off');
    next = res.valid ? res.item : null;
  } else if (it.parentId) {
    const parent = findItem(doc, it.parentId);
    if (!parent) return;
    const pose = worldPose(doc, it);
    const idx = surfaceAt(doc, parent, pose.x, pose.y + 0.01, pose.z);
    const res = placeOnSurface(doc, it, { parentId: parent.id, surface: Math.max(0, idx), x: pose.x + wx, z: pose.z + wz, rot: it.rotation, prev: it }, 'off');
    next = res.valid ? res.item : null;
  } else {
    const res = placeOnFloor(doc, it, { x: it.position[0] + wx, z: it.position[2] + wz, rot: it.rotation, prev: [it.position[0], it.position[2]] }, 'off');
    next = res.valid ? res.item : null;
  }
  if (!next) return;
  st.commit({ ...doc, items: doc.items.map((i) => (i.id === it.id ? next! : i)) }, `Mover ${def.name}`);
}

export async function downloadScreenshot() {
  const eng = getEngine();
  if (!eng) return;
  const st = useStore.getState();
  st.toast('Renderizando captura…');
  const blob = await eng.screenshot(2);
  if (!blob) return;
  const name = `${st.doc.name.replace(/[^\w\- áéíóúñ]/gi, '').trim() || 'atelier'} ${new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', 'h')}.png`;
  triggerDownload(blob, name);
  st.toast('Captura guardada');
}

export function exportDesign() {
  const st = useStore.getState();
  const blob = new Blob([exportJSON(st.doc, st.env)], { type: 'application/json' });
  triggerDownload(blob, `${st.doc.name || 'diseño'}.atelier.json`);
  st.toast('Diseño exportado');
}

export function importDesign() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = async () => {
    const f = input.files?.[0];
    if (!f) return;
    const text = await f.text();
    const res = importJSON(text);
    const st = useStore.getState();
    if (!res) {
      st.toast('Ese archivo no es un diseño válido');
      return;
    }
    st.loadDoc(res.doc, { projectId: null, env: res.env, label: 'Importar diseño' });
    st.setUI({ projects: false });
    st.toast(`«${res.doc.name}» importado`);
  };
  input.click();
}

export function saveDesign(asNew = false) {
  const eng = getEngine();
  const st = useStore.getState();
  const thumb = eng?.thumbnail(360);
  const p = st.saveCurrent(thumb, asNew);
  if (p) st.toast(asNew ? `Guardado como «${p.name}»` : 'Diseño guardado');
}

function triggerDownload(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

export function formatTime(t: number): string {
  const h = Math.floor(t) % 24;
  const m = Math.floor((t - Math.floor(t)) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function formatPrice(v: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}
