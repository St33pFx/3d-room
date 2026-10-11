# CAT — Catálogo y modelado procedural

Estado: vigente · Código: `src/core/catalog.ts` (datos), `src/engine/builders.ts` (geometría),
`src/engine/Thumbnails.ts`

### CAT-001 · Definición de pieza
Cada tipo es un `ItemDef` con: `type`, `name` (es), `category`, `placement`
(`floor|rug|wall|surface|ceiling`), `variants[]` (tamaños `[w,h,d]` en metros), `slots[]` de material
(categorías permitidas + defecto) y opcionalmente `colliders`, `surfaces`, `light`, `againstWall`,
`mountHeight`, `coversOpenings`, `price` (EUR), `designer`.
`@code src/core/catalog.ts#ItemDef` `@code src/core/catalog.ts#getDef` `@code src/core/catalog.ts#defaultMaterials` `@test tests/catalog.test.ts`

### CAT-002 · Marco local por tipo de colocación
- `floor`/`rug`/`surface`: origen en el centro de la base, +Z = frente.
- `wall`: origen en la cara del muro a media altura de la pieza; la pieza ocupa z ∈ [0, d].
- `ceiling`: origen en el punto de anclaje del techo; cuelga hacia −Y (y ∈ [−h, 0]).
`@code src/core/catalog.ts#colliders` `@test tests/placement.test.ts`

### CAT-003 · Colisionadores
Por defecto, un rectángulo del tamaño de la pieza con banda vertical completa. Colisionadores
propios para formas compuestas: chaise del sofá modular, lámpara de arco (base + pantalla en altura),
plantas (maceta + copa), cortinas (sólo paños laterales), y diseño "bajo mesa": sillas de comedor
con bloque de asiento hasta 0.68 m y mesas con banda de tablero en `[h−0.05, h]` + pie/patas.
`@code src/core/catalog.ts#colliders` `@test tests/placement.test.ts`

### CAT-004 · Superficies de apoyo
`surfaces(size)` devuelve rectángulos locales con altura `y` y `clearance` opcional (altura libre).
Tienen superficie: mesas, bancos, aparador, mueble TV, escritorio, librería (4 baldas a la derecha +
techo del mueble) y estante de pared.
`@code src/core/catalog.ts#surfaces` `@test tests/placement.test.ts`

### CAT-005 · Luces de lámpara
`light(size)` define fuente `point|spot`, posición local, intensidad, alcance y temperatura (K).
`@code src/core/catalog.ts#LightSpec` `@code src/engine/ItemLayer.ts#create` `@manual`

### CAT-006 · Inventario
El catálogo contiene exactamente estos 41 tipos (sup = superficie, luz, pared = `againstWall`,
col = colisionadores propios, vano = `coversOpenings`). Medidas en cm (an×al×fo) por variante.

