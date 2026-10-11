import * as THREE from 'three';
import { getDef, itemSize } from '../core/catalog';
import { worldPose } from '../core/placement';
import type { DesignDoc, ItemInstance } from '../core/types';
import { buildItem } from './builders';
import { kelvinToRGB } from './Lighting';
import type { MaterialLibrary } from './MaterialLibrary';

// Keeps the three.js scene in sync with the design document. Models are only
// rebuilt when their type, size or materials change; moves are transforms.

interface Entry {
  item: ItemInstance;
  key: string;
  root: THREE.Group;
  model: THREE.Group;
  glow: THREE.MeshStandardMaterial[];
  light?: THREE.PointLight | THREE.SpotLight;
  baseIntensity: number;
}

function buildKey(it: ItemInstance): string {
  return `${it.type}|${it.variant ?? 0}|${JSON.stringify(it.materials)}`;
}

export class ItemLayer {
  readonly group = new THREE.Group();
  private entries = new Map<string, Entry>();
  private lampFactor = 0;
  onChange?: () => void;

  constructor(private lib: MaterialLibrary) {
    this.group.name = 'items';
  }

  sync(doc: DesignDoc) {
    const seen = new Set<string>();
    let changed = false;
    for (const it of doc.items) {
      seen.add(it.id);
      let e = this.entries.get(it.id);
      const key = buildKey(it);
      if (!e || e.key !== key) {
        if (e) this.disposeEntry(e);
        e = this.create(it, key);
        this.entries.set(it.id, e);
        changed = true;
      }
      e.item = it;
      const pose = worldPose(doc, it);
      const p = e.root.position;
      if (p.x !== pose.x || p.y !== pose.y || p.z !== pose.z || e.root.rotation.y !== pose.rot) changed = true;
      e.root.position.set(pose.x, pose.y, pose.z);
      e.root.rotation.set(0, pose.rot, 0);
      this.applyLamp(e);
    }
    for (const [id, e] of this.entries) {
      if (!seen.has(id)) {
        this.disposeEntry(e);
        this.entries.delete(id);
        changed = true;
      }
    }
    if (changed) this.onChange?.();
  }

  private create(it: ItemInstance, key: string): Entry {
    const def = getDef(it.type);
    const built = buildItem(this.lib, it);
    const root = new THREE.Group();
    root.name = `item:${it.id}`;
    root.userData.itemId = it.id;
    built.object.traverse((o) => {
      o.userData.itemId = it.id;
    });
    root.add(built.object);
    let light: Entry['light'];
    let baseIntensity = 0;
    if (def.light) {
      const spec = def.light(itemSize(it.type, it.variant));
      const color = kelvinToRGB(spec.temperature);
      if (spec.kind === 'spot') {
        const s = new THREE.SpotLight(color, 0, spec.distance, spec.angle ?? 0.8, 0.65, 2);
        s.position.set(...spec.pos);
        const tgt = new THREE.Object3D();
        tgt.position.set(...(spec.target ?? [spec.pos[0], 0, spec.pos[2]]));
        root.add(tgt);
        s.target = tgt;
        light = s;
      } else {
        const pl = new THREE.PointLight(color, 0, spec.distance, 2);
        pl.position.set(...spec.pos);
        light = pl;
      }
      light.castShadow = false;
      light.userData.isLamp = true;
      baseIntensity = spec.intensity;
      root.add(light);
    }
    this.group.add(root);
    return { item: it, key, root, model: built.object, glow: built.glowMaterials, light, baseIntensity };
  }

  private disposeEntry(e: Entry) {
    this.group.remove(e.root);
    e.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        const mat = m.material as THREE.Material;
        if (mat.userData?.unique) mat.dispose();
      }
    });
    e.light?.dispose();
  }

  /** Hide pieces hanging on cut-away walls (and whatever rests on them). */
  setCutWalls(cut: Set<string>) {
    for (const e of this.entries.values()) {
      let wall = e.item.wall;
      if (!wall && e.item.parentId) wall = this.entries.get(e.item.parentId)?.item.wall;
      const visible = !wall || !cut.has(wall);
      if (e.root.visible !== visible) e.root.visible = visible;
    }
  }

  setLampFactor(f: number) {
    if (Math.abs(f - this.lampFactor) < 1e-3) return;
    this.lampFactor = f;
    for (const e of this.entries.values()) this.applyLamp(e);
  }

  private applyLamp(e: Entry) {
    const dim = e.item.dimmer ?? 1;
    const f = this.lampFactor * dim;
    if (e.light) {
      e.light.intensity = e.baseIntensity * f;
      e.light.visible = f > 0.001;
    }
    for (const m of e.glow) {
      const base = (m.userData.glowBase as number) ?? 1;
      const isBulb = m.name === 'fx-bulb';
      m.emissiveIntensity = f * (isBulb ? 9 : 2.6 * base);
    }
  }

  meshesFor(id: string): THREE.Object3D[] {
    const e = this.entries.get(id);
    if (!e) return [];
    const out: THREE.Object3D[] = [];
    e.model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) out.push(o);
    });
    return out;
  }

  /** All meshes for picking (optionally excluding some item ids). */
  pickables(exclude?: Set<string>): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const [id, e] of this.entries) {
      if (exclude?.has(id) || !e.root.visible) continue;
      e.model.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) out.push(o);
      });
    }
    return out;
  }

  boundsOf(id: string): THREE.Box3 | null {
    const e = this.entries.get(id);
    if (!e) return null;
    return new THREE.Box3().setFromObject(e.model);
  }
}
