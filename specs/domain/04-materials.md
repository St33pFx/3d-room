# MAT — Materiales y texturas procedurales

Estado: vigente · Código: `src/core/materials.ts` (datos), `src/engine/textures.ts` (síntesis),
`src/engine/texturePool.ts`, `src/engine/textures.worker.ts`, `src/engine/MaterialLibrary.ts`

### MAT-001 · Definición de material
`MaterialDef`: `id`, `name` (es), `category`, `color`, `roughness`, opcionales `metalness`,
`texture: TextureSpec`, `sheen`, `clearcoat`, `opacity`, `emissive`, `envIntensity`, `side`,
`vertexColors`. La categoría `fixed` es interna (no seleccionable por el usuario).
`@code src/core/materials.ts#MaterialDef` `@code src/core/materials.ts#getMaterial` `@test tests/catalog.test.ts`

### MAT-002 · Categorías por superficie
Ranuras de pieza aceptan las categorías de su `MaterialSlot`. Acabados de la envolvente:
suelo `floor`; paredes `paint`+`wall`; techo `paint`; rodapiés `paint`+`wood`+`metal`;
carpintería `metal`+`wood`+`lacquer`. Todo id referenciado por catálogo/plantillas DEBE existir.
`@code src/core/materials.ts#FINISH_CATEGORIES` `@code src/core/materials.ts#materialsIn` `@test tests/catalog.test.ts`

### MAT-003 · Texturas procedurales deterministas
`generateTexture(spec, size)` produce color RGBA + normal + rugosidad, *tileables* y deterministas
(semilla). `TextureSpec.tile` es el tamaño del tile en metros (repeat = 1/tile sobre UV métricas);
`stretch` mapea una vez sobre la pieza (alfombras, obras, hojas); `grid` añade juntas de losas.
Generadores: woodgrain, planks, herringbone, slats, marble, travertine, concrete, terrazzo, linen,
boucle, velvet, leather, plaster, brick, zellige, rattan, bark, rug-*, art-*, leaf.
`@code src/engine/textures.ts#generateTexture` `@code src/engine/textures.ts#GENERATORS` `@test tests/textures.test.ts`

### MAT-004 · Resoluciones
1024 px: planks, herringbone, rug-*, terrazzo, brick y marble con `grid`. 512: resto (marble sin
grid incluido). 256: linen, velvet, bark, rattan. 128: leaf.
`@code src/engine/textures.ts#defaultSize` `@test tests/textures.test.ts`

### MAT-005 · Generación fuera del hilo principal
Las texturas se generan en un pool de 2–6 Web Workers (núcleos − 1), transfiriendo los buffers;
si no hay workers, se generan en el hilo principal. Se suben como `DataTexture` con `flipY = true`
(misma orientación que el canvas de los generadores).
`@code src/engine/texturePool.ts#texturePool` `@code src/engine/MaterialLibrary.ts#build` `@manual`

### MAT-006 · Materiales compartidos
Un material three por id (caché). Mientras su textura llega se ve el color base. Al aplicar mapas:
color del material = blanco y `roughness = base·255/128` (el mapa codifica 0.5 = base). Las
instancias emisivas de lámparas usan `unique()` (clon por pieza).
`@code src/engine/MaterialLibrary.ts#get` `@code src/engine/MaterialLibrary.ts#apply` `@code src/engine/MaterialLibrary.ts#unique` `@manual`

### MAT-007 · Muestras (swatches)
Las muestras de la UI se generan en los workers (96 px; 256 px para suelos/paredes mostrando
0.9 m del material; 128 px las `stretch`) con un degradado que distingue brillo/metal, y se cachean.
`@code src/engine/MaterialLibrary.ts#materialSwatch` `@code src/ui/Swatch.tsx#useSwatch` `@manual`

### MAT-008 · Precarga mínima
Antes de mostrar la app se precargan sólo los materiales del documento actual y del exterior; el
resto se carga bajo demanda (progresivo).
`@code src/engine/Engine.ts#preload` `@code src/engine/MaterialLibrary.ts#flush` `@manual`
