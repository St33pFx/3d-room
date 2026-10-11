# PERF — Presupuestos de rendimiento

Estado: vigente · Medidas de referencia en el contenedor de CI (4 vCPU, WebGL por software).

### PERF-001 · Arranque
Generar las texturas del diseño inicial DEBE tardar ≤ 5 s en el contenedor de referencia (medido
3.5 s) y no bloquear el hilo principal (workers).
`@code src/engine/texturePool.ts#TexturePool` `@code src/engine/Engine.ts#preload` `@manual`

### PERF-002 · Interacción fluida
Durante un arrastre no se recaptura la sonda de entorno ni se reconstruyen modelos; sólo se
actualizan transformaciones.
`@code src/engine/Engine.ts#frame` `@code src/engine/ItemLayer.ts#buildKey` `@manual`

### PERF-003 · Draw calls
Cada pieza se fusiona en una malla por material (decenas de draw calls por escena, no cientos).
`@code src/engine/builders.ts#finalize` `@manual`

### PERF-004 · Peso
Bundle de producción ≤ 650 KB gzip (medido ≈ 570 KB), sin assets binarios salvo fuentes.
`@code vite.config.ts#manualChunks` `@manual`
