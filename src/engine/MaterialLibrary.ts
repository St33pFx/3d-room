import * as THREE from 'three';
import { getMaterial, type MaterialDef, type TextureSpec } from '../core/materials';
import { mapsToCanvas, type TextureMaps } from './textures';
import { texturePool } from './texturePool';

// Turns material definitions into shared three.js PBR materials. Textures are
// synthesised lazily on a queue so the UI never blocks for long; materials
// render with their flat base colour until their maps arrive.

interface TextureSet {
  color: THREE.Texture;
  normal?: THREE.Texture;
  rough?: THREE.Texture;
}

function texKey(spec: TextureSpec): string {
  return JSON.stringify([spec.kind, spec.colors, spec.seed, spec.bump, spec.grid]);
}

export class MaterialLibrary {
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private textures = new Map<string, TextureSet>();
  private pending = new Map<string, Promise<void>>();
  private waiting = new Map<string, Set<THREE.MeshStandardMaterial>>();
  private inflight = new Set<Promise<void>>();
  private anisotropy = 8;
  onTextureReady?: () => void;

  setAnisotropy(a: number) {
    this.anisotropy = a;
  }

  /** Shared material for a catalogue id. */
  get(id: string): THREE.MeshStandardMaterial {
    let m = this.materials.get(id);
    if (!m) {
      m = this.create(getMaterial(id));
      this.materials.set(id, m);
    }
    return m;
  }

  /** A private copy (for per-instance emissive control). */
  unique(id: string): THREE.MeshStandardMaterial {
    const base = this.get(id);
    const copy = base.clone() as THREE.MeshStandardMaterial;
    copy.userData = { ...base.userData, unique: true };
    // Keep in sync when textures arrive later.
    const def = getMaterial(id);
    if (def.texture && !this.textures.has(texKey(def.texture))) {
      this.track(def.texture, copy);
    }
    return copy;
  }

  private create(def: MaterialDef): THREE.MeshStandardMaterial {
    const physical = !!(def.sheen || def.clearcoat);
    const params: THREE.MeshPhysicalMaterialParameters = {
      color: new THREE.Color(def.color),
      roughness: def.roughness,
      metalness: def.metalness ?? 0,
      side: def.side === 'double' ? THREE.DoubleSide : THREE.FrontSide,
    };
    let m: THREE.MeshStandardMaterial;
    if (physical) {
      const pm = new THREE.MeshPhysicalMaterial(params);
      if (def.sheen) {
        pm.sheen = def.sheen;
        pm.sheenRoughness = 0.6;
        pm.sheenColor = new THREE.Color(def.sheenColor ?? '#ffffff').multiplyScalar(0.6);
      }
      if (def.clearcoat) {
        pm.clearcoat = def.clearcoat;
        pm.clearcoatRoughness = 0.12;
      }
      m = pm;
    } else {
      m = new THREE.MeshStandardMaterial(params);
    }
    if (def.opacity !== undefined) {
      m.transparent = true;
      m.opacity = def.opacity;
      m.depthWrite = false;
    }
    if (def.emissive) {
      m.emissive = new THREE.Color(def.emissive);
      m.emissiveIntensity = def.emissiveIntensity ?? 0;
    }
    m.envMapIntensity = def.envIntensity ?? 1;
    if (def.vertexColors) m.vertexColors = true;
    m.name = def.id;
    m.userData.def = def;
    if (def.texture) {
      this.track(def.texture, m);
    }
    return m;
  }

  private track(spec: TextureSpec, m: THREE.MeshStandardMaterial) {
    const key = texKey(spec);
    const ready = this.textures.get(key);
    if (ready) {
      this.apply(m, ready, spec);
      return;
    }
    let set = this.waiting.get(key);
    if (!set) {
      set = new Set();
      this.waiting.set(key, set);
    }
    set.add(m);
    this.request(spec);
  }

  private request(spec: TextureSpec): Promise<void> {
    const key = texKey(spec);
    if (this.textures.has(key)) return Promise.resolve();
    let p = this.pending.get(key);
    if (!p) {
      p = texturePool()
        .generate(spec, undefined, true)
        .then((maps) => this.finish(key, spec, maps))
        .finally(() => this.inflight.delete(p!));
      this.inflight.add(p);
      this.pending.set(key, p);
    }
    return p;
  }

