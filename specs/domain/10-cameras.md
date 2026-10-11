# CAM — Cámaras y recorte de muros

Estado: vigente · Código: `src/engine/CameraRig.ts`, `src/engine/RoomShell.ts#updateCutaway`

### CAM-001 · Modos
`orbit` («Maqueta», por defecto), `plan` («Planta»), `walk` («Paseo»), `cinematic` («Cine»). Teclas
`1`–`4` y dock. Volver a pulsar el modo activo (salvo Cine) recentra su encuadre por defecto.
`@code src/engine/CameraRig.ts#setMode` `@code src/engine/Engine.ts#resetView` `@e2e`

### CAM-002 · Maqueta (órbita)
Arrastrar orbita, rueda acerca, botón derecho desplaza; amortiguación 0.08; distancia 1.2–32 m;
ángulo polar 0.05–0.49π; objetivo limitado al entorno de la estancia. Encuadre inicial adaptado a la
pantalla: posición alejada `k = clamp((1.45/aspect)^0.7, 1, 2.4)` y fov `min(48, 36 + (1560−ancho)/28)`.
`@code src/engine/CameraRig.ts#applyOrbitLimits` `@code src/engine/CameraRig.ts#homePos` `@code src/engine/CameraRig.ts#homeFov` `@const src/engine/CameraRig.ts#dampingFactor=0.08` `@manual`

### CAM-003 · Planta
Vista cenital (y 17.5, fov 30), sin rotación; arrastrar con botón izquierdo desplaza; distancia 4–30.
`@code src/engine/CameraRig.ts#PLAN_HOME` `@manual`

### CAM-004 · Paseo
Ojo a 1.62 m; arrastrar mira (yaw libre, pitch ±1.2 rad); `WASD`/flechas caminan a 1.5 m/s
(Mayús 2.6); colisión con la estancia (radio 0.28) y con muebles de suelo bajos (cajas con y0 ≤ 1 m,
radio 0.22). Arrastrar sobre una pieza la mueve en vez de mirar.
`@code src/engine/CameraRig.ts#updateWalk` `@code src/engine/Engine.ts#walkCollide` `@manual`

### CAM-005 · Cine
Seis planos con movimiento lento (*ease* coseno): Bienvenida, Luz de la ventana, Rincón de lectura,
Mesa del comedor, Detalle bajo, Cenital. Recorrido automático (avanza al terminar cada plano),
anterior/siguiente, bandas panorámicas (9 vh), título del plano, sin selección ni overlays. `Esc` sale.
`@code src/engine/CameraRig.ts#SHOTS` `@code src/engine/CameraRig.ts#playShot` `@code src/ui/Overlays.tsx#CinemaBar` `@e2e`

### CAM-006 · Transiciones
Cambios de modo, encuadres y vistas vuelan con *ease* cúbico (1.2–1.4 s) y una ligera elevación en
arco proporcional a la distancia.
`@code src/engine/CameraRig.ts#flyTo` `@manual`

### CAM-007 · Vistas guardadas
«Guardar vista actual» añade un `CameraBookmark` (pos, objetivo, fov) al documento (deshacible).
Ir a una vista: si está dentro de la estancia pasa a Paseo, si no a Maqueta, y vuela hasta ella.
`@code src/state/store.ts#addBookmark` `@code src/engine/Engine.ts#gotoView` `@e2e`

### CAM-008 · Recorte de muros (casa de muñecas)
Fuera de Paseo, un muro cuya cara interior da la espalda a la cámara se oculta: sigue proyectando
sombra (material sin escritura de color ni profundidad), muestra un zócalo de 0.14 m, oculta su
carpintería y las piezas colgadas en él (y lo apoyado en ellas). El techo se oculta si la cámara está
por encima de 2.80 m. Con la cámara dentro de la estancia y bajo el techo no se recorta nada. Las
superficies ocultas no son seleccionables.
`@code src/engine/RoomShell.ts#updateCutaway` `@code src/engine/ItemLayer.ts#setCutWalls` `@e2e`
