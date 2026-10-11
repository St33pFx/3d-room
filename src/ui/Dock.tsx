import { useMemo, useState } from 'react';
import { Bookmark, BookmarkPlus, X, Box, Clapperboard, Footprints, Grid2x2, Lamp, LampCeiling, Moon, Pause, Play, Sun, SunMedium, Sunrise, Sunset, Compass, Aperture } from 'lucide-react';
import type { CameraMode } from '../core/types';
import { computeSun } from '../engine/Lighting';
import { useStore } from '../state/store';
import { formatTime } from './commands';
import { getEngine } from '../engine/Engine';

// Bottom dock: camera modes on the left, light & time of day on the right.

const MODES: { id: CameraMode; label: string; icon: React.ReactNode; key: string }[] = [
  { id: 'orbit', label: 'Maqueta', icon: <Box size={16} />, key: '1' },
  { id: 'plan', label: 'Planta', icon: <Grid2x2 size={16} />, key: '2' },
  { id: 'walk', label: 'Paseo', icon: <Footprints size={16} />, key: '3' },
  { id: 'cinematic', label: 'Cine', icon: <Clapperboard size={16} />, key: '4' },
];

const PRESET_TIMES: { t: number; label: string; icon: React.ReactNode }[] = [
  { t: 7.25, label: 'Amanecer', icon: <Sunrise size={14} /> },
  { t: 12.5, label: 'Mediodía', icon: <SunMedium size={14} /> },
  { t: 19.6, label: 'Atardecer', icon: <Sunset size={14} /> },
  { t: 22.5, label: 'Noche', icon: <Moon size={14} /> },
];

