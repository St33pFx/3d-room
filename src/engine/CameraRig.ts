import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { HALF_D, HALF_W, ROOM } from '../core/room';
import type { CameraMode } from '../core/types';

// Camera modes and transitions:
//  orbit     – dollhouse view, walls facing the camera are cut away
//  plan      – near-orthographic top view for layout work
//  walk      – eye-level first person (drag to look, WASD to move)
//  cinematic – authored, slowly moving shots with letterboxing

export interface Shot {
  name: string;
  from: { pos: THREE.Vector3; target: THREE.Vector3; fov: number };
  to: { pos: THREE.Vector3; target: THREE.Vector3; fov: number };
  duration: number;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const SHOTS: Shot[] = [
  {
    name: 'Bienvenida',
    from: { pos: v(3.1, 1.75, 2.55), target: v(-1.4, 0.95, -1.6), fov: 46 },
    to: { pos: v(2.2, 1.6, 2.6), target: v(-1.8, 0.9, -1.4), fov: 44 },
    duration: 9,
  },
  {
    name: 'Luz de la ventana',
    from: { pos: v(0.6, 1.05, -1.9), target: v(-2.6, 0.7, -0.4), fov: 50 },
    to: { pos: v(0.9, 1.15, -1.3), target: v(-2.4, 0.6, -0.8), fov: 46 },
    duration: 8,
  },
  {
    name: 'Rincón de lectura',
    from: { pos: v(-0.4, 1.35, 1.6), target: v(-3.0, 0.9, 0.4), fov: 42 },
    to: { pos: v(-0.9, 1.25, 1.9), target: v(-3.1, 1.0, 0.7), fov: 40 },
    duration: 8,
  },
  {
    name: 'Mesa del comedor',
    from: { pos: v(0.2, 1.45, 1.8), target: v(2.1, 0.8, -0.9), fov: 40 },
    to: { pos: v(0.6, 1.3, 1.25), target: v(2.0, 0.85, -0.95), fov: 36 },
    duration: 8,
  },
  {
    name: 'Detalle bajo',
    from: { pos: v(-0.2, 0.55, -0.15), target: v(-1.5, 0.35, -1.25), fov: 34 },
    to: { pos: v(-0.55, 0.5, 0.05), target: v(-1.45, 0.38, -1.2), fov: 32 },
    duration: 7,
  },
  {
    name: 'Cenital',
    from: { pos: v(0.4, 9.5, 2.4), target: v(0, 0, -0.1), fov: 40 },
    to: { pos: v(-0.4, 8.6, 1.8), target: v(0, 0, -0.1), fov: 40 },
    duration: 8,
  },
];

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeSoft = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2;

interface Transition {
  fromPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  fromFov: number;
  toPos: THREE.Vector3;
  toTarget: THREE.Vector3;
  toFov: number;
  t: number;
  duration: number;
  done?: () => void;
}

export const ORBIT_HOME = { pos: v(2.6, 6.4, 9.6), target: v(-0.05, 0.6, -0.5), fov: 36 };
const PLAN_HOME = { pos: v(0, 17.5, 0.001), target: v(0, 0, 0), fov: 30 };

export class CameraRig {
  readonly controls: OrbitControls;
  mode: CameraMode = 'orbit';
  private transition: Transition | null = null;
  private shotIndex = 0;
  private shotT = 0;
  tour = false;
  onShotChange?: (index: number) => void;
  // walk state
  private yaw = 0;
  private pitch = 0;
  private keys = new Set<string>();
  private walkVel = new THREE.Vector3();
  private looking = false;
  private lastPointer = { x: 0, y: 0 };
  private savedOrbit = { pos: ORBIT_HOME.pos.clone(), target: ORBIT_HOME.target.clone() };
  /** collision test for walk mode: returns corrected XZ */
  collide?: (x: number, z: number) => [number, number];
  /** True while an item drag owns the pointer. */
  blocked = () => false;

