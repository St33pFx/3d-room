# CAP — Vista limpia y capturas

Estado: vigente · Código: `src/engine/Engine.ts`, `src/ui/commands.ts`, `src/ui/Overlays.tsx`

### CAP-001 · Ocultar la interfaz
`H` (o botón/menú) oculta toda la UI con transición, además de overlays y resaltado. Aparece 2.6 s la
pista «Pulsa H para mostrar la interfaz» y un botón discreto (visible al pasar el ratón) para volver.
`Esc` también la muestra.
`@code src/ui/Overlays.tsx#HiddenHint` `@code src/engine/Engine.ts#overlaysVisible` `@e2e`

### CAP-002 · Captura PNG
`P` o el botón de cámara renderizan un PNG a 2× el dpr (máx. 4×) sin overlays ni resaltado y lo
descargan como `<nombre del diseño> AAAA-MM-DD HHhMM.png`.
`@code src/engine/Engine.ts#screenshot` `@code src/ui/commands.ts#downloadScreenshot` `@e2e`

### CAP-003 · Plano de cine limpio
En Cine con la UI oculta sólo quedan la imagen y las bandas panorámicas (sin controles).
`@code src/ui/Overlays.tsx#CinemaBar` `@manual`
