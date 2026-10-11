/// <reference lib="webworker" />
import type { TextureSpec } from '../core/materials';
import { generateTexture } from './textures';

// Texture synthesis off the main thread. Buffers are transferred, not copied.

interface Req {
  id: number;
  spec: TextureSpec;
  size?: number;
  withMaps: boolean;
}

self.onmessage = (e: MessageEvent<Req>) => {
  const { id, spec, size, withMaps } = e.data;
  const maps = generateTexture(spec, size, withMaps);
  const transfer: ArrayBuffer[] = [maps.color.buffer as ArrayBuffer];
  if (maps.normal) transfer.push(maps.normal.buffer as ArrayBuffer);
  if (maps.rough) transfer.push(maps.rough.buffer as ArrayBuffer);
  (self as unknown as Worker).postMessage({ id, maps }, transfer);
};
