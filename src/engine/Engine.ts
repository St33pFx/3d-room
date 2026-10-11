import * as THREE from 'three';
import { getDef } from '../core/catalog';
import { findItem, footprintAABB, worldPose, boxesAt, obstacles } from '../core/placement';
import { HALF_D, HALF_W } from '../core/room';
import { createPreset } from '../core/presets';
import { overlapMTV } from '../core/geometry';
import type { CameraBookmark, CameraMode, DesignDoc, EnvironmentState } from '../core/types';
import { useStore, type AppState } from '../state/store';
import { CameraRig, ORBIT_HOME } from './CameraRig';
import { Interaction } from './Interaction';
import { ItemLayer } from './ItemLayer';
import { EnvironmentProbe, Lighting } from './Lighting';
import { MaterialLibrary } from './MaterialLibrary';
import { Overlays } from './Overlays';
import { Highlight } from './Highlight';
import { PostFX } from './PostFX';
import { RoomShell } from './RoomShell';
import { Thumbnails } from './Thumbnails';

// The engine owns the renderer and the scene graph and mirrors the store.
// React never touches three.js objects directly; it talks to the store, and
// calls a handful of imperative helpers exposed here.

const params = new URLSearchParams(location.search);

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly lib = new MaterialLibrary();
  readonly shell: RoomShell;
  readonly lighting: Lighting;
  readonly items: ItemLayer;
  readonly overlays = new Overlays();
  readonly highlight = new Highlight();
  readonly rig: CameraRig;
  readonly interaction: Interaction;
  readonly post: PostFX;
  readonly probe: EnvironmentProbe;
  readonly thumbs: Thumbnails;

  private lastTime = performance.now();
  private raf = 0;
  private unsub: (() => void)[] = [];
  private envDirty = 2;
  private lastCapture = 0;
  private frameMs = 16;
  private pixelRatio: number;
  private maxPR: number;
  private lastPRChange = 0;
  private fixedPR = params.has('fixedpr');
  private resizeObs: ResizeObserver;
  private disposed = false;
  private captureEnabled = true;
  frameCount = 0;
  /** Testing hook: stop the render loop (frames can still be forced with settle()). */
  paused = false;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false, depth: true, preserveDrawingBuffer: params.has('preserve') });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.maxPR = Math.min(window.devicePixelRatio || 1, 2);
    this.pixelRatio = this.fixedPR ? Number(params.get('fixedpr')) || this.maxPR : this.maxPR;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.lib.setAnisotropy(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = 'scene-canvas';
    this.renderer.domElement.tabIndex = 0;

    this.camera = new THREE.PerspectiveCamera(36, 1, 0.08, 2500);
    this.camera.layers.enable(1);

    this.shell = new RoomShell(this.lib);
    this.scene.add(this.shell.group);
    this.lighting = new Lighting(this.shell.openings);
    this.scene.add(this.lighting.group);
    this.items = new ItemLayer(this.lib);
    this.scene.add(this.items.group);
    this.scene.fog = new THREE.Fog('#c9d6e3', 22, 85);

    this.rig = new CameraRig(this.camera, this.renderer.domElement);
    this.interaction = new Interaction(this.renderer.domElement, this.camera, this.shell, this.items, this.overlays, this.rig);
    this.rig.blocked = () => this.interaction.busy;
    this.rig.collide = (x, z) => this.walkCollide(x, z);
    this.rig.onShotChange = (i) => {
      if (useStore.getState().camera.shot !== i) useStore.getState().setCamera({ shot: i });
    };

    this.post = new PostFX(this.renderer, this.scene, this.camera);
    this.probe = new EnvironmentProbe(this.renderer);
    this.thumbs = new Thumbnails(this.renderer, this.lib);
    this.lib.onTextureReady = () => {
      this.envDirty = Math.max(this.envDirty, 1);
    };
    this.items.onChange = () => {
      this.envDirty = Math.max(this.envDirty, 1);
    };

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();

    const st = useStore.getState();
    this.applyDoc(st.doc);
    this.applyQuality(st.ui.quality);
    this.unsub.push(useStore.subscribe((s, prev) => this.onState(s, prev)));
  }

  /** Generate the textures needed for the current design, reporting progress. */
  async preload() {
    const set = useStore.getState().setLoading;
    // touch every material used by the presets so their textures are queued
    for (const id of ['casa-luz', 'nogal-noche', 'terracota']) {
      const d = createPreset(id);
      for (const it of d.items) for (const m of Object.values(it.materials)) this.lib.get(m);
      for (const m of [d.finishes.floor, d.finishes.ceiling, d.finishes.trim, d.finishes.frames, ...Object.values(d.finishes.walls)]) this.lib.get(m);
    }
    for (const m of [...RoomShell.EXTERIOR_MATERIALS, 'bark', 'soil']) this.lib.get(m);
    await this.lib.flush((done, total) => set({ done, total, label: 'Tejiendo materiales' }));
    set({ label: 'Encendiendo la luz', done: 1, total: 1 });
    // first frames: settle the bounce lighting with a couple of captures
    this.lighting.update(useStore.getState().env, 0);
    this.captureEnv();
    this.captureEnv();
  }

  start() {
    const loop = () => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      if (!this.paused) this.frame();
    };
    this.lastTime = performance.now();
    loop();
    setTimeout(() => this.thumbs.generateAll(), 600);
  }

  private onState(s: AppState, prev: AppState) {
    if (s.doc !== prev.doc) this.applyDoc(s.doc);
    if (s.env !== prev.env) this.envDirty = Math.max(this.envDirty, 1);
    if (s.camera.mode !== prev.camera.mode) this.setCameraMode(s.camera.mode, s.camera.shot);
    else if (s.camera.mode === 'cinematic' && s.camera.shot !== prev.camera.shot && s.camera.shot !== this.rig.currentShot) this.rig.playShot(s.camera.shot, true);
    if (s.camera.tour !== prev.camera.tour) this.rig.tour = s.camera.tour;
    if (s.ui.quality !== prev.ui.quality) this.applyQuality(s.ui.quality);
    if (s.ui.hidden !== prev.ui.hidden || s.camera.mode !== prev.camera.mode) this.overlaysVisible = !s.ui.hidden && s.camera.mode !== 'cinematic';
  }

  private overlaysVisible = true;

  private applyDoc(doc: DesignDoc) {
    this.shell.setFinishes(doc.finishes);
    this.items.sync(doc);
    this.envDirty = Math.max(this.envDirty, 1);
  }

  private applyQuality(q: 'high' | 'balanced') {
    const high = q === 'high';
    this.post.setQuality(high);
    this.lighting.setShadowQuality(high);
    this.maxPR = Math.min(window.devicePixelRatio || 1, high ? 2 : 1.25);
    if (!this.fixedPR) this.setPixelRatio(this.maxPR);
  }

  private setCameraMode(mode: CameraMode, shot: number) {
    this.rig.setMode(mode, { shot });
    this.rig.tour = useStore.getState().camera.tour;
  }

  private setPixelRatio(pr: number) {
    this.pixelRatio = pr;
    this.renderer.setPixelRatio(pr);
    this.resize();
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.post.setSize(w, h);
    this.overlays.setResolution(w * this.pixelRatio, h * this.pixelRatio);
  }

  private walkCollide(x: number, z: number): [number, number] {
    const doc = useStore.getState().doc;
    const r = 0.22;
    let px = x;
    let pz = z;
    for (const it of doc.items) {
      const def = getDef(it.type);
      if (def.placement === 'rug' || def.placement === 'wall' || def.placement === 'ceiling' || it.parentId) continue;
      for (const b of boxesAt(it, worldPose(doc, it))) {
        if (b.y0 > 1.0) continue;
        const me = { cx: px, cz: pz, hw: r, hd: r, rot: 0, y0: 0, y1: 1.7 };
        const m = overlapMTV(me, b);
        if (m) {
          px += m[0];
          pz += m[1];
        }
      }
    }
    return [px, pz];
  }

  private captureEnv() {
    if (!this.captureEnabled) return;
    // Garden: lit by the sky alone.
    this.lighting.updateSkyEnv(this.renderer);
    for (const id of RoomShell.EXTERIOR_MATERIALS) {
      const m = this.lib.get(id);
      if (m.envMap !== this.lighting.skyEnv) {
        m.envMap = this.lighting.skyEnv;
        m.needsUpdate = true;
      }
      m.envMapIntensity = id === 'ext-lawn' || id === 'ext-foliage' ? 0.45 : 0.22;
    }
    // Interior: bounce light captured from the room itself.
    const prevFog = this.scene.fog;
    this.scene.fog = null;
    this.shell.withAllVisible(() => this.probe.capture(this.scene));
    this.scene.fog = prevFog;
    const st = this.lighting.state;
    this.scene.environmentIntensity = 0.5 + 0.2 * st.daylight;
    this.lastCapture = performance.now();
  }

  private frame() {
    const nowT = performance.now();
    const dt = Math.min(0.1, (nowT - this.lastTime) / 1000);
    this.lastTime = nowT;
    const t0 = performance.now();
    const st = useStore.getState();
    this.frameCount++;

    // time-lapse
    if (st.timelapse) {
      let t = st.env.time + dt * 1.6;
      if (t >= 24) t -= 24;
      st.setEnv({ time: t });
    }

    this.rig.update(dt);
    const mode = this.rig.mode;
    this.shell.updateCutaway(this.camera.position, mode !== 'walk');

    const env = useStore.getState().env;
    this.lighting.update(env, dt);
    const lampF = env.lampMode === 'on' ? 1 : env.lampMode === 'off' ? 0 : this.lighting.state.lampFactor;
    this.items.setLampFactor(lampF);
    this.scene.fog!.color.copy(this.lighting.horizonColor());
    this.post.setExposure(this.lighting.exposureFor(env), 0.55 + this.lighting.state.golden * 0.5 - this.lighting.state.night * 0.4);

    // bounce-light probe
    const now = performance.now();
    // (skip while dragging: bounce light settles once the piece is dropped)
    if (this.envDirty > 0 && !st.gesture && now - this.lastCapture > (st.timelapse ? 260 : 120)) {
      this.captureEnv();
      this.envDirty--;
    }

    this.updateOverlays(st);
    this.post.render(dt);
    if (this.overlaysVisible) {
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.overlays.scene, this.camera);
      this.renderer.autoClear = true;
    }
    this.adaptResolution(performance.now() - t0, dt);
  }

  private updateOverlays(st: AppState) {
    const sel = st.selection?.kind === 'item' ? findItem(st.doc, st.selection.id) : undefined;
    const dist = this.camera.position.distanceTo(this.rig.controls.target);
    if (sel) this.overlays.showSelection(sel, worldPose(st.doc, sel), st.invalid, Math.max(dist, 2));
    else this.overlays.showSelection(null, null, false, dist);
    const hov = st.hovered && st.hovered !== sel?.id ? findItem(st.doc, st.hovered) : undefined;
    this.overlays.showHover(hov ?? null, hov ? worldPose(st.doc, hov) : null);
    this.overlays.showGuides(this.interaction.guides);

    this.updateMeasures(st, sel);

    // rim highlight on the selected / hovered piece
    this.highlight.setSelected(sel ? this.items.meshesFor(sel.id) : [], st.invalid);
    this.highlight.setHovered(hov && !st.gesture ? this.items.meshesFor(hov.id) : []);
    this.highlight.setVisible(this.overlaysVisible);
  }

  private measureEls: HTMLDivElement[] = [];

  /** Live clearances to the nearest walls while a floor piece is being dragged. */
  private updateMeasures(st: AppState, sel: ReturnType<typeof findItem>) {
    const segs: [number, number, number, number, number, number][] = [];
    const labels: { p: THREE.Vector3; text: string }[] = [];
    if (sel && st.gesture && this.overlaysVisible && !sel.parentId) {
      const placement = getDef(sel.type).placement;
      if (placement === 'floor' || placement === 'rug') {
        const pose = worldPose(st.doc, sel);
        const [a, b, c, d] = footprintAABB(sel, pose.x, pose.z, pose.rot);
        const y = 0.03;
        const left = a + HALF_W;
        const right = HALF_W - b;
        const back = c + HALF_D;
        const front = HALF_D - d;
        const zMid = (c + d) / 2;
        const xMid = (a + b) / 2;
        if (left <= right) segs.push([-HALF_W, y, zMid, a, y, zMid]);
        else segs.push([b, y, zMid, HALF_W, y, zMid]);
        if (back <= front) segs.push([xMid, y, -HALF_D, xMid, y, c]);
        else segs.push([xMid, y, d, xMid, y, HALF_D]);
        for (const sg of segs) {
          const len = Math.hypot(sg[3] - sg[0], sg[5] - sg[2]);
          if (len < 0.005) continue;
          labels.push({ p: new THREE.Vector3((sg[0] + sg[3]) / 2, y, (sg[2] + sg[5]) / 2), text: `${Math.round(len * 100)} cm` });
        }
      }
    }
    this.overlays.showMeasures(segs.filter((sg) => Math.hypot(sg[3] - sg[0], sg[5] - sg[2]) > 0.005));
    while (this.measureEls.length < labels.length) {
      const el = document.createElement('div');
      el.className = 'measure-label';
      this.container.appendChild(el);
      this.measureEls.push(el);
    }
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.measureEls.forEach((el, i) => {
      const l = labels[i];
      if (!l) {
        el.style.display = 'none';
        return;
      }
      const p = l.p.clone().project(this.camera);
      el.style.display = p.z < 1 ? 'block' : 'none';
      el.textContent = l.text;
      el.style.transform = `translate(${((p.x + 1) / 2) * rect.width}px, ${((1 - p.y) / 2) * rect.height}px) translate(-50%, -50%)`;
    });
  }

  private adaptResolution(ms: number, dt: number) {
    if (this.fixedPR) return;
    // use wall time per frame (GPU bound frames show up in dt)
    const frame = Math.max(ms, dt * 1000);
    this.frameMs = this.frameMs * 0.92 + frame * 0.08;
    const now = performance.now();
    if (now - this.lastPRChange < 1500) return;
    const minPR = Math.max(0.6, this.maxPR * 0.5);
    if (this.frameMs > 26 && this.pixelRatio > minPR) {
      this.lastPRChange = now;
      this.setPixelRatio(Math.max(minPR, this.pixelRatio - 0.15));
    } else if (this.frameMs < 15 && this.pixelRatio < this.maxPR) {
      this.lastPRChange = now;
      this.setPixelRatio(Math.min(this.maxPR, this.pixelRatio + 0.1));
    }
  }

  // ── Imperative helpers for the UI ─────────────────────────────────────────

  addFromLibrary(type: string) {
    const st = useStore.getState();
    const hint = this.interaction.viewCenter();
    const sel = st.selection?.kind === 'item' ? findItem(st.doc, st.selection.id) : undefined;
    return st.addItem(type, { x: hint.x, z: hint.z, walls: hint.walls, parentId: sel?.parentId ?? sel?.id });
  }

  startPlacement(type: string, e: PointerEvent) {
    this.interaction.startPlacement(type, e);
  }

  /** Screen position (CSS px) above an item for the floating toolbar. */
  anchorFor(id: string): { x: number; y: number; visible: boolean } | null {
    const b = this.items.boundsOf(id);
    if (!b) return null;
    const c = b.getCenter(new THREE.Vector3());
    const p = new THREE.Vector3(c.x, b.max.y, c.z).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    const visible = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height, visible };
  }

  /** Screen position (CSS px) of a world point — used by tests. */
  screenPoint(x: number, y: number, z: number): { x: number; y: number } {
    this.camera.updateMatrixWorld();
    const p = new THREE.Vector3(x, y, z).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }

  /** Screen position of an item's visual centre — used by tests. */
  screenOf(id: string): { x: number; y: number } | null {
    const b = this.items.boundsOf(id);
    if (!b) return null;
    const c = b.getCenter(new THREE.Vector3());
    return this.screenPoint(c.x, c.y, c.z);
  }

  focusSelection() {
    const st = useStore.getState();
    if (st.selection?.kind !== 'item') return;
    const b = this.items.boundsOf(st.selection.id);
    if (b) this.rig.focus(b);
  }

  resetView() {
    if (this.rig.mode === 'orbit') this.rig.flyTo(this.rig.homePos(), ORBIT_HOME.target, this.rig.homeFov(), 1.1);
    else this.rig.setMode(this.rig.mode);
  }

  currentView(name: string): CameraBookmark {
    const p = this.camera.position;
    const t = this.rig.controls.target;
    return { id: `view-${Date.now().toString(36)}`, name, position: [p.x, p.y, p.z], target: [t.x, t.y, t.z], fov: this.camera.fov };
  }

  gotoView(b: CameraBookmark) {
    const st = useStore.getState();
    const inside = Math.abs(b.position[0]) < 3.6 && Math.abs(b.position[2]) < 2.8 && b.position[1] < 2.8;
    const mode: CameraMode = inside ? 'walk' : 'orbit';
    // switching mode starts its own move; the bookmark flight replaces it
    if (st.camera.mode !== mode) st.setCamera({ mode, tour: false });
    this.rig.flyTo(new THREE.Vector3(...b.position), new THREE.Vector3(...b.target), b.fov, 1.2, () => {
      if (mode === 'walk') this.rig.syncYawPitch();
    });
  }

  /** Render a clean, high-resolution still (no overlays/outlines). */
  async screenshot(scale = 2, type = 'image/png'): Promise<Blob | null> {
    const st = useStore.getState();
    const prevPR = this.pixelRatio;
    this.highlight.setVisible(false);
    this.renderer.setPixelRatio(Math.min(4, (window.devicePixelRatio || 1) * scale));
    this.resize();
    this.post.render(0);
    const blob = await new Promise<Blob | null>((res) => this.renderer.domElement.toBlob(res, type, 0.95));
    this.highlight.setVisible(this.overlaysVisible);
    this.renderer.setPixelRatio(prevPR);
    this.resize();
    void st;
    return blob;
  }

  /** Small JPEG of the current view for project cards. */
  thumbnail(width = 360): string {
    this.highlight.setVisible(false);
    this.post.render(0);
    const src = this.renderer.domElement;
    const c = document.createElement('canvas');
    c.width = width;
    c.height = Math.round((width * src.height) / src.width);
    c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
    this.highlight.setVisible(this.overlaysVisible);
    return c.toDataURL('image/jpeg', 0.82);
  }

  /** Testing hook: settle lighting and render a frame synchronously. */
  settle() {
    this.items.sync(useStore.getState().doc);
    this.lighting.update(useStore.getState().env, 0);
    this.rig.update(5);
    this.shell.updateCutaway(this.camera.position, this.rig.mode !== 'walk');
    this.captureEnv();
    this.captureEnv();
    this.frame();
    return this.frameCount;
  }

  envPreview(env: EnvironmentState) {
    this.lighting.update(env, 0);
  }

  /** Debug/testing hook: true when the item intersects nothing. */
  validate(): string[] {
    const doc = useStore.getState().doc;
    return doc.items.filter((it) => getDef(it.type).placement !== 'rug' && boxesAt(it, worldPose(doc, it)).some((b) => obstacles(doc, it, it.parentId).some((o) => overlapMTV(b, o)))).map((i) => i.id);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.unsub.forEach((u) => u());
    this.resizeObs.disconnect();
    this.interaction.dispose();
    this.rig.dispose();
    this.post.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}


let instance: Engine | null = null;
export function setEngine(e: Engine | null) {
  instance = e;
}
export function getEngine(): Engine | null {
  return instance;
}
