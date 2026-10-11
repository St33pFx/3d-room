import * as THREE from 'three';

// Selection/hover highlight: a soft fresnel rim drawn on top of the piece's own
// surface (shares its geometry, so it follows every transform and never gaps).

const vert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const frag = /* glsl */ `
  uniform vec3 color;
  uniform float intensity;
  uniform float fill;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
    float rim = pow(f, 2.6);
    float a = clamp(rim * intensity + fill, 0.0, 1.0);
    gl_FragColor = vec4(color * a, 1.0);
  }
`;

function material(color: THREE.ColorRepresentation, intensity: number, fill: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: { color: { value: new THREE.Color(color) }, intensity: { value: intensity }, fill: { value: fill } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthFunc: THREE.LessEqualDepth,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    side: THREE.FrontSide,
  });
}

class Rim {
  private clones = new Map<THREE.Mesh, THREE.Mesh>();
  constructor(private mat: THREE.ShaderMaterial) {}

  set(meshes: THREE.Object3D[]) {
    const want = new Set(meshes.filter((m): m is THREE.Mesh => (m as THREE.Mesh).isMesh));
    for (const [src, clone] of this.clones) {
      if (!want.has(src) || clone.parent !== src) {
        clone.removeFromParent();
        this.clones.delete(src);
      }
    }
    for (const m of want) {
      if (this.clones.has(m)) continue;
      const c = new THREE.Mesh(m.geometry, this.mat);
      c.layers.set(1); // never captured by the environment probe
      c.renderOrder = 3;
      c.castShadow = false;
      c.receiveShadow = false;
      c.raycast = () => {};
      m.add(c);
      this.clones.set(m, c);
    }
  }

  setVisible(v: boolean) {
    for (const c of this.clones.values()) c.visible = v;
  }
}

export class Highlight {
  private selected = new Rim(material('#ff8a3d', 1.3, 0.03));
  private hovered = new Rim(material('#ffffff', 0.7, 0.0));
  private selMat: THREE.ShaderMaterial;

  constructor() {
    this.selMat = (this.selected as unknown as { mat: THREE.ShaderMaterial }).mat;
  }

  setSelected(meshes: THREE.Object3D[], invalid = false) {
    this.selected.set(meshes);
    this.selMat.uniforms.color.value.set(invalid ? '#ff3b4a' : '#ff8a3d');
  }

  setHovered(meshes: THREE.Object3D[]) {
    this.hovered.set(meshes);
  }

  setVisible(v: boolean) {
    this.selected.setVisible(v);
    this.hovered.setVisible(v);
  }
}
