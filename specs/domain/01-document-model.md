# DOC — Modelo de documento

Estado: vigente · Código: `src/core/types.ts`, `src/state/store.ts`

El diseño es un `DesignDoc` de datos planos (JSON). Todo lo que el usuario edita y se guarda
está aquí, salvo el entorno (`EnvironmentState`), que viaja junto al documento pero fuera del historial.

```ts
DesignDoc   { version: 1; name; finishes: RoomFinishes; items: ItemInstance[]; bookmarks: CameraBookmark[] }
ItemInstance{ id; type; position: Vec3; rotation; materials: {slot→materialId}; variant?; wall?; parentId?; dimmer?; locked? }
RoomFinishes{ floor; walls: {north,south,east,west}; ceiling; trim; frames }   // ids de material
EnvironmentState { time 0..24; orientation (°); lampMode 'auto'|'on'|'off'; exposure }
```

### DOC-001 · Documento serializable
`DesignDoc` DEBE ser serializable con `JSON.stringify` sin pérdida (sin clases, funciones ni
referencias a three.js) y llevar `version: 1`.
`@code src/core/types.ts#DesignDoc` `@test tests/store.test.ts`

### DOC-002 · Semántica de `ItemInstance`
- `position` es **mundo** para piezas raíz y **local al padre** cuando hay `parentId`.
- `rotation` es el giro en Y (rad), local al padre si lo hay.
- `materials` asigna cada ranura del catálogo a un id de material.
- `variant` indexa `ItemDef.variants` (tamaños). `wall` sólo en piezas de pared.
- `dimmer` ∈ [0, 1.5] (sólo lámparas). `locked` impide mover/girar.
`@code src/core/types.ts#ItemInstance` `@code src/core/placement.ts#worldPose` `@test tests/placement.test.ts`

### DOC-003 · Un solo nivel de anidamiento
Sólo piezas `surface` pueden tener `parentId`, y su padre DEBE ser una pieza raíz. Al eliminar o
duplicar un padre, sus hijos le acompañan.
`@code src/core/placement.ts#descendants` `@code src/engine/Interaction.ts#candidate` `@test tests/store.test.ts`

### DOC-004 · Identificadores
Los ids DEBEN ser únicos en el documento y generarse con `newId(prefijo)`.
`@code src/core/presets.ts#newId` `@test tests/store.test.ts`

### DOC-005 · Entorno fuera del documento
`EnvironmentState` NO DEBE formar parte de `DesignDoc` ni del historial; se guarda junto al
documento en autoguardado, proyectos y exportación.
`@code src/core/types.ts#EnvironmentState` `@code src/core/persistence.ts#AutosaveData` `@test tests/store.test.ts`

### DOC-006 · Plantillas
`createPreset(id)` DEBE devolver documentos válidos: `casa-luz` (por defecto), `nogal-noche`,
`terracota` (mismo layout, distintos acabados/materiales) y `empty`. Ranuras desconocidas se eliminan.
`@code src/core/presets.ts#createPreset` `@code src/core/presets.ts#PRESETS` `@test tests/placement.test.ts`
