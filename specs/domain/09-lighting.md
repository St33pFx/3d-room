# LIGHT — Hora del día e iluminación

Estado: vigente · Código: `src/engine/Lighting.ts`, `src/engine/Engine.ts`, `src/engine/ItemLayer.ts`

Objetivo de producto: luz **creíble** a cualquier hora (manchas de sol con sombra de la carpintería,
rebote interior teñido por los acabados, noches íntimas con lámparas) a coste de tiempo real.

### LIGHT-001 · Modelo solar
`computeSun(time, orientation)`: salida 6.4 h, puesta 20.1 h, elevación máx. 64°,
`elev = max·sin(π·frac)`. Acimut de Este (−X) a Sur (−Z, tras la pared del fondo) a Oeste (+X),
girado `orientation + 40°` (la vivienda mira al suroeste para que el atardecer entre por las ventanas).
Derivados con *smoothstep* sobre `s = sin(elev)`: `daylight` (−0.1…0.35), `golden`, `lampFactor`
(1 − smooth(0.02…0.26)), `night` (1 − smooth(−0.22…0.02)).
`@const src/engine/Lighting.ts#rise=6.4` `@const src/engine/Lighting.ts#set=20.1` `@const src/engine/Lighting.ts#BASE_ORIENTATION=40` `@code src/engine/Lighting.ts#computeSun` `@test tests/lighting.test.ts`

### LIGHT-002 · Cielo
Cielo físico (`three/examples Sky`, Preetham) con nubes animadas; `rayleigh` y `turbidity` suben en
hora dorada; el sol bajo el horizonte se limita a −0.12 para conservar el resplandor. Estrellas
(1 400) con opacidad ∝ `night`.
`@code src/engine/Lighting.ts#update` `@manual`

### LIGHT-003 · Sol y luna
Una sola `DirectionalLight` con sombras (mapa 4096 en calidad alta / 2048 equilibrada, PCF radio 3.5,
caja ±6.2 m centrada en la estancia). Día: intensidad `7.5·smooth(0, 0.5, s)^0.7`, color
2100→5700 K. Noche (s < −0.06): luna `0.32·night`, `#9db4ff`, desde lo alto.
`@code src/engine/Lighting.ts#update` `@code src/engine/Lighting.ts#setShadowQuality` `@manual`

### LIGHT-004 · Luz de cielo por las ventanas
Cada vano que no es puerta tiene una `RectAreaLight` del tamaño del vano, mirando al interior,
intensidad `0.1 + 3.6·daylight`, color neutro → cálido (dorada) → azul (noche). Hemisférica tenue
`0.03 + 0.1·daylight + 0.06·night`.
`@code src/engine/Lighting.ts#windowLights` `@manual`

### LIGHT-005 · Rebote interior (sonda)
Una cámara cúbica (192 px, HalfFloat) en (0, 1.35, 0.2) captura la estancia con todos los muros,
techo y piezas visibles y sin niebla; se prefiltra (PMREM) como `scene.environment` con intensidad
`0.5 + 0.2·daylight`. Se recaptura al cambiar documento, entorno o al llegar texturas: cada ≥ 120 ms
(≥ 260 ms en time-lapse), nunca durante un gesto; dos capturas al arrancar.
`@code src/engine/Lighting.ts#EnvironmentProbe` `@code src/engine/Engine.ts#captureEnv` `@manual`

### LIGHT-006 · Exterior iluminado por el cielo
Los materiales del jardín usan un entorno propio del cielo (cubo 64 px sin disco solar), nunca la
sonda interior: intensidad 0.45 césped/follaje, 0.22 resto.
`@code src/engine/Lighting.ts#updateSkyEnv` `@code src/engine/Engine.ts#captureEnv` `@manual`

### LIGHT-007 · Lámparas
`lampMode`: `auto` (factor = `lampFactor`), `on` (1), `off` (0). Por pieza: luz = intensidad base ·
factor · `dimmer`; emisivo de bombilla `9·f`, pantallas `2.6·f·glowBase`. Las luces de lámpara no
proyectan sombra.
`@code src/engine/ItemLayer.ts#applyLamp` `@code src/engine/ItemLayer.ts#setLampFactor` `@manual`

### LIGHT-008 · Exposición y gradación
Exposición `env.exposure·(0.95 + 0.15·night + 0.1·(1−daylight))`; calidez del grade
`0.55 + 0.5·golden − 0.4·night`; niebla (22–85 m) con el color del horizonte.
`@code src/engine/Lighting.ts#exposureFor` `@code src/engine/Lighting.ts#horizonColor` `@manual`

### LIGHT-009 · Paso del día
El time-lapse avanza 1.6 h por segundo y da la vuelta a las 24 h; mover el deslizador lo detiene.
`@code src/engine/Engine.ts#frame` `@code src/ui/Dock.tsx#Dock` `@manual`
