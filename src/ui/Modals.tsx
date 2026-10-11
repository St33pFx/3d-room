import { useEffect, useState } from 'react';
import { Download, FolderOpen, Pencil, Trash2, Upload, X, Sparkles, Check } from 'lucide-react';
import { deleteProject, listProjects, renameProject, type SavedProject } from '../core/persistence';
import { PRESETS } from '../core/presets';
import { useStore } from '../state/store';
import { exportDesign, importDesign, saveDesign } from './commands';
import { useSwatch } from './Swatch';
import { getMaterial } from '../core/materials';

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function PresetSwatches({ ids }: { ids: string[] }) {
  return (
    <div className="preset-swatches">
      {ids.map((id, i) => (
        <PresetChip key={i} id={id} />
      ))}
    </div>
  );
}
function PresetChip({ id }: { id: string }) {
  const url = useSwatch(id);
  return <span style={{ backgroundColor: getMaterial(id).color, backgroundImage: url ? `url(${url})` : undefined }} />;
}

function Templates({ onPick }: { onPick: (id: string) => void }) {
  return (
    <div className="preset-grid">
      {PRESETS.map((p) => (
        <button key={p.id} className="preset-card" onClick={() => onPick(p.id)}>
          <PresetSwatches ids={p.swatch} />
          <strong>{p.name}</strong>
          <span>{p.description}</span>
        </button>
      ))}
    </div>
  );
}

