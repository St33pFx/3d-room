import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Pause, Play, RotateCcw, RotateCw, Trash2, X, Lock, Eye, Footprints, MousePointerClick } from 'lucide-react';
import { getDef } from '../core/catalog';
import { findItem } from '../core/placement';
import { SHOTS } from '../engine/CameraRig';
import { getEngine } from '../engine/Engine';
import { useStore } from '../state/store';

// Floating, contextual UI pieces that live over the 3D view.

/** Small action pill that follows the selected piece on screen. */
export function ContextToolbar() {
  const sel = useStore((s) => (s.selection?.kind === 'item' ? s.selection.id : null));
  const gesture = useStore((s) => !!s.gesture);
  const mode = useStore((s) => s.camera.mode);
  const ref = useRef<HTMLDivElement>(null);
  const item = useStore((s) => (sel ? findItem(s.doc, sel) : undefined));
  const rotateBy = useStore((s) => s.rotateBy);
  const duplicate = useStore((s) => s.duplicateItem);
  const remove = useStore((s) => s.removeItem);

  useEffect(() => {
    if (!sel) return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = ref.current;
      const a = getEngine()?.anchorFor(sel);
      if (!el || !a) return;
      el.style.opacity = a.visible ? '1' : '0';
      el.style.transform = `translate(${Math.round(a.x)}px, ${Math.round(a.y)}px) translate(-50%, calc(-100% - 18px))`;
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [sel]);

  if (!item || gesture || mode === 'cinematic') return null;
  const def = getDef(item.type);
  const rot = def.placement !== 'wall' && !item.locked;
  return (
    <div className="ctx-bar" ref={ref}>
      <span className="ctx-name">
        {item.locked && <Lock size={12} />}
        {def.name}
      </span>
      {rot && (
        <>
          <button onClick={() => rotateBy(item.id, Math.PI / 12)} title="Girar 15° (Q)">
            <RotateCcw size={15} />
          </button>
          <button onClick={() => rotateBy(item.id, -Math.PI / 12)} title="Girar −15° (E)">
            <RotateCw size={15} />
          </button>
        </>
      )}
      <button onClick={() => duplicate(item.id)} title="Duplicar (Ctrl+D)">
        <Copy size={15} />
      </button>
      <button className="danger" onClick={() => remove(item.id)} title="Eliminar (Supr)">
        <Trash2 size={15} />
      </button>
    </div>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span>{t.text}</span>
          {t.action && (
            <button
              onClick={() => {
                t.action!.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** Letterbox and minimal transport while in cinematic mode. */
export function CinemaBar() {
  const shot = useStore((s) => s.camera.shot);
  const tour = useStore((s) => s.camera.tour);
  const hidden = useStore((s) => s.ui.hidden);
  const setCamera = useStore((s) => s.setCamera);
  const [titleKey, setTitleKey] = useState(0);
  useEffect(() => setTitleKey((k) => k + 1), [shot]);
  return (
    <>
      <div className="letterbox top" />
      <div className="letterbox bottom" />
      <div key={titleKey} className="shot-title">
        <span className="shot-index">
          {String(shot + 1).padStart(2, '0')} / {String(SHOTS.length).padStart(2, '0')}
        </span>
        <span className="shot-name">{SHOTS[shot]?.name}</span>
      </div>
      {!hidden && (
        <div className="cinema-bar">
          <button onClick={() => setCamera({ shot: (shot - 1 + SHOTS.length) % SHOTS.length, tour: false })} title="Plano anterior">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => setCamera({ tour: !tour })} title={tour ? 'Pausar recorrido' : 'Reproducir recorrido'}>
            {tour ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button onClick={() => setCamera({ shot: (shot + 1) % SHOTS.length, tour: false })} title="Plano siguiente">
            <ChevronRight size={18} />
          </button>
          <div className="cinema-shots">
            {SHOTS.map((s, i) => (
              <button key={s.name} className={i === shot ? 'is-active' : ''} onClick={() => setCamera({ shot: i, tour: false })} title={s.name} />
            ))}
          </div>
          <button onClick={() => setCamera({ mode: 'orbit', tour: false })} title="Salir (Esc)">
            <X size={18} />
          </button>
        </div>
      )}
    </>
  );
}

/** Small hint while the interface is hidden. */
export function HiddenHint() {
  const [show, setShow] = useState(true);
  const setUI = useStore((s) => s.setUI);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 2600);
    return () => clearTimeout(t);
  }, []);
  return (
    <>
      <div className={`hidden-hint${show ? ' is-shown' : ''}`}>
        Pulsa <kbd>H</kbd> para mostrar la interfaz
      </div>
      <button className="reveal-btn" onClick={() => setUI({ hidden: false })} title="Mostrar interfaz (H)">
        <Eye size={16} />
      </button>
    </>
  );
}

export function ModeHint() {
  const mode = useStore((s) => s.camera.mode);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (mode !== 'walk' && mode !== 'plan') return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 4200);
    return () => clearTimeout(t);
  }, [mode]);
  if (!visible) return null;
  return (
    <div className="mode-hint">
      {mode === 'walk' ? (
        <>
          <Footprints size={15} /> Arrastra para mirar · <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd> para caminar · <kbd>Mayús</kbd> para correr
        </>
      ) : (
        <>
          <MousePointerClick size={15} /> Arrastra el fondo para desplazar · rueda para acercar
        </>
      )}
    </div>
  );
}
