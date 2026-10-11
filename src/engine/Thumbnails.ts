import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CATALOG_LIST, defaultMaterials, getDef, type ItemDef } from '../core/catalog';
import { buildItem } from './builders';
import type { MaterialLibrary } from './MaterialLibrary';

// Renders catalogue thumbnails with the real procedural models in a small
// studio setup, so the library always matches what lands in the room.

type Listener = () => void;

export class Thumbnails {
  private cache = new Map<string, string>();
  private listeners = new Set<Listener>();
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  private target: THREE.WebGLRenderTarget;
  private size = 192;
  private running = false;
  private env: THREE.Texture;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private lib: MaterialLibrary,
  ) {
    this.target = new THREE.WebGLRenderTarget(this.size, this.size, { samples: 4, type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace });
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.env;
    this.scene.environmentIntensity = 0.75;
    const key = new THREE.DirectionalLight('#fff4e6', 2.4);
    key.position.set(3, 5, 4);
    key.castShadow = false;
    this.scene.add(key);
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#d9cfc2', 0.6));
  }

  get(type: string): string | undefined {
    return this.cache.get(type);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Generate all thumbnails progressively in idle time. */
  async generateAll() {
    if (this.running) return;
    this.running = true;
    for (const def of CATALOG_LIST) {
      if (this.cache.has(def.type)) continue;
      await idle();
      try {
        await this.render(def);
      } catch (err) {
        console.warn('thumbnail failed', def.type, err);
      }
      this.listeners.forEach((l) => l());
    }
    this.running = false;
  }

  private async render(def: ItemDef) {
    const item = { id: `thumb-${def.type}`, type: def.type, position: [0, 0, 0] as [number, number, number], rotation: 0, materials: defaultMaterials(def.type), variant: def.placement === 'rug' ? 0 : 0 };
    const built = buildItem(this.lib, item);
    await this.lib.flush();
    // lamps glow a little in thumbnails
    for (const m of built.glowMaterials) m.emissiveIntensity = m.name === 'fx-bulb' ? 2 : 0.35;
    const obj = built.object;
    this.scene.add(obj);

    const box = new THREE.Box3().setFromObject(obj);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const center = sphere.center;
    const placement = getDef(def.type).placement;
    let dir: THREE.Vector3;
    if (placement === 'wall') dir = new THREE.Vector3(0.45, 0.1, 1).normalize();
    else if (placement === 'rug') dir = new THREE.Vector3(0.5, 1.4, 1).normalize();
    else if (placement === 'ceiling') dir = new THREE.Vector3(0.7, 0.05, 1).normalize();
    else dir = new THREE.Vector3(0.85, 0.55, 1).normalize();
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const dist = (sphere.radius / Math.sin(fov / 2)) * 0.92;
    this.camera.position.copy(center).addScaledVector(dir, dist);
    this.camera.near = dist / 50;
    this.camera.far = dist * 4;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(center);

    const prevTarget = this.renderer.getRenderTarget();
    const prevTone = this.renderer.toneMapping;
    const prevExposure = this.renderer.toneMappingExposure;
    const prevShadow = this.renderer.shadowMap.enabled;
    const clear = this.renderer.getClearColor(new THREE.Color());
    const clearA = this.renderer.getClearAlpha();
    this.renderer.toneMapping = THREE.AgXToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setRenderTarget(this.target);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    const px = new Uint8Array(this.size * this.size * 4);
    this.renderer.readRenderTargetPixels(this.target, 0, 0, this.size, this.size, px);
    this.renderer.setRenderTarget(prevTarget);
    this.renderer.toneMapping = prevTone;
    this.renderer.toneMappingExposure = prevExposure;
    this.renderer.shadowMap.enabled = prevShadow;
    this.renderer.setClearColor(clear, clearA);

    // flip vertically into a canvas
    const c = document.createElement('canvas');
    c.width = c.height = this.size;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(this.size, this.size);
    const row = this.size * 4;
    for (let y = 0; y < this.size; y++) img.data.set(px.subarray((this.size - 1 - y) * row, (this.size - y) * row), y * row);
    ctx.putImageData(img, 0, 0);
    this.cache.set(def.type, c.toDataURL('image/png'));

    this.scene.remove(obj);
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
  }
}

function idle(): Promise<void> {
  return new Promise((r) => {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
    if (ric) ric(() => r(), { timeout: 120 });
    else setTimeout(r, 16);
  });
}
