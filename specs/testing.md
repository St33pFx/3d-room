# Estrategia de pruebas

| Nivel | Dónde | Cómo | Etiquetado |
|---|---|---|---|
| Unit (puro) | `tests/*.test.ts` | `npm test` (vitest, Node) | `it('[ID] …')` |
| Trazabilidad | `scripts/check-specs.mjs` | `npm run spec:check` | anclas `@…` en specs |
| Interacción | `scripts/e2e.mjs` | `npm run dev` + `npm run test:e2e` | `check('[ID] …')` |
| Visual | `scripts/shot.mjs` | captura PNG y revisión | `@manual` |

`npm run verify` = typecheck + unit + spec:check + build (gate obligatorio antes de commit).

## Entorno de navegador (CI / contenedor)
- Chromium headless con WebGL por software (SwiftShader): **muy lento** (0.05–0.1 fps). No esperar
  al bucle de render: pausar y forzar frames.
- Ganchos (sólo para tests, ARCH-003): `window.__engine.paused = true` detiene el bucle;
  `__engine.settle()` sincroniza documento, luz, sonda y dibuja un frame; `screenOf(id)` /
  `screenPoint(x,y,z)` dan coordenadas de pantalla; `validate()` lista piezas que intersectan;
  `window.__store` es el store zustand.
- `?fixedpr=1` fija el *pixel ratio* (resolución adaptativa desactivada).
- Una sesión nueva siempre muestra la bienvenida: `__store.getState().setUI({ onboarding: false })`.

## Capturas
```
node scripts/shot.mjs "?fixedpr=1" screenshots/x.png <espera ms> <ancho> <alto> "<js>" ["<js>" …]
# ej.: hora y cámara de cine
node scripts/shot.mjs "?fixedpr=1" screenshots/cine.png 300 1440 900 \
  "window.__store.getState().setUI({onboarding:false}); window.__store.getState().setEnv({time:19})" \
  "window.__store.getState().setCamera({mode:'cinematic',shot:0}); window.__engine.rig.playShot(0,false)"
```
Cada captura cuesta 10–30 s; `URL=http://localhost:4173/` apunta al build (`npx vite preview`).
`screenshots/` está en `.gitignore`. La portada del README es `docs/atelier.png`.

## Qué probar al cambiar…
- `core/placement.ts` → unit con el ID + `npm run test:e2e` (arrastres reales).
- Catálogo → actualizar la tabla de CAT-006 (el test la compara con el código) + captura de la miniatura.
- Luz/render → capturas a 9 h, 17 h, 21 h en maqueta y en Cine.
- UI → e2e + captura escritorio (1440×900) y móvil (390×844).
