---
description: Detectar y resolver deriva entre specs y código
argument-hint: [dominio opcional, p. ej. PLC]
---
Objetivo: que specs y código digan lo mismo (alcance: ${ARGUMENTS:-todos los dominios}).

1. `npm run spec:check -- --strict` y `npm test`. Lista errores y avisos.
2. Para cada requisito del alcance, compara el texto normativo con el código anclado (lee sólo el
   símbolo). Clasifica cada discrepancia: (a) el código está mal → bug; (b) la spec está desfasada;
   (c) comportamiento sin spec.
3. No cambies nada todavía: presenta la tabla de discrepancias con propuesta para cada una.
4. Tras mi confirmación: (a) arregla el código + test con el ID; (b) actualiza la spec; (c) añade
   requisito nuevo con anclas. Lo que quede abierto va a `specs/known-issues.md`.
5. `npm run verify` y resumen.
