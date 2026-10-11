import { useEffect, useRef, useState } from 'react';
import { PanelLeftOpen, PanelRightOpen } from 'lucide-react';
import { Engine, getEngine, setEngine } from '../engine/Engine';
import { useStore } from '../state/store';
import { downloadScreenshot, nudgeSelection, saveDesign } from './commands';
import { Dock } from './Dock';
import { Inspector } from './Inspector';
import { Library } from './Library';
import { ProjectsModal, ShortcutsModal, Welcome } from './Modals';
import { CinemaBar, ContextToolbar, HiddenHint, ModeHint, Toasts } from './Overlays';
import { TopBar } from './TopBar';

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const st = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const selId = st.selection?.kind === 'item' ? st.selection.id : null;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if (mod && k === 'y') {
        e.preventDefault();
        st.redo();
        return;
      }
      if (mod && k === 's') {
        e.preventDefault();
        saveDesign();
        return;
      }
      if (mod && k === 'd') {
        e.preventDefault();
        if (selId) st.duplicateItem(selId);
        return;
      }
      if (mod) return;
      const walking = st.camera.mode === 'walk';
      switch (e.key) {
        case 'Escape':
          if (st.ui.shortcuts || st.ui.projects || st.ui.onboarding) return;
          if (st.gesture) st.cancelGesture();
          else if (st.camera.mode === 'cinematic') st.setCamera({ mode: 'orbit', tour: false });
          else if (st.ui.hidden) st.setUI({ hidden: false });
          else st.select(null);
          return;
        case 'Delete':
        case 'Backspace':
          if (selId) {
            e.preventDefault();
            st.removeItem(selId);
          }
          return;
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight': {
          if (!selId) return;
          e.preventDefault();
          const step = e.shiftKey ? 0.01 : 0.05;
          const d = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] }[e.key]!;
          nudgeSelection(d[0], d[1]);
          return;
        }
        case ' ':
          e.preventDefault();
          st.setTimelapse(!st.timelapse);
          return;
        case '?':
          st.setUI({ shortcuts: true });
          return;
      }
      if (walking && ['w', 'a', 's', 'd'].includes(k)) return;
      switch (k) {
        case 'h':
          st.setUI({ hidden: !st.ui.hidden });
          break;
        case 'q':
          if (selId) st.rotateBy(selId, Math.PI / 12);
          break;
        case 'e':
          if (selId) st.rotateBy(selId, -Math.PI / 12);
          break;
        case 'r':
          if (selId) st.rotateBy(selId, Math.PI / 2);
          break;
        case 'l':
          if (selId) {
            const it = st.doc.items.find((i) => i.id === selId);
            if (it) st.updateItem(selId, { locked: !it.locked || undefined }, it.locked ? 'Desbloquear' : 'Bloquear');
          }
          break;
        case 'f':
          getEngine()?.focusSelection();
          break;
        case 'g':
          st.setUI({ snap: st.ui.snap === 'smart' ? 'grid' : st.ui.snap === 'grid' ? 'off' : 'smart' });
          st.toast(`Ajuste: ${{ smart: 'inteligente', grid: 'rejilla', off: 'libre' }[useStore.getState().ui.snap]}`);
          break;
        case 'p':
          downloadScreenshot();
          break;
        case '1':
          st.setCamera({ mode: 'orbit', tour: false });
          break;
        case '2':
          st.setCamera({ mode: 'plan', tour: false });
          break;
        case '3':
          st.setCamera({ mode: 'walk', tour: false });
          break;
        case '4':
          st.setCamera({ mode: 'cinematic', tour: true });
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function Loading() {
  const loading = useStore((s) => s.loading);
  const ready = useStore((s) => s.ready);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setGone(true), 900);
    return () => clearTimeout(t);
  }, [ready]);
  if (gone) return null;
  const pct = Math.round((loading.done / Math.max(1, loading.total)) * 100);
  return (
    <div className={`loading${ready ? ' is-done' : ''}`}>
      <div className="loading-inner">
        <svg viewBox="0 0 32 32" width="44" height="44" aria-hidden>
          <rect width="32" height="32" rx="9" fill="#24201c" />
          <path d="M9 23 16 8l7 15M11.6 18h8.8" stroke="#ecc9a3" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h1>Atelier</h1>
        <p>{loading.label}…</p>
        <div className="progress">
          <span style={{ width: `${Math.max(6, pct)}%` }} />
        </div>
      </div>
    </div>
  );
}

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const ready = useStore((s) => s.ready);
  const ui = useStore((s) => s.ui);
  const mode = useStore((s) => s.camera.mode);
  useShortcuts();

  useEffect(() => {
    const engine = new Engine(host.current!);
    setEngine(engine);
    Object.assign(window as object, { __engine: engine, __store: useStore });
    let alive = true;
    engine.preload().then(() => {
      if (!alive) return;
      engine.start();
      useStore.getState().setReady();
    });
    return () => {
      alive = false;
      engine.dispose();
      setEngine(null);
    };
  }, []);

  const cinema = mode === 'cinematic';
  const chrome = ready && !ui.hidden && !cinema;
  return (
    <div className={`app${ui.hidden ? ' ui-hidden' : ''}${cinema ? ' is-cinema' : ''}`}>
      <div className="viewport" ref={host} />
      {ready && (
        <>
          <div className={`chrome${chrome ? '' : ' is-hidden'}`} aria-hidden={!chrome}>
            <TopBar />
            {ui.library ? (
              <Library />
            ) : (
              <button className="panel-tab left" onClick={() => useStore.getState().setUI({ library: true })} title="Mostrar biblioteca">
                <PanelLeftOpen size={17} />
                <span>Biblioteca</span>
              </button>
            )}
            {ui.inspector ? (
              <Inspector />
            ) : (
              <button className="panel-tab right" onClick={() => useStore.getState().setUI({ inspector: true })} title="Mostrar inspector">
                <PanelRightOpen size={17} />
                <span>Inspector</span>
              </button>
            )}
            <Dock />
            <ModeHint />
          </div>
          {chrome && <ContextToolbar />}
          {cinema && <CinemaBar />}
          {ui.hidden && !cinema && <HiddenHint />}
          {!ui.hidden && <Toasts />}
          {ui.projects && <ProjectsModal />}
          {ui.shortcuts && <ShortcutsModal />}
          {ui.onboarding && !cinema && <Welcome />}
        </>
      )}
      <Loading />
    </div>
  );
}
