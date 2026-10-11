---
description: Implementar un cambio siguiendo spec → test → código (spec-anchored SDD)
argument-hint: <descripción del cambio>
---
Cambio pedido: $ARGUMENTS

Sigue el ciclo de `specs/README.md` sin saltarte pasos:
1. Lee `specs/README.md` y SÓLO la(s) spec(s) de dominio afectadas. Identifica los requisitos
   existentes (IDs) que cambian y los nuevos que hacen falta (siguiente número libre del prefijo;
   `node scripts/check-specs.mjs --list` para verlos).
2. Si el cambio toca más de un requisito o un dominio, crea `specs/changes/NNNN-slug.md` desde
   `specs/_templates/change.md` y muéstrame el delta antes de seguir. Si es pequeño, edita la spec.
3. Escribe/ajusta tests con `[ID]` en el título (`tests/` para lógica pura, `scripts/e2e.mjs` para
   interacción). Deben fallar antes de implementar cuando sea posible.
4. Implementa leyendo sólo los símbolos anclados (`@code`). Actualiza anclas `@code`/`@const`.
5. `npm run verify`. Si toca interacción, `npm run test:e2e` (dev server). Si es visual, captura con
   `scripts/shot.mjs` y revísala.
6. Borra el archivo de `specs/changes/` si lo creaste, y resume: IDs nuevos/cambiados, archivos, tests.
