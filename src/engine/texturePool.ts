import type { TextureSpec } from '../core/materials';
import { generateTexture, type TextureMaps } from './textures';

// A small pool of workers generating procedural textures in parallel. Falls
// back to the main thread where workers aren't available.

type Pending = { resolve: (m: TextureMaps) => void; reject: (e: unknown) => void };

class TexturePool {
  private workers: Worker[] = [];
  private busy: number[] = [];
  private queue: { id: number; msg: unknown }[] = [];
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private failed = false;

  constructor() {
    if (typeof Worker === 'undefined') {
      this.failed = true;
      return;
    }
    const n = Math.max(2, Math.min(6, (navigator.hardwareConcurrency || 4) - 1));
    try {
      for (let i = 0; i < n; i++) {
        const w = new Worker(new URL('./textures.worker.ts', import.meta.url), { type: 'module' });
        w.onmessage = (e: MessageEvent<{ id: number; maps: TextureMaps }>) => this.done(i, e.data.id, e.data.maps);
        w.onerror = () => {
          this.failed = true;
        };
        this.workers.push(w);
        this.busy.push(0);
      }
    } catch {
      this.failed = true;
    }
  }

  generate(spec: TextureSpec, size: number | undefined, withMaps: boolean): Promise<TextureMaps> {
    if (this.failed || !this.workers.length) return Promise.resolve(generateTexture(spec, size, withMaps));
    const id = this.nextId++;
    return new Promise<TextureMaps>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.queue.push({ id, msg: { id, spec, size, withMaps } });
      this.pump();
    });
  }

  private pump() {
    for (let i = 0; i < this.workers.length && this.queue.length; i++) {
      if (this.busy[i]) continue;
      const job = this.queue.shift()!;
      this.busy[i] = job.id;
      this.workers[i].postMessage(job.msg);
    }
  }

  private done(worker: number, id: number, maps: TextureMaps) {
    this.busy[worker] = 0;
    const p = this.pending.get(id);
    this.pending.delete(id);
    p?.resolve(maps);
    this.pump();
  }
}

let pool: TexturePool | null = null;
export function texturePool(): TexturePool {
  if (!pool) pool = new TexturePool();
  return pool;
}
