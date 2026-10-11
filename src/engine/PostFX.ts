import * as THREE from 'three';
import {
  BlendFunction,
  BloomEffect,
  Effect,
  EffectComposer,
  EffectPass,
  KernelSize,
  OutlineEffect,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

// Post-processing chain: ambient occlusion → bloom → exposure/tonemapping →
// grading/vignette → SMAA. Outlines highlight the selection.

class GradeEffect extends Effect {
  constructor() {
    super(
      'GradeEffect',
      /* glsl */ `
      uniform float exposure;
      uniform float warmth;
      uniform float saturation;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb * exposure;
        c *= vec3(1.0 + warmth * 0.06, 1.0, 1.0 - warmth * 0.06);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, saturation);
        outputColor = vec4(c, inputColor.a);
      }`,
      {
        blendFunction: BlendFunction.SRC,
        uniforms: new Map<string, THREE.Uniform>([
          ['exposure', new THREE.Uniform(1)],
          ['warmth', new THREE.Uniform(0)],
          ['saturation', new THREE.Uniform(1.04)],
        ]),
      },
    );
  }
  set exposure(v: number) {
    this.uniforms.get('exposure')!.value = v;
  }
  set warmth(v: number) {
    this.uniforms.get('warmth')!.value = v;
  }
}

export class PostFX {
  readonly composer: EffectComposer;
  readonly outline: OutlineEffect;
  readonly hoverOutline: OutlineEffect;
  private ao: N8AOPostPass;
  private grade: GradeEffect;
  private bloom: BloomEffect;
  private renderPass: RenderPass;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
  ) {
    this.composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.ao = new N8AOPostPass(scene, camera, 1, 1);
    this.ao.configuration.aoRadius = 0.8;
    this.ao.configuration.distanceFalloff = 0.6;
    this.ao.configuration.intensity = 3.6;
    this.ao.configuration.color = new THREE.Color(0x0b0705);
    this.ao.configuration.gammaCorrection = false;
    this.ao.configuration.halfRes = true;
    this.ao.configuration.depthAwareUpsampling = true;
    this.ao.setQualityMode('Medium');
    this.composer.addPass(this.ao);

    this.outline = new OutlineEffect(scene, camera, {
      blendFunction: BlendFunction.SCREEN,
      edgeStrength: 3.2,
      pulseSpeed: 0,
      visibleEdgeColor: 0xff9a55,
      hiddenEdgeColor: 0x8a4a24,
      blur: true,
      kernelSize: KernelSize.VERY_SMALL,
      xRay: true,
      multisampling: 0,
    });
    this.hoverOutline = new OutlineEffect(scene, camera, {
      blendFunction: BlendFunction.SCREEN,
      edgeStrength: 1.6,
      visibleEdgeColor: 0xffffff,
      hiddenEdgeColor: 0x555555,
      blur: true,
      kernelSize: KernelSize.VERY_SMALL,
      xRay: false,
    });

    this.bloom = new BloomEffect({ intensity: 0.55, luminanceThreshold: 1.1, luminanceSmoothing: 0.35, mipmapBlur: true, radius: 0.72 });
    this.grade = new GradeEffect();
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
    const vignette = new VignetteEffect({ offset: 0.32, darkness: 0.42 });
    this.composer.addPass(new EffectPass(camera, this.bloom, this.grade, tone, this.outline, this.hoverOutline, vignette));
    this.composer.addPass(new EffectPass(camera, new SMAAEffect({ preset: SMAAPreset.HIGH })));
  }

  setSize(w: number, h: number) {
    this.composer.setSize(w, h, false);
  }

  setExposure(v: number, warmth: number) {
    this.grade.exposure = v;
    this.grade.warmth = warmth;
  }

  setQuality(high: boolean) {
    this.ao.configuration.halfRes = !high;
    this.ao.setQualityMode(high ? 'High' : 'Low');
    this.ao.enabled = true;
  }

  setAO(enabled: boolean) {
    this.ao.enabled = enabled;
  }

  render(dt: number) {
    this.composer.render(dt);
  }

  dispose() {
    this.composer.dispose();
    void this.renderer;
    void this.scene;
    void this.camera;
  }
}
