import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { colliders, getDef, itemSize } from '../core/catalog';
import { corners, rectToBox } from '../core/geometry';
import type { Guide, Pose } from '../core/placement';
import type { ItemInstance } from '../core/types';

// Editing overlays drawn on top of the beauty pass: footprints, the rotation
// ring, smart guides and the hover hint.

export const ACCENT = new THREE.Color('#ff8f4a');
const INVALID = new THREE.Color('#ff4d5a');
const GUIDE = new THREE.Color('#ff3d8b');

function lineMat(color: THREE.Color, width: number, dashed = false, opacity = 1): LineMaterial {
  const m = new LineMaterial({ color: color.getHex(), linewidth: width, dashed, dashSize: 0.06, gapSize: 0.05, transparent: true, opacity, depthTest: false, depthWrite: false });
  m.worldUnits = false;
  return m;
}

export class Overlays {
  readonly scene = new THREE.Scene();
  private footprint: LineSegments2;
  private hoverPrint: LineSegments2;
  private guides: LineSegments2;
  private measures: LineSegments2;
  private ring: THREE.Mesh;
  private ringTicks: THREE.LineSegments;
  readonly handle: THREE.Mesh;
  private handleHalo: THREE.Mesh;
  private mats: LineMaterial[] = [];
  private fpMat: LineMaterial;
  private ringMat: THREE.MeshBasicMaterial;
  private handleMat: THREE.MeshBasicMaterial;
  rotating = false;

