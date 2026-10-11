# HIST — Deshacer / rehacer

Estado: vigente · Código: `src/state/store.ts`

### HIST-001 · Historial de documentos
`commit(doc, label)` apila el documento anterior con su etiqueta (es), vacía «rehacer» y marca
`dirty`. Máximo 120 pasos. `Ctrl+Z` deshace, `Ctrl+Mayús+Z` / `Ctrl+Y` rehace, con toast
«Deshecho · etiqueta». Los botones muestran la etiqueta en su tooltip.
`@const src/state/store.ts#HISTORY_LIMIT=120` `@code src/state/store.ts#commit` `@code src/state/store.ts#undo` `@test tests/store.test.ts` `@e2e`

### HIST-002 · Gestos
`beginGesture(label)` guarda la base; `preview(doc)` cambia el documento sin historial;
`endGesture()` registra un único paso si hubo cambio; `cancelGesture()` restaura la base. Deshacer y
rehacer no actúan durante un gesto.
`@code src/state/store.ts#beginGesture` `@code src/state/store.ts#endGesture` `@code src/state/store.ts#cancelGesture` `@test tests/store.test.ts`

### HIST-003 · Selección coherente
Tras deshacer/rehacer, si la pieza seleccionada ya no existe la selección se limpia.
`@code src/state/store.ts#fixSelection` `@manual`

### HIST-004 · Cambios de documento completos son deshacibles
Abrir una plantilla («Plantilla X»), abrir un proyecto («Abrir X») o importar («Importar diseño»)
se puede deshacer. Cargar en el arranque no crea historial.
`@code src/state/store.ts#loadDoc` `@code src/state/store.ts#newFromPreset` `@test tests/store.test.ts`

### HIST-005 · El entorno no entra en el historial
Hora, orientación, lámparas, exposición, cámara y UI no generan pasos de historial.
`@code src/state/store.ts#setEnv` `@test tests/store.test.ts`
