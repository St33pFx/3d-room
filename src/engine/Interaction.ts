import * as THREE from 'three';
import { getDef } from '../core/catalog';
import { WALLS, WALL_IDS, ROOM, worldToWall } from '../core/room';
import {
  descendants,
  findItem,
  placeOnFloor,
  placeOnSurface,
  placeOnWall,
  rotateItem,
  snapRotation,
  surfaceAt,
  wallCoords,
  worldPose,
  type Guide,
  type PlacementResult,
} from '../core/placement';
import type { DesignDoc, ItemInstance, WallId } from '../core/types';
import { useStore } from '../state/store';
import type { CameraRig } from './CameraRig';
import type { ItemLayer } from './ItemLayer';
import type { Overlays } from './Overlays';
import type { RoomShell } from './RoomShell';

// Pointer interaction: picking, dragging with placement rules, the rotation
// handle, and drag-and-drop from the library.

type DragKind = 'move' | 'rotate' | 'place';

interface DragState {
  kind: DragKind;
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  started: boolean;
  grabOffset: THREE.Vector3; // item position - grab point (world)
  planeY: number;
  wallGrab?: { du: number; dy: number };
  startRot: number;
  startAngle: number;
  last?: ItemInstance;
  shift: boolean;
}

export class Interaction {
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private drag: DragState | null = null;
  private pendingSurfaceClick: { x: number; y: number; target: THREE.Object3D } | null = null;
  guides: Guide[] = [];
  enabled = true;

  constructor(
    private dom: HTMLElement,
    private camera: THREE.PerspectiveCamera,
    private shell: RoomShell,
    private items: ItemLayer,
    private overlays: Overlays,
    private rig: CameraRig,
  ) {
    // capture phase so we can veto OrbitControls before it starts rotating
    dom.addEventListener('pointerdown', this.onDown, { capture: true });
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    dom.addEventListener('dblclick', this.onDblClick);
    this.raycaster.layers.enableAll();
  }

  /** True while the pointer is pressed on an item/handle (camera must not react). */
  get busy(): boolean {
    return !!this.drag;
  }

  private setPointer(clientX: number, clientY: number) {
    const r = this.dom.getBoundingClientRect();
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
  }

  private hitItem(exclude?: Set<string>): { id: string; point: THREE.Vector3; object: THREE.Object3D } | null {
    const objs = this.items.pickables(exclude);
    const hits = this.raycaster.intersectObjects(objs, false);
    // architecture can occlude items (e.g. walls in walk mode)
    const arch = this.raycaster.intersectObjects(this.shell.pickables.filter((o) => !o.userData.cut && (o !== this.shell.ceiling || this.shell.ceilingVisible)), false);
    const archDist = arch.length ? arch[0].distance : Infinity;
    for (const h of hits) {
      if (h.distance > archDist + 0.01) break;
      const id = h.object.userData.itemId as string | undefined;
      if (id) return { id, point: h.point, object: h.object };
    }
    return null;
  }

  private hitHandle(): boolean {
    if (!this.overlays.handle.visible) return false;
    const h = this.raycaster.intersectObject(this.overlays.handle, true);
    return h.length > 0;
  }

  private hitArchitecture(): THREE.Intersection | null {
    const objs = this.shell.pickables.filter((o) => !o.userData.cut && (o !== this.shell.ceiling || this.shell.ceilingVisible));
    const hits = this.raycaster.intersectObjects(objs, false);
    return hits[0] ?? null;
  }

