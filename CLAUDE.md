# CLAUDE.md — Atelier (estudio de interiores 3D)

App web (Vite + React + TypeScript + three.js) para amueblar y acabar una sala-comedor 3D en
tiempo real. **Desarrollo spec-anchored**: el comportamiento está definido en `specs/`; el código
lo implementa. Lee `constitution.md` una vez; es corta y manda.

## Cómo trabajar sin gastar contexto
1. Empieza por `specs/README.md` (índice) → abre **sólo** la spec del dominio afectado.
2. Cada requisito trae anclas `@code ruta#símbolo`: ve directo con `grep -n "símbolo" ruta`
   y lee ese rango. No leas archivos completos > 300 líneas (`builders.ts`, `textures.ts`,
   `catalog.ts`, `placement.ts`, `Engine.ts`, `Interaction.ts`, `RoomShell.ts`, `store.ts`).
3. `node scripts/check-specs.mjs --list` da todos los requisitos en una línea cada uno.
4. No re-derives decisiones: están en `specs/decisions.md` (ADR-001…013).
5. No generes capturas salvo para cambios visuales (10–30 s cada una).

## Comandos
| | |
|---|---|
| `npm run dev` | servidor en :5173 (necesario para e2e y capturas) |
| `npm run verify` | **gate**: typecheck + unit + spec:check + build |
| `npm test` · `npm run typecheck` · `npm run build` | por separado |
| `npm run spec:check` | anclas de specs ↔ código/tests (`--strict`, `--list`) |
| `npm run test:e2e` | interacción real en Chromium (≈8 min, requiere dev server) |
| `node scripts/shot.mjs "?fixedpr=1" out.png 300 1440 900 "<js>"` | captura (ver `specs/testing.md`) |

## Ciclo de cambio (obligatorio)
spec → test → código → verify. Detalle en `specs/README.md`:
1. Delta en `specs/changes/NNNN-*.md` (o directo en la spec si es pequeño) con IDs nuevos/cambiados.
2. Tests con `[ID]` en el título (`tests/`) o en `check('[ID] …')` (`scripts/e2e.mjs`).
3. Implementar; actualizar anclas `@code`/`@const` si se mueven símbolos o valores.
4. `npm run verify` (+ e2e si hay interacción, + captura si es visual). Commit citando IDs.
Nunca cambies comportamiento observable sin tocar su spec. Bug = código ≠ spec.

## Mapa (dominio → spec → código)
| Dominio | Spec | Código |
|---|---|---|
| Documento / plantillas | `specs/domain/01-document-model.md` | `src/core/types.ts`, `presets.ts` |
| Estancia, jardín | `02-room.md` | `src/core/room.ts`, `src/engine/RoomShell.ts` |
| Catálogo, modelos | `03-catalog.md` | `src/core/catalog.ts`, `src/engine/builders.ts`, `geo.ts` |
| Materiales, texturas | `04-materials.md` | `src/core/materials.ts`, `src/engine/textures.ts`, `texturePool.ts`, `MaterialLibrary.ts` |
| Colocación, colisiones | `05-placement.md` | `src/core/placement.ts`, `geometry.ts` |
| Edición, interacción | `06-editing.md` | `src/engine/Interaction.ts`, `src/ui/commands.ts` |
| Historial | `07-history.md` | `src/state/store.ts` |
| Guardado | `08-persistence.md` | `src/core/persistence.ts` |
| Luz y hora | `09-lighting.md` | `src/engine/Lighting.ts`, `ItemLayer.ts` (lámparas) |
| Cámaras, recorte | `10-cameras.md` | `src/engine/CameraRig.ts`, `RoomShell.ts#updateCutaway` |
| Render, overlays | `11-rendering.md` | `src/engine/Engine.ts`, `PostFX.ts`, `Overlays.ts`, `Highlight.ts` |
| UI, atajos | `12-ui.md` | `src/ui/*`, `src/styles/app.css` |
| Capturas | `13-capture.md` · Rendimiento `14-performance.md` | `Engine.ts#screenshot` |

Capas: `core` (puro, sin three/React/DOM) ← `state` ← `engine` (three) / `ui` (React). Ver
`specs/architecture.md`. El test `[ARCH-001]` lo hace cumplir.

## Invariantes que más se rompen
- Nunca mutar `DesignDoc`: crear objetos nuevos; editar siempre vía acciones del store (DOC-001, HIST-001).
- `preview()` sólo dentro de `beginGesture`/`endGesture` (HIST-002).
- Reglas de colocación sólo en `core/placement.ts`; motor/teclado/inspector las llaman (ARCH-001, PLC-*).
- Un resultado `valid` jamás intersecta; plantillas sin colisiones (PLC-004, PLC-017).
- Añadir una pieza = `ItemDef` en `catalog.ts` + builder en `builders.ts#BUILDERS` + fila en la
  tabla de CAT-006 (el test compara tabla ↔ catálogo) + materiales válidos (MAT-002).
- Nuevos materiales: ids existentes en `MATERIALS`; generadores sin DOM (corren en workers, MAT-005).
- Muros/techo recortados usan el material `ghost` (siguen proyectando sombra); al cambiar acabados
  no reactivar superficies recortadas (ROOM-005, CAM-008).
- Superficies visibles separadas ≥ 2 cm (RND-006). Overlays/resaltado en capa 1 o escena aparte.
- UI en español, código en inglés; estilos sólo con tokens de `app.css` (UI-001/002).
- Si cambia el formato guardado: `sanitizeDoc` + `version` (PERS-003).

## Pruebas en el contenedor
WebGL es por software (SwiftShader, ~0.05 fps): en scripts de navegador pon
`window.__engine.paused = true` y fuerza frames con `__engine.settle()`; usa `?fixedpr=1`;
cierra la bienvenida con `__store.getState().setUI({onboarding:false})`. Ganchos: `screenOf(id)`,
`screenPoint(x,y,z)`, `validate()`. Más en `specs/testing.md`.

## Git
Rama de trabajo indicada por la sesión. Commits pequeños, mensaje en inglés citando IDs
(`PLC-019: …`). No crear PR salvo petición. `screenshots/` está ignorado.