/** CSS gradient of the sky colour across the day for the time slider. */
function skyGradient(): string {
  const stops: string[] = [];
  for (let h = 0; h <= 24; h += 1) {
    const s = computeSun(h, 0);
    const day = s.daylight;
    const gold = s.golden;
    const night = s.night;
    const r = Math.round(30 + 160 * day + 70 * gold - 10 * night);
    const g = Math.round(40 + 160 * day + 10 * gold);
    const b = Math.round(80 + 150 * day - 60 * gold);
    stops.push(`rgb(${Math.min(255, r)},${Math.min(255, g)},${Math.max(40, Math.min(255, b))}) ${((h / 24) * 100).toFixed(1)}%`);
  }
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

export function Dock() {
  const mode = useStore((s) => s.camera.mode);
  const setCamera = useStore((s) => s.setCamera);
  const env = useStore((s) => s.env);
  const setEnv = useStore((s) => s.setEnv);
  const timelapse = useStore((s) => s.timelapse);
  const setTimelapse = useStore((s) => s.setTimelapse);
  const [more, setMore] = useState(false);
  const [views, setViews] = useState(false);
  const bookmarks = useStore((s) => s.doc.bookmarks);
  const addBookmark = useStore((s) => s.addBookmark);
  const removeBookmark = useStore((s) => s.removeBookmark);
  const gradient = useMemo(skyGradient, []);
  const sun = computeSun(env.time, env.orientation);
  const SunIcon = sun.night > 0.5 ? Moon : sun.golden > 0.4 ? Sunset : Sun;
  const lampLabel = env.lampMode === 'auto' ? 'Auto' : env.lampMode === 'on' ? 'Encendidas' : 'Apagadas';

  return (
    <div className="dock">
      <div className="dock-group" role="tablist" aria-label="Cámara">
        {MODES.map((m) => (
          <button key={m.id} role="tab" aria-selected={mode === m.id} className={`mode-btn${mode === m.id ? ' is-active' : ''}`} onClick={() => setCamera({ mode: m.id, tour: m.id === 'cinematic' })} title={`${m.label} (${m.key})`}>
            {m.icon}
            <span>{m.label}</span>
          </button>
        ))}
        <button className={`icon-btn${views ? ' is-on' : ''}`} onClick={() => (setViews(!views), setMore(false))} title="Vistas guardadas">
          <Bookmark size={16} />
          {bookmarks.length > 0 && <span className="badge">{bookmarks.length}</span>}
        </button>
      </div>
      <div className="dock-sep" />
      <div className="dock-group time">
        <button className="icon-btn" onClick={() => setTimelapse(!timelapse)} title={timelapse ? 'Pausar el paso del tiempo (Espacio)' : 'Reproducir el paso del día (Espacio)'}>
          {timelapse ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <div className="time-slider">
          <input
            type="range"
            min={0}
            max={23.99}
            step={0.05}
            value={env.time}
            onChange={(e) => {
              setTimelapse(false);
              setEnv({ time: Number(e.target.value) });
            }}
            style={{ backgroundImage: gradient }}
            aria-label="Hora del día"
          />
          <div className="time-ticks" aria-hidden>
            <span>0</span>
            <span>6</span>
            <span>12</span>
            <span>18</span>
            <span>24</span>
          </div>
        </div>
        <div className="time-label">
          <SunIcon size={15} />
          <span className="mono">{formatTime(env.time)}</span>
        </div>
        <button className={`icon-btn${env.lampMode !== 'off' ? ' is-on' : ''}`} onClick={() => setEnv({ lampMode: env.lampMode === 'auto' ? 'on' : env.lampMode === 'on' ? 'off' : 'auto' })} title={`Lámparas: ${lampLabel}`}>
          {env.lampMode === 'off' ? <LampCeiling size={16} /> : <Lamp size={16} />}
          <span className="badge">{env.lampMode === 'auto' ? 'A' : env.lampMode === 'on' ? 'I' : 'O'}</span>
        </button>
        <button className={`icon-btn${more ? ' is-on' : ''}`} onClick={() => (setMore(!more), setViews(false))} title="Más ajustes de luz">
          <Aperture size={16} />
        </button>
      </div>
      {views && (
        <div className="popover views-pop">
          <div className="pop-head">
            <strong>Vistas guardadas</strong>
            <span className="small">Se guardan con el proyecto</span>
          </div>
          {bookmarks.length === 0 && <p className="hint">Encuadra la escena como te guste y guárdala para volver con un clic.</p>}
          <div className="view-list">
            {bookmarks.map((b) => (
              <div key={b.id} className="view-row">
                <button className="view-go" onClick={() => getEngine()?.gotoView(b)}>
                  <Bookmark size={14} /> {b.name}
                </button>
                <button className="view-del" onClick={() => removeBookmark(b.id)} title="Eliminar vista">
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
          <button
            className="ghost-btn"
            disabled={mode === 'cinematic'}
            onClick={() => {
              const v = getEngine()?.currentView(`Vista ${bookmarks.length + 1}`);
              if (v) addBookmark(v);
            }}
          >
            <BookmarkPlus size={15} /> Guardar vista actual
          </button>
        </div>
      )}
      {more && (
        <div className="popover light-pop">
          <div className="pop-row presets">
            {PRESET_TIMES.map((p) => (
              <button
                key={p.label}
                className="chip"
                onClick={() => {
                  setTimelapse(false);
                  setEnv({ time: p.t });
                }}
              >
                {p.icon} {p.label}
              </button>
            ))}
          </div>
          <label className="pop-row">
            <span className="pop-label">
              <Compass size={14} /> Orientación
            </span>
            <input type="range" min={-180} max={180} step={1} value={env.orientation} onChange={(e) => setEnv({ orientation: Number(e.target.value) })} />
            <span className="mono small">{env.orientation}°</span>
          </label>
          <label className="pop-row">
            <span className="pop-label">
              <Aperture size={14} /> Exposición
            </span>
            <input type="range" min={0.5} max={1.8} step={0.01} value={env.exposure} onChange={(e) => setEnv({ exposure: Number(e.target.value) })} />
            <span className="mono small">{env.exposure.toFixed(2)}</span>
          </label>
          <div className="pop-row">
            <span className="pop-label">
              <Lamp size={14} /> Lámparas
            </span>
            <div className="segmented">
              {(['auto', 'on', 'off'] as const).map((m) => (
                <button key={m} className={env.lampMode === m ? 'is-active' : ''} onClick={() => setEnv({ lampMode: m })}>
                  {m === 'auto' ? 'Auto' : m === 'on' ? 'Sí' : 'No'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
