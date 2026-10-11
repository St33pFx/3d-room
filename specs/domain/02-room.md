# ROOM — Estancia y jardín

Estado: vigente · Código: `src/core/room.ts`, `src/engine/RoomShell.ts`

La arquitectura es fija (el producto trata de amueblar y acabar un espacio). Ejes: X ancho,
Z fondo, Y arriba; origen en el centro del suelo. Brújula: **Este = −X**, **Sur = −Z**.

| Pared (id) | Etiqueta UI | Cara interior | Vanos |
|---|---|---|---|
| `north` | Pared del fondo | z = −2.8 | `win-a` ventana u 2.1 (2.4×1.56, alféizar 0.84) · `win-b` ventana u 5.75 (1.3×1.98, alféizar 0.42) |
| `east` | Pared derecha | x = +3.6 | `entry-door` puerta u 4.6 (0.92×2.12) |
| `south` | Pared frontal | z = +2.8 | — |
| `west` | Pared izquierda | x = −3.6 | `garden-door` puerta vidriera u 3.85 (1.5×2.4) |

### ROOM-001 · Dimensiones
Interior 7.2 × 5.6 m, altura 2.85 m, muros de 0.18 m, rodapié 0.09 m.
`@const src/core/room.ts#width=7.2` `@const src/core/room.ts#depth=5.6` `@const src/core/room.ts#height=2.85` `@const src/core/room.ts#wallThickness=0.18` `@manual`

### ROOM-002 · Sistema de coordenadas de pared
Cada pared define `origin` (u = 0 en la cara interior), `dir` (u creciente) y `normal` (hacia
dentro). `wallToWorld`/`worldToWall` convierten (u, separación) ↔ XZ. Una pieza con giro
`wallFacingRotation(w)` mira hacia el interior (su +Z local = normal).
`@code src/core/room.ts#WALLS` `@code src/core/room.ts#wallToWorld` `@code src/core/room.ts#worldToWall` `@code src/core/room.ts#wallFacingRotation` `@test tests/placement.test.ts`

### ROOM-003 · Paso de puertas libre
Delante de cada puerta y puerta vidriera existe una zona de paso (ancho del vano + 0.04 m por lado,
fondo 0.95·ancho en puertas y 0.7 m en vidrieras, altura 2.1 m) que las piezas de suelo NO DEBEN ocupar.
`@code src/core/room.ts#doorClearances` `@code src/core/placement.ts#obstacles` `@test tests/placement.test.ts`

### ROOM-004 · Envolvente con vanos reales
Muros extruidos con huecos reales; `north`/`south` se prolongan sobre las esquinas (estanqueidad).
Carpintería: ventanas de acero esbelto con montantes y alféizar interior, vidriera con tiradores,
puerta de dos cuarterones con manilla. Rodapiés interrumpidos en las puertas. Losa estructural con
cara superior a −0.03 m (sin z-fighting).
`@code src/engine/RoomShell.ts#buildWall` `@code src/engine/RoomShell.ts#buildJoinery` `@manual`

### ROOM-005 · Acabados de la envolvente
Suelo, cada pared, techo, rodapiés/puertas (`trim`) y carpintería (`frames`) toman su material de
`doc.finishes`. Cambiar un acabado NO DEBE reactivar superficies recortadas (techo/muros ocultos).
`@code src/engine/RoomShell.ts#setFinishes` `@e2e`

### ROOM-006 · Jardín
Exterior visible por los vanos: césped (r 90 m), tarima frente a la vidriera, losa perimetral,
9 árboles cercanos, línea de 46 árboles a 34–46 m, seto a z ≈ −12.5. Iluminado sólo por el entorno
del cielo (ver LIGHT-007), con niebla hacia el horizonte.
`@code src/engine/RoomShell.ts#buildExterior` `@code src/engine/RoomShell.ts#EXTERIOR_MATERIALS` `@manual`
