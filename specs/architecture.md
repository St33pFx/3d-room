# Arquitectura

Stack: Vite 8 · React 19 · TypeScript 5.9 (strict) · three.js r186 · zustand 5 ·
postprocessing 6 + n8ao · lucide-react · Inter/Fraunces (fontsource). Tests: vitest (Node) y
Playwright (Chromium con SwiftShader).

## Capas y dependencias permitidas

```
src/core/   (puro: sin three/React/DOM)  ← testeado en Node
   ▲            ▲
src/state/  (zustand: doc + historial + UI/env)   usa core
   ▲            ▲
src/engine/ (three.js imperativo)   lee store, usa core;   NO importa ui
src/ui/     (React)                  usa store, core y la API pública del Engine
```

- `core` no importa nada de `engine`, `state` ni `ui`.
- `engine` no importa `ui`. `ui` no importa clases de three salvo tipos.
- Prohibido duplicar reglas de colocación fuera de `core/placement.ts`.

### ARCH-001 · Núcleo puro
`src/core/**` NO DEBE importar `three`, `react` ni usar `document`/`window` en su lógica (salvo el
acceso protegido a `localStorage` de `persistence.ts`).
`@code src/core/persistence.ts#storage` `@test tests/architecture.test.ts`

### ARCH-002 · El motor refleja el store
`Engine` DEBE suscribirse al store y aplicar `doc` (acabados + piezas), `env`, modo de cámara y
calidad. El render NO DEBE modificar el documento salvo a través de acciones del store.
`@code src/engine/Engine.ts#onState` `@code src/engine/Engine.ts#applyDoc` `@manual`

### ARCH-003 · API imperativa del Engine para la UI
La UI sólo usa estos métodos del motor (singleton `getEngine()`): `addFromLibrary`,
`startPlacement`, `anchorFor`, `focusSelection`, `resetView`, `currentView`, `gotoView`,
`screenshot`, `thumbnail` y `thumbs` (miniaturas). Ganchos de test: `settle`, `paused`, `screenOf`,
`screenPoint`, `validate` (expuestos como `window.__engine`, store como `window.__store`).
`@code src/engine/Engine.ts#getEngine` `@code src/engine/Engine.ts#settle` `@code src/ui/App.tsx#__engine` `@e2e`

## Flujo de datos de una edición

```
pointer/teclado ─► Interaction / commands ─► core/placement (candidato válido)
                                     └─► store.preview(doc)  (durante el gesto)
                                     └─► store.endGesture() / commit(doc,label)  (historial)
store.subscribe ─► Engine.applyDoc ─► RoomShell.setFinishes + ItemLayer.sync (rebuild sólo si cambia tipo/variante/materiales)
                └► envDirty ─► EnvironmentProbe.capture (rebote de luz)
React (selectores zustand) ─► paneles, toolbar contextual, toasts
```

## Mapa de módulos (líneas aprox.)

| Archivo | Líneas | Responsabilidad |
|---|---|---|
| `core/types.ts` | 80 | Tipos del documento |
| `core/room.ts` | 120 | Estancia fija, muros, vanos, coordenadas de pared |
| `core/catalog.ts` | 750 | 41 `ItemDef` (datos), colisionadores, superficies, luces |
| `core/materials.ts` | 265 | ~110 `MaterialDef` (datos) |
| `core/geometry.ts` | 135 | OBB 2.5D, SAT/MTV |
| `core/placement.ts` | 640 | Reglas de colocación, snapping, búsqueda de huecos |
| `core/persistence.ts` | 170 | localStorage, saneado, import/export |
| `core/presets.ts` | 190 | Plantillas + `newId` |
| `state/store.ts` | 400 | Store zustand: doc, historial, selección, env, cámara, UI |
| `engine/Engine.ts` | 500 | Renderer, bucle, sincronía, sonda, cotas, capturas |
| `engine/builders.ts` | 930 | Modelado procedural de cada tipo + `finalize` |
| `engine/textures.ts` | 1030 | Generadores de texturas (CPU, deterministas) |
| `engine/texturePool.ts` | 70 | Pool de Web Workers |
| `engine/MaterialLibrary.ts` | 240 | Materiales three compartidos, swatches |
| `engine/RoomShell.ts` | 430 | Muros con vanos, carpintería, recorte, jardín |
| `engine/Lighting.ts` | 300 | Sol/cielo/estrellas, luces de ventana, sonda |
| `engine/ItemLayer.ts` | 175 | Documento → objetos 3D, lámparas |
| `engine/Interaction.ts` | 435 | Picking, arrastres, asa de giro, drop desde biblioteca |
| `engine/CameraRig.ts` | 360 | Modos de cámara, transiciones, planos de cine |
| `engine/PostFX.ts` | 115 | AO, bloom, grade, ACES, viñeta, SMAA |
| `engine/Overlays.ts` | 195 | Huella, anillo, guías, cotas |
| `engine/Highlight.ts` | 100 | Brillo de borde de selección/hover |
| `engine/Thumbnails.ts` | 135 | Miniaturas de biblioteca |
| `ui/*.tsx` | ~1500 | Paneles, dock, modales, atajos |
| `styles/app.css` | 350 | Tokens y estilos |

Archivos > 300 líneas: buscar el símbolo anclado en vez de leerlos completos.