  constructor(
    public camera: THREE.PerspectiveCamera,
    private dom: HTMLElement,
  ) {
    this.controls = new OrbitControls(camera, dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.6;
    this.controls.zoomSpeed = 0.9;
    this.controls.screenSpacePanning = true;
    this.applyOrbitLimits();
    camera.position.copy(ORBIT_HOME.pos);
    camera.fov = ORBIT_HOME.fov;
    this.controls.target.copy(ORBIT_HOME.target);
    camera.updateProjectionMatrix();
    this.controls.update();

    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => this.keys.clear());
  }

  private applyOrbitLimits() {
    const c = this.controls;
    c.enableRotate = true;
    c.minDistance = 1.2;
    c.maxDistance = 24;
    c.minPolarAngle = 0.05;
    c.maxPolarAngle = Math.PI * 0.49;
    c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  }

  setMode(mode: CameraMode, opts: { shot?: number; instant?: boolean } = {}) {
    const prev = this.mode;
    if (prev === 'orbit' && mode !== 'orbit' && !this.transition) {
      this.savedOrbit = { pos: this.camera.position.clone(), target: this.controls.target.clone() };
    }
    this.mode = mode;
    this.keys.clear();
    const c = this.controls;
    if (mode === 'orbit') {
      this.applyOrbitLimits();
      c.enabled = true;
      const pos = prev === 'orbit' ? ORBIT_HOME.pos : this.savedOrbit.pos;
      const target = prev === 'orbit' ? ORBIT_HOME.target : this.savedOrbit.target;
      this.flyTo(pos, target, ORBIT_HOME.fov, opts.instant ? 0 : 1.3);
    } else if (mode === 'plan') {
      c.enabled = true;
      c.enableRotate = false;
      c.minDistance = 4;
      c.maxDistance = 30;
      c.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
      c.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
      this.flyTo(PLAN_HOME.pos, PLAN_HOME.target, PLAN_HOME.fov, opts.instant ? 0 : 1.3);
    } else if (mode === 'walk') {
      c.enabled = false;
      // stand near the front of the room looking in
      const pos = v(1.2, 1.62, 2.1);
      const target = v(-1.2, 1.2, -1.6);
      this.flyTo(pos, target, 62, opts.instant ? 0 : 1.4, () => this.syncYawPitch());
    } else if (mode === 'cinematic') {
      c.enabled = false;
      this.playShot(opts.shot ?? 0, !opts.instant);
    }
  }

  /** Jump into a cinematic shot (with a smooth fly-in when blend is set). */
  playShot(i: number, blend = true) {
    this.shotIndex = ((i % SHOTS.length) + SHOTS.length) % SHOTS.length;
    this.shotT = 0;
    const s = SHOTS[this.shotIndex];
    if (blend) {
      this.flyTo(s.from.pos, s.from.target, s.from.fov, 1.4);
    } else {
      this.transition = null;
      this.camera.position.copy(s.from.pos);
      this.controls.target.copy(s.from.target);
      this.camera.fov = s.from.fov;
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(s.from.target);
    }
    this.onShotChange?.(this.shotIndex);
  }

  get currentShot(): number {
    return this.shotIndex;
  }

  flyTo(pos: THREE.Vector3, target: THREE.Vector3, fov: number, duration = 1.2, done?: () => void) {
    if (duration <= 0) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(target);
      this.transition = null;
      done?.();
      return;
    }
    this.transition = {
      fromPos: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      fromFov: this.camera.fov,
      toPos: pos.clone(),
      toTarget: target.clone(),
      toFov: fov,
      t: 0,
      duration,
      done,
    };
  }

  /** Frame an object (bounding box) from the current viewing direction. */
  focus(box: THREE.Box3) {
    if (this.mode === 'cinematic') return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    if (this.mode === 'plan') dir.set(0, 1, 0.0001);
    const dist = Math.max(1.6, size * 1.6) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 0.5;
    if (this.mode === 'walk') {
      const eye = this.camera.position.clone();
      this.flyTo(eye, center, this.camera.fov, 0.6, () => this.syncYawPitch());
      return;
    }
    this.flyTo(center.clone().addScaledVector(dir, dist), center, this.camera.fov, 0.8);
  }

