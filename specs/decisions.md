# Decisiones (ADR)

Registro inmutable. Para cambiar una decisión se añade una nueva que la sustituya
(`Sustituye: ADR-00X`). Formato: contexto → decisión → consecuencias.

## ADR-001 · three.js imperativo + React sólo para UI
Contexto: control fino del bucle, post-proceso y picking. Decisión: sin react-three-fiber; `Engine`
imperativo suscrito al store; React sólo paneles. Consecuencia: la UI usa una API pequeña del motor
(ARCH-003); no hay objetos three en React.

## ADR-002 · Reglas puras en `core/`
Decisión: colocación, colisiones, catálogo y persistencia sin dependencias de render. Consecuencia:
testeables en Node; motor, teclado e inspector comparten reglas (ARCH-001, PLC-*).

## ADR-003 · Documento inmutable + historial por referencias
Decisión: cada edición crea un `DesignDoc` nuevo; historial = pila de documentos (120). Gestos para
arrastres. Consecuencia: deshacer trivial y fiable; cuidado de no mutar (DOC-001, HIST-*).

## ADR-004 · Colisión 2.5D (OBB + banda vertical) en vez de física 3D
Decisión: rectángulos orientados en planta con bandas de altura por colisionador. Consecuencia:
exacto para muebles, barato, permite meter sillas bajo mesas y colgar cuadros sobre sofás (PLC-001).

## ADR-005 · Sin assets: todo procedural y determinista
Decisión: modelos por código (`builders.ts`) y texturas sintetizadas (`textures.ts`) con semilla.
Consecuencia: funciona offline, ~570 KB; añadir piezas = escribir un builder (CAT-007).

## ADR-006 · Arquitectura fija de la estancia
Decisión: una sala-comedor fija con vanos reales; el producto se centra en amueblar y acabar.
Consecuencia: reglas de pared/puertas simples; editar planta sería un cambio mayor (nueva spec).

## ADR-007 · Luz: sol con sombras + `RectAreaLight` por ventana + sonda interior
Decisión: sin GI real; una sonda cúbica del propio interior (PMREM) da el rebote teñido por los
acabados; el jardín usa un entorno sólo de cielo. Consecuencia: luz creíble y barata; la sonda es
global (no depende de la posición) y se recaptura con *throttling* (LIGHT-005/006).

## ADR-008 · Muros recortados como "fantasma" que proyecta sombra
Decisión: material sin escritura de color/profundidad en lugar de `visible=false`. Consecuencia: la
luz del sol no entra por muros ocultos; las capas/visibilidad de three no sirven porque el mapa de
sombras usa las capas de la cámara principal (CAM-008).

## ADR-009 · Resaltado por fresnel propio, no `OutlineEffect`
Contexto: `OutlineEffect` de postprocessing no producía contorno en este pipeline (los fantasmas
escriben profundidad en su pre-pase). Decisión: `Highlight` con un clon de la geometría y shader de
borde. Consecuencia: robusto, barato, sin pases extra (RND-003).

## ADR-010 · Texturas en Web Workers como `DataTexture`
Decisión: pool de workers, buffers transferidos, `flipY = true`. Consecuencia: arranque ~5× más
rápido y sin bloqueos; los generadores DEBEN funcionar sin DOM (OffscreenCanvas) (MAT-005).

## ADR-011 · Tone mapping ACES Filmic
Contexto: AgX dejaba la imagen lavada y verdosa con este rig de luces. Decisión: ACES + grade cálido.
Consecuencia: contraste tipo fotografía de interiores (RND-001, LIGHT-008).

## ADR-012 · Interfaz en español, código en inglés
Decisión: producto para hispanohablantes; identificadores en inglés por convención. Consecuencia:
textos de UI y etiquetas de historial en español (UI-001).

## ADR-013 · Spec-anchored SDD
Decisión: las specs con IDs y anclas son la fuente de verdad; `spec:check` en cada commit.
Consecuencia: todo cambio de comportamiento empieza en `specs/` (constitución I).
