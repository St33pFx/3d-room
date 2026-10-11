# Constitución de Atelier

Principios no negociables del proyecto. Cualquier cambio que viole uno de estos artículos
requiere primero enmendar esta constitución (PR propio, motivo explícito).
Las specs (`specs/`) concretan estos principios; el código los implementa.

## I. La spec es la fuente de verdad
1. El comportamiento del producto está definido en `specs/`. El código es una implementación de
   las specs, no al revés.
2. Ningún comportamiento observable se añade, cambia o elimina sin actualizar antes su spec
   (requisito con ID) en el mismo cambio.
3. Si código y spec discrepan, es un bug en uno de los dos: se decide cuál es correcto, se corrige
   y se deja registrado (spec actualizada o `specs/known-issues.md`).
4. `npm run spec:check` debe pasar en cada commit. Anclas rotas = build roto.

## II. Núcleo puro, motor imperativo, UI declarativa
1. `src/core/` no importa `three`, React ni el DOM. Toda regla de negocio (colocación, colisiones,
   catálogo, persistencia) vive ahí y es testeable en Node.
2. `src/engine/` (three.js) sólo *lee* el store y llama a funciones de `core`. Nunca decide reglas.
3. `src/ui/` (React) habla con el store y con un puñado de métodos imperativos del `Engine`.
   React nunca toca objetos de three.js.

## III. Documento inmutable, historial completo
1. `DesignDoc` es datos planos serializables. Cada edición produce un documento nuevo.
2. Toda edición del usuario es deshacible. Un gesto continuo (arrastre, deslizador) es un único paso.
3. El estado de entorno (hora, lámparas, exposición) no forma parte del historial.

## IV. Nada atraviesa nada
1. Ninguna pieza bloqueante puede quedar intersectando paredes, otras piezas o el paso de puertas
   en un documento confirmado. Las plantillas lo cumplen y está cubierto por tests.
2. Si una operación no puede cumplirlo, se rechaza con feedback (toast/estado rojo) o vuelve a la
   última posición válida. Nunca se "fuerza".

## V. Sin assets externos
1. Geometría, texturas, miniaturas y entorno se generan proceduralmente y de forma determinista.
2. La app funciona offline. No se añaden dependencias de red en runtime.

## VI. Producto, no demo
1. Interfaz en español (es-ES); identificadores y comentarios de código en inglés.
2. Toda acción tiene feedback visible (toast, resaltado, guía, cota) y atajo cuando tiene sentido.
3. El lenguaje visual (tokens CSS en `src/styles/app.css`) es único; no se introducen estilos ad hoc.
4. Escritorio y móvil son ambos soportados.

## VII. Verificación antes de dar por hecho
1. Cambios en `core` → test unitario con el ID del requisito en el título (`[PLC-004] …`).
2. Cambios de interacción → comprobación en `scripts/e2e.mjs` con el ID.
3. Cambios visuales → captura con `scripts/shot.mjs` revisada antes de cerrar.
4. Gates: `npm run typecheck`, `npm test`, `npm run spec:check`, `npm run build`; e2e para
   interacción.

## VIII. Economía de contexto
1. Leer primero `CLAUDE.md` → `specs/README.md` → la spec del dominio → sólo los símbolos anclados.
2. No leer archivos completos de más de ~300 líneas; buscar el símbolo anclado.
3. Las specs son concisas: requisitos verificables, no prosa. Las decisiones van en
   `specs/decisions.md`, no repetidas en cada spec.
