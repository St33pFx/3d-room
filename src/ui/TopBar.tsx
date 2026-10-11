import { useEffect, useRef, useState } from 'react';
import { Camera, Download, EyeOff, FolderOpen, HelpCircle, Magnet, MoreHorizontal, Redo2, Save, Undo2, Upload, Grid3x3, MousePointer2, FilePlus2, Gauge } from 'lucide-react';
import { useStore } from '../state/store';
import { downloadScreenshot, exportDesign, importDesign, saveDesign } from './commands';

// Top bar: identity & document name, history, snapping, and output actions.

function timeAgo(ts: number | null): string {
  if (!ts) return '';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 10) return 'ahora';
  if (s < 60) return `hace ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  return `hace ${Math.round(m / 60)} h`;
}

const SNAP_LABEL = { smart: 'Ajuste inteligente', grid: 'Rejilla 10 cm', off: 'Libre' } as const;

export function TopBar() {
  const name = useStore((s) => s.doc.name);
  const rename = useStore((s) => s.rename);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const undoLabel = useStore((s) => s.past[s.past.length - 1]?.label);
  const redoLabel = useStore((s) => s.future[0]?.label);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const snap = useStore((s) => s.ui.snap);
  const quality = useStore((s) => s.ui.quality);
  const setUI = useStore((s) => s.setUI);
  const dirty = useStore((s) => s.dirty);
  const projectId = useStore((s) => s.projectId);
  const lastSavedAt = useStore((s) => s.lastSavedAt);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [menu, setMenu] = useState(false);
  const [, tick] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setDraft(name), [name]);
  useEffect(() => {
    const id = setInterval(() => tick((x) => x + 1), 15000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [menu]);

  const status = dirty ? (projectId ? 'Cambios sin guardar' : 'Borrador') : lastSavedAt ? `Guardado ${timeAgo(lastSavedAt)}` : projectId ? 'Guardado' : 'Borrador';

  return (
    <header className="topbar">
      <div className="tb-group brand">
        <div className="logo" aria-hidden>
          <svg viewBox="0 0 32 32" width="30" height="30">
            <rect width="32" height="32" rx="9" fill="#24201c" />
            <path d="M9 23 16 8l7 15M11.6 18h8.8" stroke="#ecc9a3" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="doc-id">
          <span className="wordmark">Atelier</span>
          {editing ? (
            <input
              className="doc-name-input"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                rename(draft);
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') {
                  setDraft(name);
                  setEditing(false);
                }
              }}
            />
          ) : (
            <button className="doc-name" onClick={() => setEditing(true)} title="Renombrar">
              {name}
            </button>
          )}
          <span className={`save-state${dirty ? ' is-dirty' : ''}`}>{status}</span>
        </div>
      </div>

      <div className="tb-group">
        <button className="icon-btn" disabled={!canUndo} onClick={undo} title={canUndo ? `Deshacer: ${undoLabel} (Ctrl+Z)` : 'Nada que deshacer'}>
          <Undo2 size={17} />
        </button>
        <button className="icon-btn" disabled={!canRedo} onClick={redo} title={canRedo ? `Rehacer: ${redoLabel} (Ctrl+Shift+Z)` : 'Nada que rehacer'}>
          <Redo2 size={17} />
        </button>
        <span className="tb-sep" />
        <button className={`pill-btn${snap !== 'off' ? ' is-on' : ''}`} onClick={() => setUI({ snap: snap === 'smart' ? 'grid' : snap === 'grid' ? 'off' : 'smart' })} title="Modo de ajuste (G)">
          {snap === 'smart' ? <Magnet size={15} /> : snap === 'grid' ? <Grid3x3 size={15} /> : <MousePointer2 size={15} />}
          <span>{SNAP_LABEL[snap]}</span>
        </button>
      </div>

      <div className="tb-group">
        <button className="icon-btn" onClick={() => setUI({ projects: true })} title="Proyectos y plantillas">
          <FolderOpen size={17} />
        </button>
        <button className="icon-btn" onClick={() => downloadScreenshot()} title="Capturar imagen (P)">
          <Camera size={17} />
        </button>
        <button className="icon-btn hide-narrow" onClick={() => setUI({ hidden: true })} title="Ocultar interfaz (H)">
          <EyeOff size={17} />
        </button>
        <div className="menu-wrap" ref={menuRef}>
          <button className={`icon-btn${menu ? ' is-on' : ''}`} onClick={() => setMenu(!menu)} title="Más">
            <MoreHorizontal size={17} />
          </button>
          {menu && (
            <div className="menu" role="menu">
              <button role="menuitem" onClick={() => (setMenu(false), saveDesign(true))}>
                <FilePlus2 size={15} /> Guardar como nuevo
              </button>
              <button role="menuitem" onClick={() => (setMenu(false), exportDesign())}>
                <Download size={15} /> Exportar JSON
              </button>
              <button role="menuitem" onClick={() => (setMenu(false), importDesign())}>
                <Upload size={15} /> Importar JSON
              </button>
              <div className="menu-sep" />
              <button role="menuitem" onClick={() => (setMenu(false), setUI({ quality: quality === 'high' ? 'balanced' : 'high' }))}>
                <Gauge size={15} /> Calidad: {quality === 'high' ? 'Alta' : 'Equilibrada'}
              </button>
              <button role="menuitem" onClick={() => (setMenu(false), setUI({ hidden: true }))}>
                <EyeOff size={15} /> Ocultar interfaz
              </button>
              <button role="menuitem" onClick={() => (setMenu(false), setUI({ shortcuts: true }))}>
                <HelpCircle size={15} /> Atajos de teclado
              </button>
            </div>
          )}
        </div>
        <button className="primary-btn" onClick={() => saveDesign()} title="Guardar (Ctrl+S)">
          <Save size={15} />
          <span>Guardar</span>
        </button>
      </div>
    </header>
  );
}