| type | Nombre | Categoría | Colocación | Variantes | Ranuras | Flags |
|---|---|---|---|---|---|---|
| `sofa` | Sofá Arlo | seating | floor | 190×80×98 / 230×80×98 / 275×80×98 | upholstery, legs | pared |
| `sectional` | Sofá modular Dune | seating | floor | 290×74×170 / 330×74×190 | upholstery | pared col |
| `lounge-chair` | Butaca Hvile | seating | floor | 76×80×84 | frame, cushion |  |
| `tub-chair` | Butaca Pebble | seating | floor | 82×72×78 | upholstery, base |  |
| `dining-chair` | Silla Fika | seating | floor | 48×80×52 | frame, seat | col |
| `ottoman` | Puf Moon | seating | floor | 50×40×50 / 75×40×75 | upholstery |  |
| `bench` | Banco Linje | seating | floor | 120×45×38 / 160×45×38 | wood | sup pared |
| `coffee-round` | Mesa de centro Orbe | tables | floor | 90×36×90 / 110×36×110 | top, base | sup |
| `coffee-rect` | Mesa de centro Plano | tables | floor | 120×38×60 / 140×38×70 | wood, legs | sup |
| `side-table` | Mesa auxiliar Disco | tables | floor | 45×52×45 | top, base | sup |
| `dining-round` | Mesa de comedor Luna | tables | floor | 110×75×110 / 130×75×130 | top, base | sup col |
| `dining-rect` | Mesa Refectorio | tables | floor | 180×75×90 / 220×75×100 | top, legs | sup col |
| `desk` | Escritorio Atelier | tables | floor | 140×75×65 | top, frame | sup pared col |
| `bookshelf` | Librería Stack | storage | floor | 120×200×38 / 80×200×38 | wood, books | sup pared |
| `sideboard` | Aparador Mira | storage | floor | 160×72×46 / 200×72×46 | body, legs | sup pared |
| `media-console` | Mueble TV Low | storage | floor | 180×44×42 / 220×44×42 | body, fronts | sup pared |
| `arc-lamp` | Lámpara de arco Halo | lighting | floor | 40×205×155 | metal, base | luz col |
| `tripod-lamp` | Lámpara trípode Ojai | lighting | floor | 52×162×52 | wood, shade | luz |
| `table-lamp` | Lámpara de mesa Bulbo | lighting | surface | 30×48×30 | base, shade | luz |
| `pendant-globe` | Colgante Opal | lighting | ceiling | 35×95×35 / 50×105×50 | shade, metal | luz |
| `pendant-dome` | Colgante Cúpula | lighting | ceiling | 50×100×50 | shade | luz |
| `sconce` | Aplique Arc | lighting | wall | 18×30×22 | metal, shade | luz |
| `plant-fiddle` | Ficus lyrata | plants | floor | 70×155×70 / 85×195×85 | pot, leaf | col |
| `plant-olive` | Olivo en maceta | plants | floor | 75×165×75 | pot, leaf | col |
| `plant-snake` | Sansevieria | plants | floor | 38×90×38 | pot, leaf |  |
| `plant-small` | Pilea en maceta | plants | surface | 24×30×24 | pot, leaf |  |
| `vase-branches` | Jarrón con ramas | decor | surface | 30×75×30 | vase |  |
| `vase` | Ánfora | decor | surface | 20×24×20 / 22×38×22 | vase |  |
| `books` | Pila de libros | decor | surface | 30×13×24 | — |  |
| `bowl` | Cuenco de fruta | decor | surface | 34×14×34 | bowl |  |
| `candles` | Candelabros | decor | surface | 22×32×12 | metal |  |
| `sculpture` | Escultura Ola | decor | surface | 20×30×12 | material |  |
| `throw-blanket` | Manta de lana | decor | surface | 50×6×38 | fabric |  |
| `rug-rect` | Alfombra rectangular | rugs | rug | 230×1×160 / 300×1×200 / 350×1×250 | rug |  |
| `rug-round` | Alfombra redonda | rugs | rug | 160×1×160 / 200×1×200 / 250×1×250 | rug |  |
| `rug-runner` | Alfombra de pasillo | rugs | rug | 250×1×80 | rug |  |
| `art-frame` | Obra enmarcada | wall | wall | 70×100×4 / 120×80×4 / 100×130×4 / 40×50×3 | art, frame |  |
| `mirror-round` | Espejo Sol | wall | wall | 70×70×3 / 90×90×3 | frame |  |
| `wall-shelf` | Estante flotante | wall | wall | 80×4×24 / 120×4×24 | wood | sup |
| `curtains` | Cortinas de lino | wall | wall | 190×262×13 / 300×262×13 | fabric, rod | col vano |
| `tv` | Televisor 65" | wall | wall | 145×84×4 | — |  |

`@code src/core/catalog.ts#CATALOG_LIST` `@test tests/catalog.test.ts`

### CAT-007 · Todo tipo tiene modelo
Cada tipo DEBE tener builder en `BUILDERS`; si faltara, se muestra una caja neutra (nunca crashea).
`@code src/engine/builders.ts#BUILDERS` `@code src/engine/builders.ts#buildItem` `@test tests/catalog.test.ts`

### CAT-008 · Optimización y UV métricas
`finalize` hornea transformaciones, genera UV en metros por proyección de caja (veta = eje más
largo de cada parte, o `grain` explícito) salvo `keepUV`, y fusiona mallas por material.
Materiales emisivos (`glow`) son instancias propias por pieza. Vidrio/transparentes no proyectan sombra.
`@code src/engine/builders.ts#finalize` `@code src/engine/geo.ts#worldUVs` `@manual`

### CAT-009 · Miniaturas reales
Las miniaturas de la biblioteca se renderizan con los mismos builders (192 px, estudio neutro),
progresivamente en tiempo ocioso tras el arranque.
`@code src/engine/Thumbnails.ts#generateAll` `@manual`

### CAT-010 · Presupuesto
El presupuesto de la estancia es la suma de `price` de todas las piezas del documento (EUR, es-ES).
`@code src/ui/Inspector.tsx#RoomPanel` `@code src/ui/commands.ts#formatPrice` `@manual`
