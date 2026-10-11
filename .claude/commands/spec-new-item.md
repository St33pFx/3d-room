---
description: Añadir una pieza nueva al catálogo siguiendo las specs
argument-hint: <tipo y descripción de la pieza>
---
Pieza: $ARGUMENTS

1. Lee `specs/domain/03-catalog.md` (CAT-001…010) y, si cuelga/apoya, la parte relevante de
   `05-placement.md`. Mira un `ItemDef` similar con `grep -n "type: '<parecido>'" -A25 src/core/catalog.ts`.
2. Spec: añade la fila a la tabla de CAT-006 (mismo orden que en `catalog.ts`).
3. Código: `ItemDef` en `src/core/catalog.ts` (colocación, variantes en metros, ranuras con
   materiales existentes de categorías válidas, colisionadores/superficies si hacen falta, precio) y
   builder en `src/engine/builders.ts` registrado en `BUILDERS` (usa helpers de `geo.ts`).
4. `npm run verify` (los tests `[CAT-006]`, `[CAT-007]`, `[MAT-002]` validan tabla, builder y materiales).
5. Captura de la miniatura/escena con `scripts/shot.mjs` y revísala.
