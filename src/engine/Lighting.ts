import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { ROOM, type Opening, type WallSpec, wallToWorld } from '../core/room';
import type { EnvironmentState } from '../core/types';

// Time-of-day lighting: physically based sky, sun/moon with soft shadows,
// skylight through each window (rect area lights), and the shared "daylight"
// state that drives exposure, fog and the lamps' automatic switching.

export interface SunState {
  dir: THREE.Vector3; // towards the sun
  elevation: number; // radians
  daylight: number; // 0 night .. 1 full day
  golden: number; // 0..1 warmness near sunrise/sunset
  lampFactor: number; // 0..1 for auto lamps
  night: number; // 0..1
}

export function kelvinToRGB(k: number): THREE.Color {
  const t = k / 100;
  let r: number;
  let g: number;
  let b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const c = (v: number) => Math.min(1, Math.max(0, v / 255));
  return new THREE.Color().setRGB(c(r), c(g), c(b), THREE.SRGBColorSpace);
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const BASE_ORIENTATION = 40;

/** Pure sun model. Exported for UI (sun dial) and tests. */
export function computeSun(time: number, orientationDeg: number): SunState {
  const rise = 6.4;
  const set = 20.1;
  const frac = (time - rise) / (set - rise);
  const maxElev = THREE.MathUtils.degToRad(64);
  const elevation = maxElev * Math.sin(Math.PI * frac);
  const phi = Math.PI * Math.min(1.15, Math.max(-0.15, frac));
  // East = -X, South = -Z (behind the windowed back wall)
  const east = new THREE.Vector3(-1, 0, 0);
  const south = new THREE.Vector3(0, 0, -1);
  const h = east.multiplyScalar(Math.cos(phi)).add(south.multiplyScalar(Math.sin(phi)));
  // The flat faces roughly south-west by default so the evening sun rakes
  // through the back windows; users can rotate the compass on top of that.
  h.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(orientationDeg + BASE_ORIENTATION));
  const dir = new THREE.Vector3(h.x * Math.cos(elevation), Math.sin(elevation), h.z * Math.cos(elevation)).normalize();
  const s = Math.sin(elevation);
  const daylight = smooth(-0.1, 0.35, s);
  const golden = daylight > 0 ? 1 - smooth(0.05, 0.42, s) : 0;
  const lampFactor = 1 - smooth(0.02, 0.26, s);
  const night = 1 - smooth(-0.22, 0.02, s);
  return { dir, elevation, daylight, golden, lampFactor, night };
}

const STAR_VERT = /* glsl */ `
  attribute float size;
  varying float vBright;
  void main() {
    vBright = size;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_Position.z = gl_Position.w * 0.99999;
    gl_PointSize = size * 2.2;
  }
`;
const STAR_FRAG = /* glsl */ `
  uniform float opacity;
  varying float vBright;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.0, length(c));
    gl_FragColor = vec4(vec3(0.75, 0.82, 1.0) * vBright * 1.4, a * opacity);
  }
`;

export class Lighting {
  readonly group = new THREE.Group();
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly sky: Sky;
  readonly stars: THREE.Points;
  readonly windowLights: THREE.RectAreaLight[] = [];
  state: SunState = computeSun(14, 0);
  private skyTime = 0;
  /** Sky-only scene used to light the garden (never sees the interior). */
  readonly skyScene = new THREE.Scene();
  private skyPmrem: THREE.PMREMGenerator | null = null;
  private skyRT: THREE.WebGLRenderTarget | null = null;
  private skyCubeRT = new THREE.WebGLCubeRenderTarget(64, { type: THREE.HalfFloatType });
  private skyCubeCam = new THREE.CubeCamera(1, 1000, this.skyCubeRT);
  skyEnv: THREE.Texture | null = null;