export function ProjectsModal() {
  const setUI = useStore((s) => s.setUI);
  const loadDoc = useStore((s) => s.loadDoc);
  const newFromPreset = useStore((s) => s.newFromPreset);
  const projectId = useStore((s) => s.projectId);
  const dirty = useStore((s) => s.dirty);
  const toast = useStore((s) => s.toast);
  const [projects, setProjects] = useState<SavedProject[]>(() => listProjects());
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const close = () => setUI({ projects: false });
  const refresh = () => setProjects(listProjects());

  const open = (p: SavedProject) => {
    loadDoc(p.doc, { projectId: p.id, env: p.env, label: `Abrir ${p.name}` });
    toast(`«${p.name}» abierto`);
    close();
  };

  return (
    <Modal title="Proyectos" onClose={close} wide>
      <div className="modal-body">
        <div className="modal-actions">
          <button className="primary-btn" onClick={() => (saveDesign(), refresh())}>
            {dirty || !projectId ? 'Guardar diseño actual' : 'Guardado'}
          </button>
          <button className="ghost-btn" onClick={() => (saveDesign(true), refresh())}>
            Guardar como nuevo
          </button>
          <span className="flex" />
          <button className="ghost-btn" onClick={importDesign}>
            <Upload size={15} /> Importar
          </button>
          <button className="ghost-btn" onClick={exportDesign}>
            <Download size={15} /> Exportar
          </button>
        </div>

        <h3 className="modal-section">Mis diseños</h3>
        {projects.length === 0 ? (
          <p className="empty">Aún no has guardado ningún diseño. Pulsa «Guardar» o <kbd>Ctrl</kbd>+<kbd>S</kbd> cuando te guste lo que ves.</p>
        ) : (
          <div className="project-grid">
            {projects.map((p) => (
              <div key={p.id} className={`project-card${p.id === projectId ? ' is-current' : ''}`}>
                <button className="project-thumb" onClick={() => open(p)} style={{ backgroundImage: p.thumbnail ? `url(${p.thumbnail})` : undefined }}>
                  {!p.thumbnail && <FolderOpen size={22} />}
                  {p.id === projectId && <span className="current-tag">Abierto</span>}
                </button>
                <div className="project-meta">
                  {editing === p.id ? (
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          renameProject(p.id, draft.trim() || p.name);
                          setEditing(null);
                          refresh();
                        }
                        if (e.key === 'Escape') setEditing(null);
                      }}
                      onBlur={() => {
                        renameProject(p.id, draft.trim() || p.name);
                        setEditing(null);
                        refresh();
                      }}
                    />
                  ) : (
                    <strong title={p.name}>{p.name}</strong>
                  )}
                  <span>
                    {new Date(p.updatedAt).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {p.doc.items.length} piezas
                  </span>
                </div>
                <div className="project-tools">
                  <button
                    title="Renombrar"
                    onClick={() => {
                      setEditing(p.id);
                      setDraft(p.name);
                    }}
                  >
                    {editing === p.id ? <Check size={14} /> : <Pencil size={14} />}
                  </button>
                  <button
                    title="Eliminar"
                    onClick={() => {
                      if (confirm(`¿Eliminar «${p.name}»? Esta acción no se puede deshacer.`)) {
                        deleteProject(p.id);
                        refresh();
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <h3 className="modal-section">Empezar desde una plantilla</h3>
        <Templates
          onPick={(id) => {
            newFromPreset(id);
            close();
          }}
        />
        <p className="hint">Abrir una plantilla se puede deshacer con <kbd>Ctrl</kbd>+<kbd>Z</kbd>.</p>
      </div>
    </Modal>
  );
}

// each entry: alternatives (separated by ·), each a chord of keys
const SHORTCUTS: [string[][], string][] = [
  [[['Clic'], ['Arrastrar']], 'Seleccionar · mover piezas'],
  [[['Mayús', 'Arrastrar']], 'Mover sin ajuste'],
  [[['Q'], ['E']], 'Girar 15°'],
  [[['R']], 'Girar 90°'],
  [[['←↑↓→']], 'Desplazar 5 cm (Mayús: 1 cm)'],
  [[['Ctrl', 'D']], 'Duplicar'],
  [[['Supr']], 'Eliminar'],
  [[['L']], 'Bloquear / desbloquear'],
  [[['F'], ['Doble clic']], 'Encuadrar la selección'],
  [[['Ctrl', 'Z']], 'Deshacer'],
  [[['Ctrl', 'Mayús', 'Z']], 'Rehacer'],
  [[['Ctrl', 'S']], 'Guardar'],
  [[['G']], 'Modo de ajuste'],
  [[['1'], ['2'], ['3'], ['4']], 'Maqueta · Planta · Paseo · Cine'],
  [[['W', 'A', 'S', 'D']], 'Caminar en modo paseo'],
  [[['Espacio']], 'Reproducir el paso del día'],
  [[['H']], 'Ocultar la interfaz'],
  [[['P']], 'Capturar imagen'],
  [[['Esc']], 'Deseleccionar / salir'],
];

export function ShortcutsModal() {
  const setUI = useStore((s) => s.setUI);
  return (
    <Modal title="Atajos de teclado" onClose={() => setUI({ shortcuts: false })}>
      <div className="modal-body">
        <dl className="shortcuts">
          {SHORTCUTS.map(([alts, v]) => (
            <div key={v}>
              <dt>
                {alts.map((chord, i) => (
                  <span key={i} className="sc-alt">
                    {i > 0 && <span className="sc-or">·</span>}
                    {chord.map((k) => (
                      <kbd key={k}>{k}</kbd>
                    ))}
                  </span>
                ))}
              </dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Modal>
  );
}

export function Welcome() {
  const setUI = useStore((s) => s.setUI);
  const newFromPreset = useStore((s) => s.newFromPreset);
  const close = () => setUI({ onboarding: false });
  return (
    <Modal title="Bienvenido a Atelier" onClose={close} wide>
      <div className="modal-body welcome">
        <p className="lede">
          <Sparkles size={16} /> Diseña tu salón en 3D: mueve piezas, prueba acabados y mira cómo cambia la luz del día.
        </p>
        <ol className="tips">
          <li>
            <strong>Arrastra</strong> muebles desde la biblioteca. Se apoyan en el suelo, en las paredes o sobre otros muebles y nunca se atraviesan.
          </li>
          <li>
            <strong>Haz clic</strong> en una pared, el suelo o una pieza para cambiar sus materiales.
          </li>
          <li>
            <strong>Desliza la hora</strong> en la barra inferior y cambia a modo <em>Cine</em> para recorrer la escena.
          </li>
        </ol>
        <h3 className="modal-section">Elige un punto de partida</h3>
        <Templates
          onPick={(id) => {
            // the default design is already loaded
            if (id !== 'casa-luz') newFromPreset(id);
            close();
          }}
        />
      </div>
    </Modal>
  );
}
