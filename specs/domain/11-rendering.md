# RND — Pipeline de render, overlays y resaltado

Estado: vigente · Código: `src/engine/Engine.ts`, `src/engine/PostFX.ts`, `src/engine/Overlays.ts`,
`src/engine/Highlight.ts`, `src/engine/ItemLayer.ts`

### RND-001 · Pipeline
Renderer WebGL2 sin AA nativo, salida sRGB, `NoToneMapping` (lo hace el post), sombras PCF.
Composer HalfFloat: RenderPass → N8AO (radio 0.8, falloff 0.6, intensidad 3.6; media resolución en
calidad equilibrada) → EffectPass(bloom umbral 1.1, grade [exposición, calidez, saturación 1.04],
ACES Filmic, viñeta) → SMAA alto.
`@code src/engine/PostFX.ts#PostFX` `@code src/engine/PostFX.ts#GradeEffect` `@manual`

### RND-002 · Overlays de edición
Escena aparte dibujada tras el composer, sin profundidad: huella de la selección (`#ff8f4a`, rojo
`#ff4d5a` si inválida), huella de hover (blanca), anillo + asa de giro (tamaño ∝ distancia, 0.06–0.2),
guías de alineación magenta discontinuas (`#ff3d8b`), cotas (EDIT-013). Ocultos con la UI oculta y en Cine.
`@code src/engine/Overlays.ts#Overlays` `@code src/engine/Engine.ts#updateOverlays` `@manual`

### RND-003 · Resaltado por borde
Selección: brillo fresnel naranja `#ff8a3d` (rojo si inválida) sobre la propia geometría; hover:
blanco tenue. Las mallas de resaltado viven en la capa 1 (fuera de la sonda de entorno) y se ocultan
en capturas, UI oculta y Cine.
`@code src/engine/Highlight.ts#Highlight` `@manual`

### RND-004 · Sincronía eficiente
Una pieza sólo se reconstruye si cambian tipo, variante o materiales (`buildKey`); mover o girar es
una transformación. Las piezas eliminadas liberan geometría y materiales propios.
`@code src/engine/ItemLayer.ts#buildKey` `@code src/engine/ItemLayer.ts#sync` `@manual`

### RND-005 · Resolución adaptativa
Media móvil del tiempo de frame; cada ≥ 1.5 s: si > 26 ms baja el *pixel ratio* 0.15 (mín.
max(0.6, máx/2)); si < 15 ms sube 0.1 (máx. dpr ≤ 2; ≤ 1.25 en calidad equilibrada). `?fixedpr=N`
lo fija (tests/capturas).
`@code src/engine/Engine.ts#adaptResolution` `@manual`

### RND-006 · Sin z-fighting
Cámara near 0.08 / far 2500. Ninguna superficie visible coplanar a < 2 cm de otra (alfombras 12 mm
sobre el suelo; losa a −3 cm).
`@code src/engine/Engine.ts#PerspectiveCamera` `@code src/engine/RoomShell.ts#buildFloorCeiling` `@manual`

### RND-007 · Calidad
`high` (por defecto) / `balanced` desde el menú: AO, mapa de sombras y *pixel ratio* máximo.
`@code src/engine/Engine.ts#applyQuality` `@manual`