  private onDown = (e: PointerEvent) => {
    if (!this.enabled || e.button !== 0) return;
    const st = useStore.getState();
    if (st.camera.mode === 'cinematic') return;
    this.setPointer(e.clientX, e.clientY);
    const sel = st.selection?.kind === 'item' ? findItem(st.doc, st.selection.id) : undefined;

    if (sel && !sel.locked && this.hitHandle()) {
      this.startDrag('rotate', sel, e, new THREE.Vector3());
      this.rig.controls.enabled = false;
      e.stopPropagation();
      return;
    }
    const hit = this.hitItem();
    if (hit) {
      // Clicking a child selects it; clicking an item selects the item.
      useStore.getState().select({ kind: 'item', id: hit.id });
      const it = findItem(useStore.getState().doc, hit.id)!;
      if (!it.locked) {
        this.startDrag('move', it, e, hit.point);
        this.rig.controls.enabled = false;
      }
      return;
    }
    const arch = this.hitArchitecture();
    this.pendingSurfaceClick = arch ? { x: e.clientX, y: e.clientY, target: arch.object } : { x: e.clientX, y: e.clientY, target: this.dom as unknown as THREE.Object3D };
  };

  private startDrag(kind: DragKind, it: ItemInstance, e: PointerEvent, point: THREE.Vector3) {
    const doc = useStore.getState().doc;
    const pose = worldPose(doc, it);
    const def = getDef(it.type);
    let planeY = point.y;
    if (def.placement === 'floor' || def.placement === 'rug') planeY = Math.min(point.y, 1.2);
    const d: DragState = {
      kind,
      id: it.id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      started: false,
      grabOffset: new THREE.Vector3(pose.x - point.x, 0, pose.z - point.z),
      planeY,
      startRot: it.rotation,
      startAngle: 0,
      shift: e.shiftKey,
    };
    if (def.placement === 'wall' && it.wall) {
      const wc = wallCoords(it)!;
      const wp = worldToWall(WALLS[it.wall], point.x, point.z);
      d.wallGrab = { du: wc.u - wp.u, dy: it.position[1] - point.y };
    }
    if (kind === 'rotate') {
      d.planeY = pose.y;
      d.startAngle = Math.atan2(this.camera.position.x - pose.x, this.camera.position.z - pose.z);
      const p = this.planePoint(pose.y);
      if (p) d.startAngle = Math.atan2(p.x - pose.x, p.z - pose.z);
      this.overlays.rotating = true;
    }
    if (def.placement === 'surface' && kind === 'move') {
      d.grabOffset.set(0, 0, 0);
    }
    this.drag = d;
  }

  private planePoint(y: number): THREE.Vector3 | null {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
    const out = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(plane, out);
  }

  private wallPoint(): { wall: WallId; u: number; y: number } | null {
    let best: { wall: WallId; u: number; y: number; t: number } | null = null;
    const ray = this.raycaster.ray;
    for (const id of WALL_IDS) {
      const w = WALLS[id];
      const n = new THREE.Vector3(w.normal[0], 0, w.normal[1]);
      const denom = ray.direction.dot(n);
      if (denom >= -1e-4) continue; // only hit walls from the room side
      const p0 = new THREE.Vector3(w.origin[0], 0, w.origin[1]);
      const t = p0.sub(ray.origin).dot(n) / denom;
      if (t <= 0) continue;
      const p = ray.origin.clone().addScaledVector(ray.direction, t);
      const { u } = worldToWall(w, p.x, p.z);
      if (u < -0.3 || u > w.length + 0.3 || p.y < -0.2 || p.y > ROOM.height + 0.4) continue;
      if (!best || t < best.t) best = { wall: id, u, y: p.y, t };
    }
    return best;
  }

