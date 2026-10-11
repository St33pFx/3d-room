import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Search, X, PanelLeftClose } from 'lucide-react';
import { CATALOG_CATEGORIES, CATALOG_LIST, type ItemDef } from '../core/catalog';
import { getEngine } from '../engine/Engine';
import { useStore } from '../state/store';
import { formatPrice } from './commands';

// Furniture & decor library. Click a card to drop the piece into a free spot
// near the centre of the view, or drag it straight into the room.

function useThumb(type: string): string | undefined {
  const eng = getEngine();
  return useSyncExternalStore(
    (cb) => eng?.thumbs.subscribe(cb) ?? (() => {}),
    () => eng?.thumbs.get(type),
  );
}

const PLACEMENT_HINT: Record<string, string> = {
  floor: 'Suelo',
  rug: 'Suelo',
  wall: 'Pared',
  surface: 'Sobre muebles',
  ceiling: 'Techo',
};

function Card({ def }: { def: ItemDef }) {
  const thumb = useThumb(def.type);
  const press = useRef<{ x: number; y: number; id: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    press.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = press.current;
    if (!p || dragging) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) {
      setDragging(true);
      press.current = null;
      getEngine()?.startPlacement(def.type, e.nativeEvent);
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    }
  };
  const onPointerUp = () => {
    if (press.current) getEngine()?.addFromLibrary(def.type);
    press.current = null;
    setDragging(false);
  };
  useEffect(() => {
    if (!dragging) return;
    const up = () => setDragging(false);
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, [dragging]);

  return (
    <button
      type="button"
      className={`lib-card${dragging ? ' is-dragging' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={(e) => {
        // leaving the card while pressed starts a drag into the scene
        if (press.current && e.buttons === 1) onPointerMove(e);
      }}
      title={`${def.name} — clic para añadir, arrastra para colocar`}
    >
      <div className="lib-thumb">{thumb ? <img src={thumb} alt="" draggable={false} /> : <div className="lib-thumb-skeleton" />}</div>
      <div className="lib-meta">
        <span className="lib-name">{def.name}</span>
        <span className="lib-sub">
          {PLACEMENT_HINT[def.placement]}
          {def.price ? ` · ${formatPrice(def.price)}` : ''}
        </span>
      </div>
    </button>
  );
}

export function Library() {
  const category = useStore((s) => s.ui.libraryCategory);
  const setUI = useStore((s) => s.setUI);
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) return CATALOG_LIST.filter((d) => d.name.toLowerCase().includes(q) || d.type.includes(q) || (d.designer ?? '').toLowerCase().includes(q));
    return CATALOG_LIST.filter((d) => d.category === category);
  }, [category, query]);

  return (
    <aside className="panel library" aria-label="Biblioteca">
      <header className="panel-head">
        <div>
          <h2 className="panel-title">Biblioteca</h2>
          <p className="panel-sub">Arrastra al espacio o haz clic</p>
        </div>
        <button className="icon-btn ghost" onClick={() => setUI({ library: false })} title="Ocultar biblioteca">
          <PanelLeftClose size={17} />
        </button>
      </header>
      <label className="search">
        <Search size={15} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar piezas…" />
        {query && (
          <button className="search-clear" onClick={() => setQuery('')} aria-label="Limpiar">
            <X size={13} />
          </button>
        )}
      </label>
      {!query && (
        <nav className="chips" aria-label="Categorías">
          {CATALOG_CATEGORIES.map((c) => (
            <button key={c.id} className={`chip${c.id === category ? ' is-active' : ''}`} onClick={() => setUI({ libraryCategory: c.id })}>
              {c.label}
            </button>
          ))}
        </nav>
      )}
      <div className="lib-grid">
        {list.map((d) => (
          <Card key={d.type} def={d} />
        ))}
        {!list.length && <p className="empty">Nada coincide con «{query}».</p>}
      </div>
    </aside>
  );
}
