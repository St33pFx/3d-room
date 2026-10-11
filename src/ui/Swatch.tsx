import { useEffect, useState } from 'react';
import { getMaterial } from '../core/materials';
import { materialSwatch } from '../engine/MaterialLibrary';

// Material preview chips. Texture swatches are generated lazily in idle time
// (they're procedural) and cached for the session.

const cache = new Map<string, string>();
const queue: (() => void)[] = [];
let pumping = false;

function pump() {
  if (pumping) return;
  pumping = true;
  const step = () => {
    const job = queue.shift();
    if (!job) {
      pumping = false;
      return;
    }
    job();
    setTimeout(step, 0);
  };
  setTimeout(step, 0);
}

export function useSwatch(id: string): string | undefined {
  const [url, setUrl] = useState(() => cache.get(id));
  useEffect(() => {
    if (cache.has(id)) {
      setUrl(cache.get(id));
      return;
    }
    let alive = true;
    queue.push(() => {
      if (!cache.has(id)) cache.set(id, materialSwatch(id, 72));
      if (alive) setUrl(cache.get(id));
    });
    pump();
    return () => {
      alive = false;
    };
  }, [id]);
  return url;
}

export function Swatch({ id, size = 34, selected, onClick, title }: { id: string; size?: number; selected?: boolean; onClick?: () => void; title?: string }) {
  const url = useSwatch(id);
  const def = getMaterial(id);
  return (
    <button
      type="button"
      className={`swatch${selected ? ' is-selected' : ''}`}
      style={{ width: size, height: size, backgroundColor: def.color, backgroundImage: url ? `url(${url})` : undefined }}
      onClick={onClick}
      title={title ?? def.name}
      aria-label={def.name}
      aria-pressed={selected}
    />
  );
}