  /** Compute a candidate placement for the dragged item under the pointer. */
  private candidate(doc: DesignDoc, it: ItemInstance, d: DragState, free: boolean): PlacementResult | null {
    const def = getDef(it.type);
    const mode = free ? 'off' : useStore.getState().ui.snap;
    const prevItem = d.last ?? it;
    if (def.placement === 'wall') {
      const wp = this.wallPoint();
      if (!wp) return null;
      const g = d.wallGrab ?? { du: 0, dy: 0 };
      const prevWc = wallCoords(prevItem);
      return placeOnWall(doc, it, { wall: wp.wall, u: wp.u + (prevItem.wall === wp.wall ? g.du : 0), y: wp.y + g.dy, prev: prevWc && prevItem.wall ? { wall: prevItem.wall, u: prevWc.u, y: prevWc.y } : undefined }, mode);
    }
    if (def.placement === 'surface') {
      const exclude = descendants(doc, it.id);
      exclude.add(it.id);
      const objs = this.items.pickables(exclude);
      const hits = this.raycaster.intersectObjects(objs, false);
      const prevPose = worldPose(doc, prevItem);
      for (const h of hits) {
        const pid = h.object.userData.itemId as string;
        const parent = findItem(doc, pid);
        if (!parent || parent.parentId) continue;
        const idx = surfaceAt(doc, parent, h.point.x, h.point.y, h.point.z);
        if (idx < 0) continue;
        const parentPose = worldPose(doc, parent);
        const localRot = prevItem.parentId === parent.id ? prevItem.rotation : prevPose.rot - parentPose.rot;
        return placeOnSurface(doc, it, { parentId: parent.id, surface: idx, x: h.point.x, z: h.point.z, rot: localRot, prev: prevItem.parentId === parent.id ? prevItem : undefined }, mode);
      }
      const p = this.planePoint(0);
      if (!p) return null;
      return placeOnFloor(doc, it, { x: p.x, z: p.z, rot: prevPose.rot, prev: prevItem.parentId ? undefined : [prevItem.position[0], prevItem.position[2]] }, mode);
    }
    const p = this.planePoint(d.planeY);
    if (!p) return null;
    const x = p.x + d.grabOffset.x;
    const z = p.z + d.grabOffset.z;
    return placeOnFloor(doc, it, { x, z, rot: prevItem.rotation, prev: [prevItem.position[0], prevItem.position[2]], autoOrient: d.kind === 'place' }, mode);
  }

