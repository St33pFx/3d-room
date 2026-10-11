import { useMemo, useState } from 'react';
import { Copy, Crosshair, Lock, LockOpen, PanelRightClose, RotateCcw, RotateCw, Trash2, Lightbulb, Ruler, Sofa, Layers } from 'lucide-react';
import { getDef, itemSize, type MaterialSlot } from '../core/catalog';
import { CATEGORY_LABELS, FINISH_CATEGORIES, getMaterial, materialsIn, type MaterialCategory } from '../core/materials';
import { findItem, rotateItem, wallCoords, worldPose } from '../core/placement';
import { ROOM, WALL_IDS, WALLS } from '../core/room';
import type { ItemInstance, RoomFinishes, WallId } from '../core/types';
import { getEngine } from '../engine/Engine';
import { useStore } from '../state/store';
import { Swatch } from './Swatch';
import { formatPrice, setItemTransform } from './commands';

// Context-sensitive inspector: the selected piece, a wall/floor/ceiling, or an
// overview of the whole room with its finishes and budget.

function MaterialGrid({ categories, value, onPick }: { categories: MaterialCategory[]; value: string; onPick: (id: string) => void }) {
  const groups = useMemo(() => categories.map((c) => ({ c, list: materialsIn([c]) })).filter((g) => g.list.length), [categories]);
  return (
    <div className="mat-groups">
      {groups.map(({ c, list }) => (
        <div key={c} className="mat-group">
          {groups.length > 1 && <span className="mat-group-label">{CATEGORY_LABELS[c] ?? c}</span>}
          <div className="swatches">
            {list.map((m) => (
              <Swatch key={m.id} id={m.id} selected={m.id === value} onClick={() => onPick(m.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function NumField({ label, unit, value, onCommit, disabled, digits = 2 }: { label: string; unit: string; value: number; onCommit?: (v: number) => boolean; disabled?: boolean; digits?: number }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const shown = draft ?? value.toFixed(digits);
  const commit = () => {
    if (draft === null) return;
    const v = Number(draft.replace(',', '.'));
    setDraft(null);
    if (!Number.isFinite(v) || !onCommit || Math.abs(v - value) < 1e-4) return;
    if (!onCommit(v)) {
      setShake(true);
      setTimeout(() => setShake(false), 450);
      useStore.getState().toast('No cabe en esa posición');
    }
  };
  return (
    <label className={`num-field${disabled ? ' is-disabled' : ''}${shake ? ' is-shake' : ''}`}>
      <span>{label}</span>
      <div>
        <input
          inputMode="decimal"
          value={shown}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setDraft(null);
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        <em>{unit}</em>
      </div>
    </label>
  );
}

function Section({ title, value, children, defaultOpen = true }: { title: string; value?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`insp-section${open ? ' is-open' : ''}`}>
      <button className="insp-section-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="insp-section-title">{title}</span>
        {value && <span className="insp-section-value">{value}</span>}
        <span className="chev" aria-hidden />
      </button>
      {open && <div className="insp-section-body">{children}</div>}
    </section>
  );
}

function SlotEditor({ item, slot }: { item: ItemInstance; slot: MaterialSlot }) {
  const updateItem = useStore((s) => s.updateItem);
  const value = item.materials[slot.id] ?? slot.default;
  return (
    <Section title={slot.label} value={getMaterial(value).name}>
      <MaterialGrid
        categories={slot.categories}
        value={value}
        onPick={(id) => updateItem(item.id, { materials: { ...item.materials, [slot.id]: id } }, `${slot.label}: ${getMaterial(id).name}`)}
      />
    </Section>
  );
}

function ItemPanel({ item }: { item: ItemInstance }) {
  const def = getDef(item.type);
  const st = useStore();
  const size = itemSize(item.type, item.variant);
  const pose = worldPose(st.doc, item);
  const deg = Math.round((((pose.rot * 180) / Math.PI) % 360 + 360) % 360);
  const parent = item.parentId ? findItem(st.doc, item.parentId) : undefined;
  const children = st.doc.items.filter((i) => i.parentId === item.id);

  const setVariant = (v: number) => {
    const cand = { ...item, variant: v };
    // re-validate the new footprint where it stands
    const placed = def.placement === 'wall' || def.placement === 'rug' ? cand : rotateItem(st.doc, cand, cand.rotation);
    if (!placed) {
      st.toast('No cabe en esa posición con ese tamaño');
      return;
    }
    st.updateItem(item.id, { variant: v, position: placed.position }, `Tamaño: ${def.variants[v].label}`);
  };

  return (
    <>
      <header className="insp-head">
        <span className="eyebrow">{parent ? `Sobre ${getDef(parent.type).name}` : def.designer ?? 'Atelier Collection'}</span>
        <h2 className="insp-title">{def.name}</h2>
        <div className="insp-dims">
          <Ruler size={13} />
          {Math.round(size[0] * 100)} × {Math.round(size[2] * 100)} × {Math.round(size[1] * 100)} cm
          {def.price ? <span className="dot-sep">{formatPrice(def.price)}</span> : null}
        </div>
      </header>
      <div className="insp-actions">
        <button className="tool" disabled={def.placement === 'wall' || item.locked} onClick={() => st.rotateBy(item.id, Math.PI / 12)} title="Girar 15° (Q)">
          <RotateCcw size={16} />
        </button>
        <button className="tool" disabled={def.placement === 'wall' || item.locked} onClick={() => st.rotateBy(item.id, -Math.PI / 12)} title="Girar −15° (E)">
          <RotateCw size={16} />
        </button>
        <button className="tool" onClick={() => st.duplicateItem(item.id)} title="Duplicar (Ctrl+D)">
          <Copy size={16} />
        </button>
        <button className="tool" onClick={() => getEngine()?.focusSelection()} title="Encuadrar (F)">
          <Crosshair size={16} />
        </button>
        <button className={`tool${item.locked ? ' is-on' : ''}`} onClick={() => st.updateItem(item.id, { locked: !item.locked || undefined }, item.locked ? 'Desbloquear' : 'Bloquear')} title={item.locked ? 'Desbloquear (L)' : 'Bloquear posición (L)'}>
          {item.locked ? <Lock size={16} /> : <LockOpen size={16} />}
        </button>
        <span className="flex" />
        <button className="tool danger" onClick={() => st.removeItem(item.id)} title="Eliminar (Supr)">
          <Trash2 size={16} />
        </button>
      </div>

      <div className="insp-scroll">
        {def.variants.length > 1 && (
          <Section title="Tamaño" value={def.variants[item.variant ?? 0].label}>
            <div className="segmented wrap">
              {def.variants.map((v, i) => (
                <button key={v.label} className={(item.variant ?? 0) === i ? 'is-active' : ''} onClick={() => setVariant(i)}>
                  {v.label}
                </button>
              ))}
            </div>
          </Section>
        )}
        {def.slots.map((slot) => (
          <SlotEditor key={slot.id} item={item} slot={slot} />
        ))}
        {def.light && (
          <Section title="Luz" value={`${Math.round((item.dimmer ?? 1) * 100)} %`}>
            <div className="slider-row">
              <Lightbulb size={15} />
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={item.dimmer ?? 1}
                onPointerDown={() => st.beginGesture(`Intensidad de ${def.name}`)}
                onPointerUp={() => st.endGesture()}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!st.gesture) st.beginGesture(`Intensidad de ${def.name}`);
                  st.preview({ ...st.doc, items: st.doc.items.map((i) => (i.id === item.id ? { ...i, dimmer: v } : i)) });
                }}
                onKeyUp={() => st.endGesture()}
              />
            </div>
            <p className="hint">Las lámparas se encienden solas al atardecer. Cámbialo en la barra de luz.</p>
          </Section>
        )}
        <Section title="Posición" value={`${deg}°`} defaultOpen={false}>
          <div className="readout">
            {def.placement === 'wall' ? (
              <>
                <NumField label="A lo largo" unit="m" value={wallCoords(item)?.u ?? 0} onCommit={(v) => setItemTransform(item.id, { u: v })} disabled={item.locked} />
                <NumField label="Altura" unit="m" value={pose.y} onCommit={(v) => setItemTransform(item.id, { y: v })} disabled={item.locked} />
              </>
            ) : (
              <>
                <NumField label="X" unit="m" value={pose.x} onCommit={(v) => setItemTransform(item.id, { x: v })} disabled={!!item.parentId || item.locked} />
                <NumField label="Z" unit="m" value={pose.z} onCommit={(v) => setItemTransform(item.id, { z: v })} disabled={!!item.parentId || item.locked} />
                <NumField label="Giro" unit="°" value={deg} digits={0} onCommit={(v) => setItemTransform(item.id, { deg: v - deg + (item.rotation * 180) / Math.PI })} disabled={item.locked} />
                <NumField label="Altura" unit="m" value={pose.y} disabled />
              </>
            )}
          </div>
          <p className="hint">Escribe un valor y pulsa Intro. Flechas: mover 5 cm (Mayús 1 cm) · Mayús al arrastrar: sin ajuste.</p>
        </Section>
        {children.length > 0 && (
          <Section title="Encima" value={`${children.length}`}>
            <ul className="child-list">
              {children.map((c) => (
                <li key={c.id}>
                  <button onClick={() => st.select({ kind: 'item', id: c.id })}>{getDef(c.type).name}</button>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </>
  );
}

const FINISH_LABEL: Record<keyof RoomFinishes, string> = {
  floor: 'Suelo',
  walls: 'Paredes',
  ceiling: 'Techo',
  trim: 'Rodapiés y puertas',
  frames: 'Carpintería de ventanas',
};

function SurfacePanel({ kind, wall }: { kind: 'floor' | 'ceiling' | 'wall'; wall?: WallId }) {
  const st = useStore();
  const f = st.doc.finishes;
  const [applyAll, setApplyAll] = useState(false);
  if (kind === 'wall' && wall) {
    const value = f.walls[wall];
    return (
      <>
        <header className="insp-head">
          <span className="eyebrow">Superficie</span>
          <h2 className="insp-title">{WALLS[wall].label}</h2>
          <div className="insp-dims">
            <Ruler size={13} /> {WALLS[wall].length.toFixed(1)} × {ROOM.height.toFixed(2)} m · {getMaterial(value).name}
          </div>
        </header>
        <div className="insp-scroll">
          <label className="toggle-row">
            <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} />
            <span>Aplicar a todas las paredes</span>
          </label>
          <Section title="Acabado" value={getMaterial(value).name}>
            <MaterialGrid categories={FINISH_CATEGORIES.wall} value={value} onPick={(id) => st.setFinish('walls', id, applyAll ? 'all' : wall)} />
          </Section>
        </div>
      </>
    );
  }
  const key = kind === 'floor' ? 'floor' : 'ceiling';
  return (
    <>
      <header className="insp-head">
        <span className="eyebrow">Superficie</span>
        <h2 className="insp-title">{FINISH_LABEL[key]}</h2>
        <div className="insp-dims">
          <Ruler size={13} /> {(ROOM.width * ROOM.depth).toFixed(1)} m² · {getMaterial(f[key]).name}
        </div>
      </header>
      <div className="insp-scroll">
        <Section title="Acabado" value={getMaterial(f[key]).name}>
          <MaterialGrid categories={FINISH_CATEGORIES[key]} value={f[key]} onPick={(id) => st.setFinish(key, id)} />
        </Section>
      </div>
    </>
  );
}

function RoomPanel() {
  const st = useStore();
  const f = st.doc.finishes;
  const pieces = st.doc.items.length;
  const budget = st.doc.items.reduce((sum, i) => sum + (getDef(i.type).price ?? 0), 0);
  const wallsSame = WALL_IDS.every((w) => f.walls[w] === f.walls.north);
  return (
    <>
      <header className="insp-head">
        <span className="eyebrow">Estancia</span>
        <h2 className="insp-title">Salón comedor</h2>
        <div className="stats">
          <div>
            <strong>{(ROOM.width * ROOM.depth).toFixed(1)}</strong>
            <span>m²</span>
          </div>
          <div>
            <strong>{pieces}</strong>
            <span>piezas</span>
          </div>
          <div>
            <strong>{formatPrice(budget)}</strong>
            <span>presupuesto</span>
          </div>
        </div>
      </header>
      <div className="insp-scroll">
        <p className="hint tip">
          <Layers size={14} /> Haz clic en una pared, el suelo o un mueble para editarlo.
        </p>
        <Section title="Suelo" value={getMaterial(f.floor).name}>
          <MaterialGrid categories={FINISH_CATEGORIES.floor} value={f.floor} onPick={(id) => st.setFinish('floor', id)} />
        </Section>
        <Section title="Paredes" value={wallsSame ? getMaterial(f.walls.north).name : 'Combinadas'}>
          <MaterialGrid categories={FINISH_CATEGORIES.wall} value={wallsSame ? f.walls.north : ''} onPick={(id) => st.setFinish('walls', id, 'all')} />
        </Section>
        <Section title="Techo" value={getMaterial(f.ceiling).name} defaultOpen={false}>
          <MaterialGrid categories={FINISH_CATEGORIES.ceiling} value={f.ceiling} onPick={(id) => st.setFinish('ceiling', id)} />
        </Section>
        <Section title={FINISH_LABEL.trim} value={getMaterial(f.trim).name} defaultOpen={false}>
          <MaterialGrid categories={FINISH_CATEGORIES.trim} value={f.trim} onPick={(id) => st.setFinish('trim', id)} />
        </Section>
        <Section title={FINISH_LABEL.frames} value={getMaterial(f.frames).name} defaultOpen={false}>
          <MaterialGrid categories={FINISH_CATEGORIES.frames} value={f.frames} onPick={(id) => st.setFinish('frames', id)} />
        </Section>
      </div>
    </>
  );
}

export function Inspector() {
  const selection = useStore((s) => s.selection);
  const doc = useStore((s) => s.doc);
  const setUI = useStore((s) => s.setUI);
  const item = selection?.kind === 'item' ? findItem(doc, selection.id) : undefined;
  let body: React.ReactNode;
  if (item) body = <ItemPanel key={item.id} item={item} />;
  else if (selection?.kind === 'wall') body = <SurfacePanel key={selection.wall} kind="wall" wall={selection.wall} />;
  else if (selection?.kind === 'floor') body = <SurfacePanel kind="floor" />;
  else if (selection?.kind === 'ceiling') body = <SurfacePanel kind="ceiling" />;
  else body = <RoomPanel />;
  return (
    <aside className="panel inspector" aria-label="Inspector">
      <button className="icon-btn ghost panel-close" onClick={() => setUI({ inspector: false })} title="Ocultar inspector">
        <PanelRightClose size={17} />
      </button>
      {body}
      {!item && !selection && (
        <footer className="insp-foot">
          <Sofa size={14} /> Atelier · estudio de interiores
        </footer>
      )}
    </aside>
  );
}
