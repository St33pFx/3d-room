# Glosario

| Término | Significado | En código |
|---|---|---|
| Pieza | Instancia de un tipo del catálogo en el diseño | `ItemInstance` |
| Tipo | Entrada del catálogo (sofá, jarrón…) | `ItemDef.type` |
| Variante | Tamaño alternativo de un tipo | `ItemInstance.variant` → `ItemDef.variants[i]` |
| Ranura | Parte de una pieza con material propio (tapicería, patas…) | `MaterialSlot` |
| Acabado | Material de una superficie arquitectónica | `RoomFinishes` |
| Colocación | Dónde vive una pieza: suelo, alfombra, pared, superficie, techo | `PlacementKind` |
| Pieza raíz / apoyada | Sin `parentId` / sobre la superficie de otra | `parentId` |
| Pose | Posición mundo + giro Y resultante | `Pose`, `worldPose` |
| Colisionador / caja | Rectángulo orientado en planta con banda vertical | `Collider`, `Box` |
| MTV | Vector mínimo de separación (SAT) | `overlapMTV` |
| Obstáculos | Cajas que una pieza no puede invadir | `obstacles` |
| Zona de paso | Área libre obligatoria frente a puertas | `doorClearances` |
| Gesto | Edición continua que cuenta como un paso de historial | `beginGesture`/`endGesture` |
| Snapping inteligente | Enrasado a muros + guías de alineación (+ orientación al colocar) | `SnapMode 'smart'` |
| Guía | Segmento que muestra una alineación activa | `Guide` |
| Cota | Distancia en vivo a la pared más cercana | `updateMeasures` |
| Recorte (cutaway) | Ocultar muros/techo que tapan la vista de maqueta | `updateCutaway` |
| Fantasma | Material invisible que aún proyecta sombra | `ghost()` |
| Sonda de entorno | Captura cúbica del interior usada como luz de rebote | `EnvironmentProbe` |
| u (pared) | Coordenada a lo largo de una pared desde su origen | `worldToWall` |
| Plantilla | Documento de partida | `createPreset`, `PRESETS` |
| Vista guardada | Marcador de cámara dentro del documento | `CameraBookmark` |
