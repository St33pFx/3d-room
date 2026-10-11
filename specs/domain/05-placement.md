# PLC — Colocación, colisiones y snapping

Estado: vigente · Código: `src/core/placement.ts`, `src/core/geometry.ts` (puro, testeado en Node)

Toda regla de colocación vive aquí. Motor, teclado e inspector llaman a estas funciones; ninguno
reimplementa reglas. Entradas: documento + pieza + objetivo; salida: `PlacementResult
{ item, valid, guides }` (o `null`/instancia en las búsquedas).

## Modelo de colisión

### PLC-001 · Cajas 2.5D
Una pieza ocupa uno o más `Box`: rectángulo orientado en XZ (centro, semiejes, giro) extruido en una
banda vertical `[y0, y1]`. Dos cajas colisionan sólo si se solapan en planta (SAT sobre 4 ejes) **y**
en altura, de forma estricta (tolerancia 1e-4: caras que se tocan no colisionan). `overlapMTV`
devuelve el vector mínimo para separar A de B.
`@code src/core/geometry.ts#overlapMTV` `@code src/core/placement.ts#boxesAt` `@test tests/placement.test.ts`

### PLC-002 · Obstáculos
Para una pieza P: todas las piezas bloqueantes (todo excepto `rug`) salvo P, sus descendientes y —si
P es de superficie— su padre; más las zonas de paso de puertas (ROOM-003) si P es de suelo o una
pieza de superficie apoyada en el suelo.
`@code src/core/placement.ts#obstacles` `@test tests/placement.test.ts`

### PLC-003 · Contención en la estancia
Piezas de suelo, alfombras y techo DEBEN quedar con todos sus colisionadores (AABB de cada uno)
dentro del interior. Valores fuera (arrastre o tecleados) se recortan al interior.
`@code src/core/placement.ts#clampToRoom` `@test tests/placement.test.ts` `@e2e`

## Suelo

### PLC-004 · Arrastre en suelo: deslizar, nunca atravesar
Orden: snapping → recorte a la estancia → si colisiona, empujar con MTV (≤ 10 iteraciones) y aceptar
sólo si el desplazamiento < 0.45 m → si no, deslizar en un solo eje desde la posición válida previa →
si no, mantener la previa. Un resultado `valid` NUNCA intersecta.
`@code src/core/placement.ts#placeOnFloor` `@code src/core/placement.ts#pushOut` `@test tests/placement.test.ts` `@e2e`

### PLC-005 · Snapping inteligente en suelo
Con modo `smart`: (a) enrasar contra el muro si el hueco AABB–muro < 0.16 m, dejando 4 mm;
(b) alinear centros con centros y bordes con bordes de otras piezas de suelo y alfombras si la
diferencia < 0.06 m, emitiendo guías (segmentos a y = 0.02).
`@const src/core/placement.ts#WALL_SNAP=0.16` `@const src/core/placement.ts#FLUSH_GAP=0.004` `@const src/core/placement.ts#ALIGN_SNAP=0.06` `@code src/core/placement.ts#snapFloor` `@test tests/placement.test.ts`

### PLC-006 · Orientación automática contra la pared
Sólo al **colocar una pieza nueva** desde la biblioteca: si `againstWall` y el muro más cercano está
a < 0.3 m, la pieza gira para dar la espalda a ese muro. Mover piezas existentes no las gira.
`@const src/core/placement.ts#AUTO_ORIENT=0.3` `@code src/engine/Interaction.ts#candidate` `@test tests/placement.test.ts`

### PLC-007 · Modos de ajuste
`smart` (por defecto), `grid` (suelo y pared a 0.1 m; superficies a 0.05 m) y `off`. Mantener Mayús
durante el arrastre equivale a `off`.
`@code src/core/types.ts#SnapMode` `@code src/engine/Interaction.ts#onMove` `@e2e`

### PLC-008 · Alfombras
Las alfombras sólo se restringen a la estancia: no colisionan con nada ni bloquean a nadie, no se
enrasan a muros, pero sí participan en la alineación de guías.
`@code src/core/placement.ts#isBlocking` `@test tests/placement.test.ts`