  syncYawPitch() {
    const d = new THREE.Vector3();
    this.camera.getWorldDirection(d);
    this.yaw = Math.atan2(-d.x, -d.z);
    this.pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
  }

  update(dt: number) {
    const tr = this.transition;
    if (tr) {
      tr.t = Math.min(1, tr.t + dt / tr.duration);
      const k = ease(tr.t);
      // arc slightly upward between distant points for a graceful move
      const pos = tr.fromPos.clone().lerp(tr.toPos, k);
      const lift = Math.sin(Math.PI * k) * Math.min(1.5, tr.fromPos.distanceTo(tr.toPos) * 0.12);
      pos.y += lift;
      this.camera.position.copy(pos);
      this.controls.target.copy(tr.fromTarget.clone().lerp(tr.toTarget, k));
      this.camera.fov = THREE.MathUtils.lerp(tr.fromFov, tr.toFov, k);
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(this.controls.target);
      if (tr.t >= 1) {
        this.transition = null;
        tr.done?.();
        if (this.mode === 'orbit' || this.mode === 'plan') this.controls.update();
      }
      return;
    }
    if (this.mode === 'orbit' || this.mode === 'plan') {
      this.controls.update();
      // keep the orbit target inside the room
      const t = this.controls.target;
      t.x = THREE.MathUtils.clamp(t.x, -HALF_W - 1, HALF_W + 1);
      t.z = THREE.MathUtils.clamp(t.z, -HALF_D - 1, HALF_D + 1);
      t.y = THREE.MathUtils.clamp(t.y, 0, ROOM.height);
    } else if (this.mode === 'walk') {
      this.updateWalk(dt);
    } else if (this.mode === 'cinematic') {
      const s = SHOTS[this.shotIndex];
      this.shotT = Math.min(1, this.shotT + dt / s.duration);
      const k = easeSoft(this.shotT);
      this.camera.position.copy(s.from.pos).lerp(s.to.pos, k);
      const target = s.from.target.clone().lerp(s.to.target, k);
      this.controls.target.copy(target);
      this.camera.fov = THREE.MathUtils.lerp(s.from.fov, s.to.fov, k);
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(target);
      if (this.shotT >= 1 && this.tour) this.playShot(this.shotIndex + 1, false);
    }
  }

  private updateWalk(dt: number) {
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const want = new THREE.Vector3();
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) want.add(fwd);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) want.sub(fwd);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) want.add(right);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) want.sub(right);
    if (want.lengthSq() > 0) want.normalize().multiplyScalar(this.keys.has('ShiftLeft') ? 2.6 : 1.5);
    this.walkVel.lerp(want, 1 - Math.exp(-dt * 10));
    const p = this.camera.position;
    let nx = p.x + this.walkVel.x * dt;
    let nz = p.z + this.walkVel.z * dt;
    const r = 0.28;
    nx = THREE.MathUtils.clamp(nx, -HALF_W + r, HALF_W - r);
    nz = THREE.MathUtils.clamp(nz, -HALF_D + r, HALF_D - r);
    if (this.collide) [nx, nz] = this.collide(nx, nz);
    p.set(nx, 1.62 + Math.sin(performance.now() / 160) * 0.006 * Math.min(1, this.walkVel.length()), nz);
    const dir = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    this.controls.target.copy(p).add(dir);
    this.camera.lookAt(this.controls.target);
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.mode !== 'walk' || this.blocked() || e.button !== 0) return;
    this.looking = true;
    this.lastPointer = { x: e.clientX, y: e.clientY };
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.looking) return;
    if (this.blocked()) {
      this.looking = false;
      return;
    }
    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.yaw += dx * 0.0042;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.0036, -1.2, 1.2);
  };

  private onPointerUp = () => {
    this.looking = false;
  };

  private onKey = (e: KeyboardEvent) => {
    if (this.mode !== 'walk') return;
    const t = e.target as HTMLElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (e.ctrlKey || e.metaKey) return;
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  get isTransitioning(): boolean {
    return !!this.transition;
  }

  /** Walk-mode helper so arrow keys can nudge items instead of walking. */
  walkUsesArrows = true;

  dispose() {
    this.controls.dispose();
    this.dom.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