  constructor(openings: { wall: WallSpec; opening: Opening }[]) {
    RectAreaLightUniformsLib.init();
    this.group.name = 'lighting';

    this.sky = new Sky();
    this.sky.scale.setScalar(2000);
    this.sky.frustumCulled = false;
    const u = this.sky.material.uniforms;
    u.turbidity.value = 3.2;
    u.rayleigh.value = 1.4;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.8;
    if (u.cloudCoverage) u.cloudCoverage.value = 0.32;
    if (u.cloudDensity) u.cloudDensity.value = 0.45;
    this.group.add(this.sky);
    const envSky = new THREE.Mesh(this.sky.geometry, this.sky.material);
    envSky.scale.setScalar(500);
    this.skyScene.add(envSky);

    // stars
    const n = 1400;
    const pos = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const y = rnd() * 0.95 + 0.05;
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(a) * r * 900, y * 900, Math.sin(a) * r * 900], i * 3);
      sizes[i] = Math.pow(rnd(), 3) * 1.6 + 0.4;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    this.stars = new THREE.Points(
      sg,
      new THREE.ShaderMaterial({
        vertexShader: STAR_VERT,
        fragmentShader: STAR_FRAG,
        uniforms: { opacity: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.stars.frustumCulled = false;
    this.group.add(this.stars);

    this.sun = new THREE.DirectionalLight('#fff3e0', 3);
    this.sun.castShadow = true;
    const sh = this.sun.shadow;
    sh.mapSize.set(4096, 4096);
    sh.camera.left = -6.2;
    sh.camera.right = 6.2;
    sh.camera.top = 6.2;
    sh.camera.bottom = -6.2;
    sh.camera.near = 1;
    sh.camera.far = 60;
    sh.bias = -0.00025;
    sh.normalBias = 0.025;
    sh.radius = 3.5;
    this.group.add(this.sun);
    this.group.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight('#dfe9ff', '#b59b7c', 0.25);
    this.group.add(this.hemi);

    // Skylight entering through each opening.
    for (const { wall, opening } of openings) {
      if (opening.kind === 'door') continue;
      const light = new THREE.RectAreaLight('#dfe8ff', 1, opening.width - 0.08, opening.height - 0.08);
      const [x, z] = wallToWorld(wall, opening.u, 0.02);
      light.position.set(x, opening.sill + opening.height / 2, z);
      const [tx, tz] = wallToWorld(wall, opening.u, 2);
      light.lookAt(tx, opening.sill + opening.height / 2 - 0.6, tz);
      light.userData.area = opening.width * opening.height;
      this.windowLights.push(light);
      this.group.add(light);
    }
  }

  setShadowQuality(high: boolean) {
    const size = high ? 4096 : 2048;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null as unknown as THREE.WebGLRenderTarget;
    }
  }

  update(env: EnvironmentState, dt: number) {
    const st = computeSun(env.time, env.orientation);
    this.state = st;
    const { dir, daylight, golden, night } = st;
    const s = Math.sin(st.elevation);

    // Sky
    const u = this.sky.material.uniforms;
    const skyDir = dir.clone();
    if (skyDir.y < -0.12) skyDir.y = -0.12; // keep a faint afterglow
    u.sunPosition.value.copy(skyDir);
    u.rayleigh.value = 1.2 + golden * 2.2;
    u.turbidity.value = 2.8 + golden * 4;
    this.skyTime += dt;
    if (u.time) u.time.value = this.skyTime;
    (this.stars.material as THREE.ShaderMaterial).uniforms.opacity.value = night * 0.9;

    // Sun (or moon at night) — one shadow-casting light that fades through twilight.
    const center = new THREE.Vector3(0, 1.0, 0);
    if (s > -0.06) {
      const intensity = 6.0 * Math.pow(smooth(0.0, 0.5, s), 0.7);
      this.sun.intensity = intensity;
      const k = 2100 + 3600 * smooth(0.0, 0.55, s);
      this.sun.color.copy(kelvinToRGB(k));
      this.sun.position.copy(center).addScaledVector(dir, 25);
    } else {
      // Moonlight: cool, dim, from high in the sky opposite the setting sun.
      const moonDir = new THREE.Vector3(-dir.x, 0.55, -dir.z).normalize();
      this.sun.intensity = 0.32 * night;
      this.sun.color.set('#9db4ff');
      this.sun.position.copy(center).addScaledVector(moonDir, 25);
    }
    this.sun.target.position.copy(center);

    // Ambient: subtle hemisphere tinted by the sky.
    const skyCol = new THREE.Color('#cfe0ff').lerp(new THREE.Color('#ffc59a'), golden * 0.7).lerp(new THREE.Color('#1c2744'), night);
    this.hemi.color.copy(skyCol);
    this.hemi.groundColor.set('#a68d70').lerp(new THREE.Color('#151311'), night);
    this.hemi.intensity = 0.03 + 0.1 * daylight + 0.06 * night;

    // Window skylight
    const winCol = new THREE.Color('#e3ecff').lerp(new THREE.Color('#ffd2a8'), golden * 0.8).lerp(new THREE.Color('#3a4a78'), night);
    for (const l of this.windowLights) {
      l.color.copy(winCol);
      l.intensity = 0.1 + 2.6 * daylight;
    }
  }

  /** Prefilter the sky alone (no sun disc) for exterior image based lighting. */
  updateSkyEnv(renderer: THREE.WebGLRenderer) {
    if (!this.skyPmrem) this.skyPmrem = new THREE.PMREMGenerator(renderer);
    const u = this.sky.material.uniforms;
    const disc = u.showSunDisc?.value ?? 1;
    if (u.showSunDisc) u.showSunDisc.value = 0;
    this.skyCubeCam.update(renderer, this.skyScene);
    const rt = this.skyPmrem.fromCubemap(this.skyCubeRT.texture, this.skyRT);
    if (u.showSunDisc) u.showSunDisc.value = disc;
    this.skyRT = rt;
    this.skyEnv = rt.texture;
  }

  /** Exposure compensation so nights read as nights but stay legible. */
  exposureFor(env: EnvironmentState): number {
    const st = this.state;
    return env.exposure * (1.0 + st.night * 0.25 + (1 - st.daylight) * 0.15);
  }

  /** Fog/horizon colour for distant exterior elements. */
  horizonColor(): THREE.Color {
    const st = this.state;
    return new THREE.Color('#c9d6e3').lerp(new THREE.Color('#e5b48f'), st.golden * 0.7).lerp(new THREE.Color('#0d1322'), st.night);
  }
}

/** Interior environment probe: cube capture of the room, prefiltered. */
export class EnvironmentProbe {
  private cubeRT: THREE.WebGLCubeRenderTarget;
  private cubeCam: THREE.CubeCamera;
  private pmrem: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget | null = null;
  texture: THREE.Texture | null = null;

  constructor(private renderer: THREE.WebGLRenderer) {
    this.cubeRT = new THREE.WebGLCubeRenderTarget(192, { type: THREE.HalfFloatType, generateMipmaps: false });
    this.cubeCam = new THREE.CubeCamera(0.05, 3000, this.cubeRT);
    this.cubeCam.position.set(0, 1.35, 0.2);
    this.cubeCam.layers.set(0);
    this.pmrem = new THREE.PMREMGenerator(renderer);
  }

  capture(scene: THREE.Scene) {
    const prevEnv = scene.environment;
    this.cubeCam.update(this.renderer, scene);
    const rt = this.pmrem.fromCubemap(this.cubeRT.texture, this.envRT ?? undefined);
    this.envRT = rt;
    this.texture = rt.texture;
    scene.environment = this.texture;
    void prevEnv;
  }

  get height(): number {
    return ROOM.height;
  }
}