## Pared

### PLC-009 · Piezas de pared
Se deslizan sobre el plano del muro (u, y). Límites: u ∈ [w/2+0.03, L−w/2−0.03];
y ∈ [h/2+0.12, H−h/2−0.04] (0.015 en vez de 0.12 para `coversOpenings`). NO DEBEN solapar vanos
(margen 0.06) salvo `coversOpenings`. Snapping `smart` (umbral 0.08–0.1 m): centro del muro, centros
de piezas de suelo delante (< 1.6 m), centros y alturas de otras piezas de la misma pared,
`mountHeight`, y centros de ventanas si `coversOpenings` (umbral 0.3). Si el objetivo no es válido se
busca hueco cercano (≤ 0.36 m arrastrando; toda la pared sin posición previa).
`@code src/core/placement.ts#placeOnWall` `@code src/core/placement.ts#clampWall` `@test tests/placement.test.ts` `@e2e`

### PLC-010 · Selección de pared bajo el cursor
Sólo cuentan los muros alcanzados desde el interior (rayo·normal < 0), dentro de su extensión.
`@code src/engine/Interaction.ts#wallPoint` `@e2e`

## Superficies

### PLC-011 · Piezas sobre muebles
Una pieza `surface` sobre un mueble con superficie se coloca en coordenadas locales del padre,
recortada para caber en el rectángulo, con ajuste al centro (0.04 m), comprobando `clearance`
(altura ≤ clearance + 0.01) y colisiones con hermanos y resto (excluido el padre). Si no cabe busca
hueco (≤ 0.3 m arrastrando; toda la superficie sin previa). Si el cursor no está sobre una
superficie, va al suelo; apuntar a un mueble sin superficie mantiene la posición.
`@code src/core/placement.ts#placeOnSurface` `@code src/core/placement.ts#surfaceAt` `@code src/engine/Interaction.ts#candidate` `@e2e`

### PLC-012 · Los hijos acompañan al padre
La pose mundo de un hijo es la del padre compuesta con su pose local: mover o girar el padre mueve
lo que tiene encima.
`@code src/core/placement.ts#worldPose` `@test tests/placement.test.ts`

## Techo

### PLC-013 · Piezas de techo
Anclaje a y = 2.85; contención en planta; colisionan con otras piezas por bandas verticales (un
colgante choca con una librería alta debajo, no con una mesa).
`@code src/core/placement.ts#placeOnFloor` `@test tests/placement.test.ts`

## Giro, alta y duplicado

### PLC-014 · Giro
Giros con asa o teclado se ajustan a 15° salvo con Mayús. `rotateItem` empuja ≤ 0.5 m si hace falta
o devuelve `null` (se rechaza con aviso). Las piezas de pared no giran.
`@code src/core/placement.ts#rotateItem` `@code src/core/placement.ts#snapRotation` `@test tests/placement.test.ts` `@e2e`

### PLC-015 · Búsqueda de hueco libre
Al añadir o duplicar: suelo/techo → espiral desde el punto preferido (paso 0.05 m, radio ≤ 4 m)
probando el giro dado y +90°; pared → paredes en orden de preferencia (las que miran a la cámara),
centros de ventana primero para cortinas; superficie → padre seleccionado, luego muebles con
superficie libre más cercanos, luego suelo. Sin hueco → aviso, no se añade.
`@code src/core/placement.ts#findFloorSpot` `@code src/core/placement.ts#findWallSpot` `@code src/core/placement.ts#findSurfaceSpot` `@test tests/placement.test.ts` `@test tests/store.test.ts` `@e2e`

### PLC-016 · Soltar en sitio inválido
Al soltar un arrastre en posición inválida, la pieza queda en el último candidato válido del gesto;
si nunca lo hubo, el gesto se cancela (y una pieza nueva arrastrada desde la biblioteca no se añade).
`@code src/engine/Interaction.ts#onUp` `@e2e`

### PLC-017 · Plantillas sin intersecciones
Toda plantilla (`createPreset`) DEBE cumplir `isColliding = false` para todas sus piezas.
`@code src/core/placement.ts#isColliding` `@test tests/placement.test.ts`
