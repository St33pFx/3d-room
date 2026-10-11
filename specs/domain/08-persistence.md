# PERS — Guardado, proyectos e import/export

Estado: vigente · Código: `src/core/persistence.ts`, `src/state/store.ts`, `src/ui/commands.ts`,
`src/ui/Modals.tsx#ProjectsModal`

### PERS-001 · Autoguardado
El estado de trabajo `{doc, env, projectId}` se guarda en `localStorage['atelier.autosave.v1']`
500 ms después de cada cambio de documento/entorno y al terminar cada gesto. Al cargar la app se
restaura; si hay autoguardado no se muestra la bienvenida.
`@code src/core/persistence.ts#writeAutosave` `@code src/core/persistence.ts#readAutosave` `@e2e`

### PERS-002 · Proyectos
`localStorage['atelier.projects.v1']` guarda `SavedProject[] {id, name, updatedAt, thumbnail (JPEG
360 px), doc, env}` ordenados por fecha. Si se excede la cuota se reintenta sin miniaturas de los
proyectos más antiguos (> 4.º). Guardar (`Ctrl+S`/botón) sobrescribe el proyecto abierto o crea uno;
«Guardar como nuevo» siempre crea. Se puede renombrar y eliminar (con confirmación).
`@code src/core/persistence.ts#saveProject` `@code src/state/store.ts#saveCurrent` `@code src/ui/commands.ts#saveDesign` `@e2e`

### PERS-003 · Saneado al cargar
Todo documento cargado (autoguardado, proyecto, importación) pasa por `sanitizeDoc`: tipos
desconocidos e ids duplicados se descartan; materiales inválidos → defecto de la ranura; acabados
inválidos → defecto; números no finitos → 0; variante recortada; `wall` sólo en piezas de pared;
hijos huérfanos descartados; nombre ≤ 80; ≤ 24 vistas. Si no hay `items`/`finishes` → `null`.
`@code src/core/persistence.ts#sanitizeDoc` `@test tests/store.test.ts`

### PERS-004 · Formato de intercambio
Exportar descarga `<nombre>.atelier.json` con `{app: 'atelier', version: 1, doc, env}`. Importar
acepta ese formato o un `DesignDoc` suelto; un archivo inválido muestra «Ese archivo no es un diseño
válido» y no cambia nada.
`@code src/core/persistence.ts#exportJSON` `@code src/core/persistence.ts#importJSON` `@test tests/store.test.ts`

### PERS-005 · Estado de guardado visible
La barra superior muestra «Borrador», «Cambios sin guardar» o «Guardado hace …» con un punto de
color (verde guardado / ámbar pendiente).
`@code src/ui/TopBar.tsx#TopBar` `@manual`