  constructor() {
    this.fpMat = lineMat(ACCENT, 2.2);
    const hoverMat = lineMat(new THREE.Color('#ffffff'), 1.4, false, 0.75);
    const guideMat = lineMat(GUIDE, 1.6, true);
    const measureMat = lineMat(new THREE.Color('#2a2622'), 1.2, true, 0.75);
    this.mats.push(this.fpMat, hoverMat, guideMat, measureMat);
    this.measures = new LineSegments2(new LineSegmentsGeometry(), measureMat);
    this.footprint = new LineSegments2(new LineSegmentsGeometry(), this.fpMat);
    this.hoverPrint = new LineSegments2(new LineSegmentsGeometry(), hoverMat);
    this.guides = new LineSegments2(new LineSegmentsGeometry(), guideMat);
    for (const l of [this.footprint, this.hoverPrint, this.guides, this.measures]) {
      l.renderOrder = 10;
      l.frustumCulled = false;
      l.visible = false;
      this.scene.add(l);
    }

    this.ringMat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 128).rotateX(-Math.PI / 2), this.ringMat);
    this.ring.renderOrder = 9;
    this.ring.visible = false;
    this.scene.add(this.ring);

    // 15° ticks shown while rotating
    const tickPos: number[] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r0 = i % 6 === 0 ? 0.9 : 0.94;
      tickPos.push(Math.sin(a) * r0, 0, Math.cos(a) * r0, Math.sin(a), 0, Math.cos(a));
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(tickPos, 3));
    this.ringTicks = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.8, depthTest: false }));
    this.ringTicks.visible = false;
    this.ringTicks.renderOrder = 9;
    this.scene.add(this.ringTicks);

    this.handleMat = new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false, depthWrite: false });
    this.handle = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), this.handleMat);
    this.handle.renderOrder = 12;
    this.handle.visible = false;
    this.handle.name = 'rotate-handle';
    this.handleHalo = new THREE.Mesh(
      new THREE.RingGeometry(1, 1.45, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: ACCENT, depthTest: false, depthWrite: false }),
    );
    this.handleHalo.renderOrder = 11;
    this.handle.add(this.handleHalo);
    // curved arrows icon on the handle
    const arrow = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.58, 24, 1, 0.5, Math.PI * 1.4).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: ACCENT, depthTest: false, depthWrite: false, side: THREE.DoubleSide }),
    );
    arrow.position.y = 0.001;
    arrow.renderOrder = 13;
    this.handle.add(arrow);
    this.scene.add(this.handle);
  }

  setResolution(w: number, h: number) {
    for (const m of this.mats) m.resolution.set(w, h);
  }

  private outline(item: ItemInstance, pose: Pose): number[] {
    const def = getDef(item.type);
    const [w, h] = itemSize(item.type, item.variant);
    const pts: number[] = [];
    if (def.placement === 'wall') {
      // rectangle in the wall plane
      const c = Math.cos(pose.rot);
      const s = Math.sin(pose.rot);
      const ax = [c, -s];
      const off = 0.02;
      const nx = s * off;
      const nz = c * off;
      const p = (u: number, v: number): [number, number, number] => [pose.x + ax[0] * u + nx, pose.y + v, pose.z + ax[1] * u + nz];
      const q = [p(-w / 2, -h / 2), p(w / 2, -h / 2), p(w / 2, h / 2), p(-w / 2, h / 2)];
      for (let i = 0; i < 4; i++) pts.push(...q[i], ...q[(i + 1) % 4]);
      return pts;
    }
    const y = def.placement === 'ceiling' ? pose.y - 0.01 : pose.y + 0.012;
    for (const col of colliders(item.type, item.variant)) {
      if (def.placement !== 'ceiling' && (col.y0 ?? 0) > 0.3) continue;
      const b = rectToBox(col, pose.x, pose.z, pose.rot, 0, 1);
      const cs = corners(b);
      for (let i = 0; i < 4; i++) pts.push(cs[i][0], y, cs[i][1], cs[(i + 1) % 4][0], y, cs[(i + 1) % 4][1]);
    }
    return pts;
  }

  showSelection(item: ItemInstance | null, pose: Pose | null, invalid: boolean, cameraDist: number) {
    if (!item || !pose) {
      this.footprint.visible = false;
      this.ring.visible = false;
      this.handle.visible = false;
      this.ringTicks.visible = false;
      return;
    }
    const pts = this.outline(item, pose);
    (this.footprint.geometry as LineSegmentsGeometry).setPositions(pts);
    this.footprint.computeLineDistances();
    this.footprint.visible = true;
    this.fpMat.color.copy(invalid ? INVALID : ACCENT);

    const def = getDef(item.type);
    const canRotate = def.placement !== 'wall' && !item.locked;
    this.ring.visible = canRotate;
    this.handle.visible = canRotate;
    this.ringTicks.visible = canRotate && this.rotating;
    if (!canRotate) return;
    const [w, , d] = itemSize(item.type, item.variant);
    const r = Math.max(w, d) / 2 + 0.22;
    const y = def.placement === 'ceiling' ? pose.y - itemSize(item.type, item.variant)[1] - 0.02 : pose.y + 0.015;
    this.ring.position.set(pose.x, y, pose.z);
    this.ring.scale.setScalar(r);
    this.ringTicks.position.copy(this.ring.position);
    this.ringTicks.scale.setScalar(r);
    this.ringMat.opacity = this.rotating ? 0.9 : 0.5;
    // handle sits on the ring in front of the item
    const hs = THREE.MathUtils.clamp(cameraDist * 0.016, 0.06, 0.2);
    this.handle.scale.setScalar(hs);
    this.handle.position.set(pose.x + Math.sin(pose.rot) * r, y + 0.002, pose.z + Math.cos(pose.rot) * r);
    this.handle.rotation.y = pose.rot;
  }

  showHover(item: ItemInstance | null, pose: Pose | null) {
    if (!item || !pose) {
      this.hoverPrint.visible = false;
      return;
    }
    (this.hoverPrint.geometry as LineSegmentsGeometry).setPositions(this.outline(item, pose));
    this.hoverPrint.visible = true;
  }

  showGuides(guides: Guide[]) {
    if (!guides.length) {
      this.guides.visible = false;
      return;
    }
    const pts: number[] = [];
    for (const g of guides) pts.push(...g.a, ...g.b);
    (this.guides.geometry as LineSegmentsGeometry).setPositions(pts);
    this.guides.computeLineDistances();
    this.guides.visible = true;
  }

  /** Dimension lines (world segments); labels are drawn by the caller. */
  showMeasures(segs: [number, number, number, number, number, number][]) {
    if (!segs.length) {
      this.measures.visible = false;
      return;
    }
    (this.measures.geometry as LineSegmentsGeometry).setPositions(segs.flat());
    this.measures.computeLineDistances();
    this.measures.visible = true;
  }

}