  private apply(m: THREE.MeshStandardMaterial, set: TextureSet, spec: TextureSpec) {
    m.map = set.color;
    if (set.normal) {
      m.normalMap = set.normal;
      const s = spec.stretch ? 1 : 1;
      m.normalScale.set(s, s);
    }
    if (set.rough) {
      m.roughnessMap = set.rough;
      // map stores 0.5 for "base roughness"; compensate so the base value holds
      const def = m.userData.def as MaterialDef | undefined;
      m.roughness = Math.min(2, (def?.roughness ?? m.roughness) * (255 / 128));
    }
    // Texture provides the colour variation; keep the tint neutral.
    m.color.set('#ffffff');
    m.needsUpdate = true;
  }

  private build(spec: TextureSpec, maps: TextureMaps): TextureSet {
    const mk = (data: Uint8ClampedArray, srgb: boolean) => {
      const t = new THREE.DataTexture(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), maps.size, maps.size, THREE.RGBAFormat);
      t.flipY = true; // match canvas orientation used by the generators
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = this.anisotropy;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      if (!spec.stretch) t.repeat.set(1 / spec.tile, 1 / spec.tile);
      else t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.generateMipmaps = true;
      t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.needsUpdate = true;
      return t;
    };
    return {
      color: mk(maps.color, true),
      normal: maps.normal ? mk(maps.normal, false) : undefined,
      rough: maps.rough ? mk(maps.rough, false) : undefined,
    };
  }

  private finish(key: string, spec: TextureSpec, maps: TextureMaps) {
    const set = this.build(spec, maps);
    this.textures.set(key, set);
    this.pending.delete(key);
    const mats = this.waiting.get(key);
    if (mats) {
      for (const m of mats) this.apply(m, set, spec);
      this.waiting.delete(key);
    }
    this.onTextureReady?.();
  }

  /** Wait for every requested texture, reporting progress. */
  async flush(onProgress?: (done: number, total: number) => void): Promise<void> {
    let total = this.inflight.size;
    let done = 0;
    while (this.inflight.size) {
      total = Math.max(total, done + this.inflight.size);
      await Promise.race(this.inflight);
      done = total - this.inflight.size;
      onProgress?.(done, total);
    }
  }

  get queued(): number {
    return this.inflight.size;
  }
}

// ── Swatches for the UI ─────────────────────────────────────────────────────

const swatchCache = new Map<string, string>();

/** Small preview image (data URL) for a material, generated off-thread. */
export async function materialSwatch(id: string, size = 72): Promise<string> {
  const key = `${id}:${size}`;
  const hit = swatchCache.get(key);
  if (hit) return hit;
  const def = getMaterial(id);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  if (def.texture) {
    const big = def.category === 'floor' || def.category === 'wall';
    const tsize = def.texture.stretch ? 128 : big ? 256 : 96;
    const maps = await texturePool().generate({ ...def.texture }, tsize, false);
    const tc = mapsToCanvas(maps.color, tsize);
    // show a realistic patch of the material (or the whole artwork/rug)
    const frac = def.texture.stretch ? 1 : Math.min(1, (big ? 0.9 : 0.35) / def.texture.tile);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(tc, 0, 0, tsize * frac, tsize * frac, 0, 0, size, size);
  } else {
    ctx.fillStyle = def.color;
    ctx.fillRect(0, 0, size, size);
  }
  // soft lighting so metals/gloss read differently from matte
  const metal = (def.metalness ?? 0) > 0.5;
  const g = ctx.createLinearGradient(0, 0, size, size);
  const gloss = 1 - def.roughness;
  g.addColorStop(0, `rgba(255,255,255,${0.12 + gloss * (metal ? 0.55 : 0.25)})`);
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1, `rgba(0,0,0,${metal ? 0.35 : 0.12})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  if (def.opacity !== undefined) {
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#d8d4cc';
    ctx.fillRect(0, 0, size, size);
  }
  const url = c.toDataURL('image/png');
  swatchCache.set(key, url);
  return url;
}
