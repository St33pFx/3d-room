import { useEffect, useState } from 'react';
import { getMaterial } from '../core/materials';
import { materialSwatch } from '../engine/MaterialLibrary';

// Material preview chips. Texture swatches are generated in the texture
// workers on first use and cached for the session.

const cache = new Map<string, string>();

export function useSwatch(id: string): string | undefined {
  const [url, setUrl] = useState(() => cache.get(id));
  useEffect(() => {
    const hit = cache.get(id);
    if (hit) {
      setUrl(hit);
      return;
    }
    let alive = true;
    materialSwatch(id, 72).then((u) => {
      cache.set(id, u);
      if (alive) setUrl(u);
    });
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
