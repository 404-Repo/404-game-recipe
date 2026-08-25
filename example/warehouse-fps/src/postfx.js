import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Final grade. Runs after tone mapping and the sRGB conversion, so everything
 * in here is in display space and the numbers mean what they look like.
 *
 * Vignette, a cold/warm split-tone, per-channel edge offset, animated grain and
 * a very slight barrel of chromatic aberration. None of it is a look for its
 * own sake: the reference frames all fall off hard at the corners and all carry
 * sensor noise in the shadows, and a clean-cornered noiseless frame is one of
 * the most reliable tells that something is a real-time render.
 */
const Grade = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 1.0 },
    uGrain: { value: 0.014 }, uAberr: { value: 0.0009 }, uHurt: { value: 0.0 },
    uDesat: { value: 0.88 },
    uLift: { value: new THREE.Vector3(0.010, 0.014, 0.026) },
    uGain: { value: new THREE.Vector3(1.030, 1.000, 0.962) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uVig, uGrain, uAberr, uHurt, uDesat;
    uniform vec3 uLift, uGain; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      float r2 = dot(c,c);
      // Confine the fringing to the outer part of the frame. Real lenses do
      // this; a uniform offset put red/green fringes on thin vertical
      // geometry at frame CENTRE, which is one of the loudest tells there is.
      float ab = uAberr * (1.0 + uHurt * 5.0) * smoothstep(0.06, 0.24, r2);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + c * ab * 1.7).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - c * ab * 1.7).b;

      // DESATURATE IN SHADOW, NOT GLOBALLY.
      //
      // The first version of this was a flat global desaturation, and it did
      // move the frame-level saturation into the reference range — by hiding
      // the chroma under darkness rather than removing it. A critic caught it
      // exactly: yellow racking still measured S=0.44 at V=0.09, against a real
      // AAA red container at S=0.42 and five times the brightness. That is the
      // "gamed by a global exposure multiplier" failure the claims file warns
      // about, and I walked into it while trying to fix a different claim.
      //
      // What actually separates the two sets is that shadow in a real frame is
      // GREY. Chroma collapses as value falls, because an achromatic ambient
      // dominates down there; multiplying a saturated albedo by a small scalar
      // keeps the chroma all the way down. So the desaturation is keyed to
      // luminance: heavy in the shadows, almost none in the lit pools, which
      // leaves litSat where it should be and pulls shadowChroma down.
      float l = dot(col, vec3(0.2126,0.7152,0.0722));
      float sd = mix(uDesat, 0.05, smoothstep(0.05, 0.46, l));
      col = mix(col, vec3(l), sd);
      col = col * uGain + uLift * (1.0 - smoothstep(0.0, 0.45, l));
      col += vec3(0.011, 0.005, -0.005) * smoothstep(0.55, 1.0, l);

      // vignette
      float v = smoothstep(0.86, 0.20, r2 * 2.0);
      col *= mix(1.0, v, uVig);

      // grain, stronger in shadow where a sensor actually shows it
      float n = hash(vUv * vec2(1024.0, 768.0) + fract(uTime) * 91.7) - 0.5;
      col += n * uGrain * (1.0 - smoothstep(0.0, 0.7, l));

      col = mix(col, vec3(dot(col, vec3(0.33))) * vec3(1.35,0.5,0.45), uHurt * 0.5);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function makeComposer(renderer, scene, camera, viewScene, viewCam, q, size) {
  // `antialias: true` on the WebGLRenderer is silently discarded the moment an
  // EffectComposer is used: the scene is rendered into the composer's own
  // render target, and that target is not multisampled unless you ask. Thin
  // geometry — chain-link mesh, cage bars, distant racking uprights — then
  // renders as full-saturation red/green/blue static, which is the single most
  // obvious "this is a browser game" artifact there is. Nothing warns.
  const rt = new THREE.WebGLRenderTarget(size.w, size.h, {
    samples: q.msaa ?? 4,
    type: THREE.HalfFloatType,
    colorSpace: THREE.LinearSRGBColorSpace,
  });
  const composer = new EffectComposer(renderer, rt);
  composer.setSize(size.w, size.h);
  const rp = new RenderPass(scene, camera);
  composer.addPass(rp);

  // The viewmodel: same target, depth cleared first. A 0.9 m rifle held 40 cm
  // from the eye intersects everything otherwise.
  const vp = new RenderPass(viewScene, viewCam);
  vp.clear = false; vp.clearDepth = true;
  composer.addPass(vp);

  let bloom = null;
  if (q.bloom) {
    bloom = new UnrealBloomPass(new THREE.Vector2(size.w, size.h), 0.52, 0.62, 0.78);
    composer.addPass(bloom);
  }
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(Grade);
  composer.addPass(grade);
  return { composer, grade, bloom, viewPass: vp };
}
