# EDIT — Interacción y edición

Estado: vigente · Código: `src/engine/Interaction.ts`, `src/ui/commands.ts`, `src/state/store.ts`,
`src/ui/App.tsx#useShortcuts`

### EDIT-001 · Selección
Clic en una pieza la selecciona (una pieza apoyada se selecciona por sí misma, no su padre). Clic en
pared/suelo/techo selecciona la superficie. Clic en el vacío o `Esc` deselecciona. La arquitectura
delante de una pieza la oculta al picking. En modo Cine no hay selección.
`@code src/engine/Interaction.ts#onDown` `@code src/engine/Interaction.ts#hitItem` `@e2e`

### EDIT-002 · Arrastre como gesto
El arrastre empieza tras 4 px; el `pointerdown` se captura antes que los controles de órbita para
bloquearlos. Todo el arrastre es un único gesto (`beginGesture` → `preview`* → `endGesture`).
Mientras dura: pieza en rojo si la posición es inválida, guías de alineación y cotas (EDIT-013).
`@code src/engine/Interaction.ts#startDrag` `@code src/engine/Interaction.ts#onMove` `@e2e`

### EDIT-003 · Asa de giro
La pieza seleccionada (no de pared, no bloqueada) muestra un anillo con un asa delante; arrastrar el
asa gira alrededor del centro (PLC-014) y muestra marcas cada 15°.
`@code src/engine/Overlays.ts#showSelection` `@code src/engine/Interaction.ts#hitHandle` `@e2e`

### EDIT-004 · Hover
Al pasar el ratón sobre una pieza: brillo blanco de borde, huella blanca y cursor `move`
(`pointer` si está bloqueada; `grab` sobre el asa).
`@code src/engine/Highlight.ts#setHovered` `@code src/engine/Overlays.ts#showHover` `@manual`

### EDIT-005 · Añadir desde la biblioteca
Clic en una tarjeta: se añade en un hueco libre cerca del centro de la vista (PLC-015) y queda
seleccionada. Arrastrar la tarjeta > 8 px: la pieza sigue al cursor sobre la escena (aparcada fuera
de vista hasta el primer movimiento) y se confirma al soltar dentro del lienzo; soltar fuera cancela.
`@code src/engine/Engine.ts#addFromLibrary` `@code src/engine/Interaction.ts#startPlacement` `@code src/ui/Library.tsx#Card` `@e2e`

### EDIT-006 · Desplazamiento con flechas
Con una pieza seleccionada, las flechas la mueven 5 cm (Mayús: 1 cm) relativo a la cámara (giro de
vista redondeado a 90°). En pared: izquierda/derecha a lo largo del muro, arriba/abajo en altura.
Siempre pasa por las reglas de colocación (`mode = off`).
`@code src/ui/commands.ts#nudgeSelection` `@manual`

### EDIT-007 · Duplicar y eliminar
`Ctrl+D` duplica junto a la original (a lo largo de su eje X local) en hueco libre, incluyendo lo que
tiene encima; la copia queda seleccionada. `Supr`/`Retroceso` elimina la pieza y sus hijos, con toast
«… eliminado · Deshacer».
`@code src/state/store.ts#duplicateItem` `@code src/state/store.ts#removeItem` `@test tests/store.test.ts` `@e2e`

### EDIT-008 · Bloqueo
Una pieza bloqueada (`L` o botón del inspector) no se puede mover ni girar; sigue siendo
seleccionable y editable en materiales.
`@code src/engine/Interaction.ts#onDown` `@code src/ui/commands.ts#setItemTransform` `@manual`

### EDIT-009 · Posición exacta en el inspector
Sección «Posición»: X, Z y Giro (piezas de suelo/techo raíz), «A lo largo» y Altura (pared). Al
confirmar (Intro/blur) se aplica vía reglas de colocación; si no cabe: sacudida + toast «No cabe en
esa posición». Piezas apoyadas: sólo lectura.
`@code src/ui/commands.ts#setItemTransform` `@code src/ui/Inspector.tsx#NumField` `@e2e`

### EDIT-010 · Cambio de tamaño
Cambiar de variante revalida la huella en el sitio (pequeño empuje permitido); si no cabe, se
rechaza con toast.
`@code src/ui/Inspector.tsx#ItemPanel` `@manual`

### EDIT-011 · Materiales y acabados
Cada ranura de la pieza muestra muestras de sus categorías permitidas agrupadas; clic aplica (un paso
de historial con etiqueta). Suelo, techo, cada pared («Aplicar a todas las paredes»), rodapiés y
carpintería se editan desde su panel o la vista general de la estancia.
`@code src/ui/Inspector.tsx#SlotEditor` `@code src/state/store.ts#setFinish` `@e2e`

### EDIT-012 · Encuadrar
Doble clic sobre una pieza o `F` con selección vuela la cámara para encuadrarla (en Paseo, sólo gira
la vista).
`@code src/engine/CameraRig.ts#focus` `@manual`

### EDIT-013 · Cotas en vivo
Durante el arrastre de una pieza de suelo o alfombra raíz se muestran dos cotas discontinuas con la
distancia en cm desde su huella a la pared más cercana en X y en Z.
`@code src/engine/Engine.ts#updateMeasures` `@code src/engine/Overlays.ts#showMeasures` `@manual`