  private onMove = (e: PointerEvent) => {
    const d = this.drag;
    if (!d) {
      if (!this.enabled || e.buttons) return;
      if ((e.target as HTMLElement) !== this.dom) {
        useStore.getState().hover(null);
        return;
      }
      this.setPointer(e.clientX, e.clientY);
      const st = useStore.getState();
      if (st.camera.mode === 'cinematic') return;
      const onHandle = this.hitHandle();
      const hit = onHandle ? null : this.hitItem();
      st.hover(hit?.id ?? null);
      this.dom.style.cursor = onHandle ? 'grab' : hit ? (findItem(st.doc, hit.id)?.locked ? 'pointer' : 'move') : '';
      return;
    }
    if (e.pointerId !== d.pointerId && d.kind !== 'place') return;
    if (!d.started) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 4 && d.kind !== 'place') return;
      d.started = true;
      const st = useStore.getState();
      const it = findItem(st.doc, d.id);
      if (!it) return;
      if (d.kind !== 'place') st.beginGesture(`${d.kind === 'rotate' ? 'Girar' : 'Mover'} ${getDef(it.type).name}`);
      st.hover(null);
      this.dom.style.cursor = 'grabbing';
    }
    this.setPointer(e.clientX, e.clientY);
    const st = useStore.getState();
    const doc = st.doc;
    const it = findItem(doc, d.id);
    if (!it) return;
    const free = e.shiftKey;
    let next: ItemInstance | null = null;
    let valid = true;
    if (d.kind === 'rotate') {
      const pose = worldPose(doc, it);
      const p = this.planePoint(d.planeY);
      if (!p) return;
      const a = Math.atan2(p.x - pose.x, p.z - pose.z);
      const parentRot = pose.rot - it.rotation;
      const target = snapRotation(d.startRot + (a - d.startAngle), free) ;
      const r = rotateItem(doc, it, target);
      void parentRot;
      if (r) next = r;
      this.guides = [];
    } else {
      const res = this.candidate(doc, it, d, free);
      if (!res) return;
      next = res.item;
      valid = res.valid;
      this.guides = res.guides;
    }
    if (next) {
      d.last = next;
      const items = doc.items.map((i) => (i.id === d.id ? next! : i));
      st.preview({ ...doc, items });
      st.setInvalid(!valid);
    }
  };

  private onUp = (e: PointerEvent) => {
    const d = this.drag;
    if (d) {
      if (e.pointerId !== d.pointerId && d.kind !== 'place') return;
      const st = useStore.getState();
      if (d.kind === 'place') {
        const r = this.dom.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (!inside || st.invalid || !d.started) {
          st.cancelGesture();
          if (!inside) st.select(null);
        } else {
          st.endGesture();
          st.select({ kind: 'item', id: d.id });
          st.toast(`${getDef(findItem(st.doc, d.id)!.type).name} añadido`);
        }
      } else if (d.started) {
        if (st.invalid) st.cancelGesture();
        else st.endGesture();
      }
      st.setInvalid(false);
      this.drag = null;
      this.guides = [];
      this.overlays.rotating = false;
      this.dom.style.cursor = '';
      this.rig.controls.enabled = st.camera.mode === 'orbit' || st.camera.mode === 'plan';
      return;
    }
    const pc = this.pendingSurfaceClick;
    this.pendingSurfaceClick = null;
    if (pc && Math.hypot(e.clientX - pc.x, e.clientY - pc.y) < 4 && e.target === this.dom) {
      const st = useStore.getState();
      const t = pc.target as THREE.Object3D;
      const surface = t.userData?.surface as string | undefined;
      if (surface === 'wall') st.select({ kind: 'wall', wall: t.userData.wall });
      else if (surface === 'floor') st.select({ kind: 'floor' });
      else if (surface === 'ceiling') st.select({ kind: 'ceiling' });
      else st.select(null);
    }
  };

  private onDblClick = (e: MouseEvent) => {
    const st = useStore.getState();
    if (st.camera.mode === 'cinematic') return;
    this.setPointer(e.clientX, e.clientY);
    const hit = this.hitItem();
    if (hit) {
      const b = this.items.boundsOf(hit.id);
      if (b) this.rig.focus(b);
    }
  };

  /** Begin dragging a new item from the library onto the canvas. */
  startPlacement(type: string, e: PointerEvent) {
    const st = useStore.getState();
    const def = getDef(type);
    st.beginGesture(`Añadir ${def.name}`);
    const base: ItemInstance = {
      id: `${type.split('-')[0]}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
      type,
      position: [0, def.placement === 'ceiling' ? ROOM.height : 0, 0],
      rotation: 0,
      materials: Object.fromEntries(def.slots.map((s) => [s.id, s.default])),
      variant: def.placement === 'rug' && def.variants.length > 1 ? 1 : 0,
      wall: def.placement === 'wall' ? 'north' : undefined,
    };
    // Start parked out of sight; the first pointer move positions it.
    const parked: ItemInstance = { ...base, position: [0, -50, 0] };
    st.preview({ ...st.doc, items: [...st.doc.items, parked] });
    st.select({ kind: 'item', id: base.id });
    this.drag = {
      kind: 'place',
      id: base.id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      started: false,
      grabOffset: new THREE.Vector3(),
      planeY: def.placement === 'ceiling' ? ROOM.height : 0,
      startRot: 0,
      startAngle: 0,
      last: { ...base, position: [0, base.position[1], 0] },
      shift: false,
    };
    this.rig.controls.enabled = false;
  }

  /** Floor point at the centre of the view (for click-to-add). */
  viewCenter(): { x: number; z: number; walls: WallId[] } {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const p = this.planePoint(0);
    const cam = this.camera.position;
    // walls most directly facing the camera first
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const walls = [...WALL_IDS]
      .filter((id) => !this.shell.isCut(id))
      .sort((a, b) => {
        const na = WALLS[a].normal;
        const nb = WALLS[b].normal;
        return na[0] * dir.x + na[1] * dir.z - (nb[0] * dir.x + nb[1] * dir.z);
      });
    if (!p) return { x: 0, z: 0, walls };
    void cam;
    return { x: THREE.MathUtils.clamp(p.x, -3, 3), z: THREE.MathUtils.clamp(p.z, -2.3, 2.3), walls };
  }

  dispose() {
    this.dom.removeEventListener('pointerdown', this.onDown, { capture: true });
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.dom.removeEventListener('dblclick', this.onDblClick);
  }
}
