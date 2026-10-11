# Deuda conocida y discrepancias abiertas

Cada entrada: síntoma · causa probable · requisito afectado · siguiente paso.

- **KI-1 · Aviso `GL_INVALID_OPERATION: glTexStorage2D: Texture is immutable`** (una vez al arrancar,
  SwiftShader). Sin efecto visible. Probable reasignación de un render target (PMREM/N8AO). RND-001.
  Investigar con WebGL inspector en GPU real.
- **KI-2 · Doble motor en desarrollo**: `React.StrictMode` monta `App` dos veces; el primer `Engine`
  se destruye pero sus peticiones de textura siguen en el pool. Sólo `npm run dev`. PERF-001.
  Siguiente paso: cancelar trabajos del pool al `dispose`.
- **KI-3 · Miniaturas sin tone mapping**: el render a target no aplica tone mapping; se compensa con
  luces suaves. CAT-009. Aceptado.
- **KI-4 · Sonda de entorno global**: el rebote no depende de la posición (una sola sonda). LIGHT-005.
  Aceptado por coste (ADR-007).
- **KI-5 · Rendimiento en GPU real sin medir**: sólo se ha medido en SwiftShader. PERF-*.
  Siguiente paso: medir fps en GPU integrada y dedicada y fijar presupuestos.
- **KI-6 · Sin tests de unidad del motor 3D**: builders, cutaway y luz se verifican visualmente
  (`@manual`). Aceptado; candidato a pruebas de captura con referencia.
- **KI-7 · Pantallas táctiles**: arrastrar desde la biblioteca en móvil compite con el scroll de la
  rejilla (`touch-action: none` en tarjetas). UI-010 / EDIT-005. Pendiente de revisar en dispositivo.
