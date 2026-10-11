# Specs de Atelier (spec-anchored SDD)

Las specs son la **fuente de verdad** del comportamiento. Cada requisito tiene un ID estable,
texto normativo y **anclas** al código y a los tests que lo implementan/verifican.
`npm run spec:check` valida las anclas en cada cambio (ver `scripts/check-specs.mjs`).

## Índice

| Prefijo | Spec | Dominio | Código principal |
|---|---|---|---|
| — | [architecture.md](architecture.md) | Capas, flujo de datos, contratos entre módulos | todo |
| DOC | [domain/01-document-model.md](domain/01-document-model.md) | Modelo de documento | `src/core/types.ts` |
| ROOM | [domain/02-room.md](domain/02-room.md) | Arquitectura fija de la estancia y jardín | `src/core/room.ts`, `src/engine/RoomShell.ts` |
| CAT | [domain/03-catalog.md](domain/03-catalog.md) | Catálogo de piezas y modelado | `src/core/catalog.ts`, `src/engine/builders.ts` |
| MAT | [domain/04-materials.md](domain/04-materials.md) | Materiales y texturas procedurales | `src/core/materials.ts`, `src/engine/textures.ts` |
| PLC | [domain/05-placement.md](domain/05-placement.md) | Colocación, colisiones y snapping | `src/core/placement.ts`, `src/core/geometry.ts` |
| EDIT | [domain/06-editing.md](domain/06-editing.md) | Interacción y edición | `src/engine/Interaction.ts`, `src/ui/commands.ts` |
| HIST | [domain/07-history.md](domain/07-history.md) | Deshacer / rehacer | `src/state/store.ts` |
| PERS | [domain/08-persistence.md](domain/08-persistence.md) | Guardado, proyectos, import/export | `src/core/persistence.ts` |
| LIGHT | [domain/09-lighting.md](domain/09-lighting.md) | Hora del día e iluminación | `src/engine/Lighting.ts` |
| CAM | [domain/10-cameras.md](domain/10-cameras.md) | Cámaras, recorte de muros | `src/engine/CameraRig.ts` |
| RND | [domain/11-rendering.md](domain/11-rendering.md) | Pipeline de render, overlays, resaltado | `src/engine/Engine.ts`, `PostFX.ts` |
| UI | [domain/12-ui.md](domain/12-ui.md) | Interfaz, atajos, responsive | `src/ui/*` |
| CAP | [domain/13-capture.md](domain/13-capture.md) | Vista limpia y capturas | `src/engine/Engine.ts` |
| PERF | [domain/14-performance.md](domain/14-performance.md) | Presupuestos de rendimiento | varios |

Transversales: [glossary.md](glossary.md) · [decisions.md](decisions.md) (ADRs) ·
[testing.md](testing.md) · [known-issues.md](known-issues.md) · [changes/](changes/) (propuestas en curso).

`node scripts/check-specs.mjs --list` imprime todos los requisitos con su verificación.

## Formato de un requisito

```md
### PLC-004 · Resolución del arrastre en suelo
La pieza DEBE … (texto normativo, verificable, sin explicar la implementación).
`@code src/core/placement.ts#placeOnFloor` `@test tests/placement.test.ts` `@e2e`
```

| Ancla | Significado | Lo que valida `spec:check` |
|---|---|---|
| `@code ruta#símbolo` | Dónde está implementado | el archivo existe y contiene el identificador |
| `@const ruta#NOMBRE=valor` | Constante normativa | el código dice exactamente `NOMBRE = valor` (o `NOMBRE: valor`) |
| `@test ruta` | Test unitario | el archivo tiene un test con `[ID]` en el título |
| `@e2e` | Comprobación en `scripts/e2e.mjs` | existe un `check('[ID] …')` |
| `@manual` | Verificación visual/manual | nada (se revisa con `scripts/shot.mjs`) |

Reglas:
- IDs estables: nunca se reutilizan ni renumeran. Un requisito retirado se marca
  `### ABC-007 · (retirado) …` con motivo y sin anclas `@code`.
- Palabras normativas: **DEBE**, **NO DEBE**, **PUEDE**.
- Los valores numéricos importantes se anclan con `@const` para detectar deriva.
- Un requisito sin `@test`/`@e2e`/`@manual` es deuda: `--strict` lo convierte en error.

## Ciclo de cambio (spec → test → código)

1. **Proponer**: copiar `_templates/change.md` a `changes/NNNN-slug.md`; describir el delta
   (requisitos nuevos/modificados/retirados con sus IDs).
2. **Spec**: aplicar el delta en la spec de dominio (o crear una con `_templates/spec.md`).
3. **Test**: escribir/ajustar tests con `[ID]` en el título (unit en `tests/`, interacción en
   `scripts/e2e.mjs`).
4. **Código**: implementar hasta que los tests pasen. Añadir/ajustar anclas `@code`/`@const`.
5. **Verificar**: `npm run verify` (typecheck + unit + spec:check + build); e2e si toca interacción;
   captura si toca lo visual.
6. **Cerrar**: borrar `changes/NNNN-slug.md` (la spec de dominio ya contiene el resultado) y
   citar los IDs en el commit (`PLC-019: …`).

Bugs: si el código viola la spec → arreglar código + test con el ID. Si la spec era incorrecta →
ciclo de cambio normal. Discrepancias sin resolver → `known-issues.md`.
