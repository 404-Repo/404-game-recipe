/**
 * The lighting rig.
 *
 * This is the subsystem this genre loses on. Two rules drive everything here,
 * both taken from the reference frames rather than from taste:
 *
 *  1. THERE ARE ALWAYS TWO COLOUR TEMPERATURES IN FRAME. Warm sodium from the
 *     high bays, cold moonlight from the skylights and the open dock doors.
 *     Neither of them is neutral white. A single-temperature rig is the
 *     diagnosed cause of every previous loss at this comparison.
 *
 *  2. THE FLOOR IS LIT BY THE LAMPS. The documented failure mode in a game
 *     where you move along the ground is "lights that emit without coupling to
 *     the surfaces around them, so the world is lit and the floor it stands on
 *     is not" — it went four rounds unfixed in a previous run while being
 *     correctly diagnosed every time. So every high bay does three things at
 *     once: it emits (the lens geometry), it lights (a real SpotLight aimed at
 *     the slab), and it *pools* (an additive ground quad that survives even
 *     when the SpotLight is culled for distance). The third one is what keeps
 *     the coupling visible across the whole depth of the room instead of only
 *     within the handful of live lights.
 */
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL, B, QUALITY } from './config.js';

function radialTexture(inner, outer, power) {
  const s = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(s, s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = (x + 0.5) / s * 2 - 1, dy = (y + 0.5) / s * 2 - 1;
      const d = Math.min(1, Math.hypot(dx, dy));
      const a = Math.pow(1 - d, power);
      const i = (y * s + x) * 4;
      img.data[i] = inner[0]; img.data[i + 1] = inner[1]; img.data[i + 2] = inner[2];
      img.data[i + 3] = Math.round(a * 255 * outer);
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A soft downward cone of haze under a lamp. Additive, never writes depth. */
const SHAFT_VS = `
varying float vY; varying vec3 vN; varying vec3 vView;
void main(){
  vY = uv.y;
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  vN = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const SHAFT_FS = `
uniform vec3 uColor; uniform float uIntensity;
varying float vY; varying vec3 vN; varying vec3 vView;
void main(){
  // grazing angles are where a real shaft is brightest, and looking straight
  // through the middle of it should not blow out
  float edge = 1.0 - abs(dot(normalize(vN), normalize(vView)));
  float fall = pow(clamp(1.0 - vY, 0.0, 1.0), 1.7);
  float a = pow(edge, 2.2) * fall * uIntensity;
  gl_FragColor = vec4(uColor * a, a);
}`;

export class Rig {
  constructor(scene, renderer, quality) {
    this.scene = scene; this.renderer = renderer;
    this.q = QUALITY[quality];
    this.lamps = [];        // {pos, spot|null, pool, kind}
    this.spotPool = [];
    this.poolTex = radialTexture([255, 196, 135], 1.0, 2.4);
    this.coldPoolTex = radialTexture([150, 186, 224], 1.0, 2.0);
    this.build();
  }

  build() {
    const s = this.scene;

    // Cold ambient. Deliberately weak: the reference frames are nearly black
    // away from a light source, and a comfortable ambient is what turns a night
    // interior into an overcast afternoon.
    // Ground colour near-neutral: a tinted ambient puts chroma into every shadow.
    this.hemi = new THREE.HemisphereLight(0x7ea0c4, 0x2b2d31, 1.02);
    s.add(this.hemi);

    // Moonlight through the skylights: the cold half of the two-temperature
    // rule, and the only shadow-casting light in the scene.
    // The shadow camera is deliberately TIGHT — 9 m around the player, snapped
    // to texel steps. Two reasons, and the second is the one that decided it.
    // Quality: 2048 texels over 18 m is 9 mm a texel, so a rifle casts a rifle
    // shadow instead of a smudge. Cost: the shadow map is a second full pass
    // over everything inside it, and `renderer.info.render.calls` counts it,
    // because the GPU does. Widening it from 9 m to 19 m cost ~500 draw calls
    // to shadow geometry sitting in fog nobody can see through.
    this.moon = new THREE.DirectionalLight(0xa8c6e8, 0.95);
    this.moon.position.set(-26, 40, 20);
    this.moon.castShadow = true;
    const sm = this.q.shadowMap;
    this.moon.shadow.mapSize.set(sm, sm);
    this.moon.shadow.camera.near = 1;
    this.moon.shadow.camera.far = 25;
    this.moon.shadow.bias = -0.0011;
    this.moon.shadow.normalBias = 0.035;
    this.moon.shadow.radius = 3.2;
    this._setShadowExtent(5.4);
    s.add(this.moon);
    s.add(this.moon.target);

    // A very low warm fill so the sodium colour survives in shadow rather than
    // the shadows going pure blue. Real sodium bounces.
    this.bounce = new THREE.DirectionalLight(0xffa845, 0.11);
    this.bounce.position.set(8, 3, -12);
    s.add(this.bounce);

    // UP-FILL. Measured against the reference frames, the first version of this
    // rig failed the "upper third is occupied by structure" claim badly:
    // upEdgeN 0.02-0.10 against a reference range of 0.18-0.79, and upVoidN
    // 0.86-0.99 against 0.15-0.52. The trusses, ducts and pipe runs were all
    // there and all pitch black, so the ceiling read as a void.
    //
    // The reference frames are dark up there too (topDark >= 0.6 in 11 of 12)
    // but they are dark WITH GRADIENT. What produces that in a real shed is
    // spill off the floor and off the top of every high-bay reflector. So:
    // one weak cool light aimed straight up, which by definition can only touch
    // downward-facing surfaces — the underside of the roof deck, the soffits of
    // the ducts, the bottom flange of every truss. Nothing at eye level moves.
    this.upFill = new THREE.DirectionalLight(0x9ab6d4, 0.52);
    this.upFill.position.set(2, -12, 4);
    this.upFill.target.position.set(2, 12, 4);
    s.add(this.upFill); s.add(this.upFill.target);

    // Spot lights are a limited resource on a forward renderer, so a fixed
    // pool is allocated once and re-aimed at whichever lamps are nearest the
    // camera. Creating and destroying lights per frame recompiles every
    // material in the scene, which is a stall you can see.
    for (let i = 0; i < this.q.liveSpots; i++) {
      const sp = new THREE.SpotLight(0xffc487, 0, 26, 0.72, 0.42, 1.35);
      sp.visible = false;
      sp.castShadow = i < this.q.spotShadows;
      if (sp.castShadow) {
        sp.shadow.mapSize.set(1024, 1024);
        sp.shadow.camera.near = 0.6; sp.shadow.camera.far = 22;
        sp.shadow.bias = -0.0016; sp.shadow.normalBias = 0.03;
      }
      sp.target.position.set(0, 0, 0);
      s.add(sp); s.add(sp.target);
      this.spotPool.push(sp);
    }

    this.poolGroup = new THREE.Group();
    this.poolGroup.matrixAutoUpdate = false;
    s.add(this.poolGroup);
    this.shaftGroup = new THREE.Group();
    s.add(this.shaftGroup);
  }

  /**
   * Forty-odd additive ground quads is forty-odd draw calls for something that
   * never moves and never changes. They share two materials; merge them once
   * the level has finished registering lamps.
   */
  bakePools() {
    const byMat = new Map();
    for (const q of [...this.poolGroup.children]) {
      const k = q.material.uuid;
      if (!byMat.has(k)) byMat.set(k, { mat: q.material, geos: [] });
      const g = q.geometry.clone();
      q.updateMatrix();
      g.applyMatrix4(q.matrix);
      byMat.get(k).geos.push(g);
      this.poolGroup.remove(q);
    }
    for (const { mat, geos } of byMat.values()) {
      const merged = geos.length === 1 ? geos[0] : BufferGeometryUtils.mergeGeometries(geos, false);
      if (!merged) { continue; }
      const m = new THREE.Mesh(merged, mat);
      m.renderOrder = 2; m.frustumCulled = false;
      m.matrixAutoUpdate = false;
      this.poolGroup.add(m);
    }
    // same for the shafts, which already share a material per colour/intensity
    const sByMat = new Map();
    for (const q of [...this.shaftGroup.children]) {
      const k = q.material.uuid;
      if (!sByMat.has(k)) sByMat.set(k, { mat: q.material, geos: [] });
      q.updateMatrix();
      const g = q.geometry.clone(); g.applyMatrix4(q.matrix);
      sByMat.get(k).geos.push(g);
      this.shaftGroup.remove(q);
    }
    for (const { mat, geos } of sByMat.values()) {
      const merged = geos.length === 1 ? geos[0] : BufferGeometryUtils.mergeGeometries(geos, false);
      if (!merged) continue;
      const m = new THREE.Mesh(merged, mat);
      m.renderOrder = 3; m.frustumCulled = false; m.matrixAutoUpdate = false;
      this.shaftGroup.add(m);
    }
  }

  /**
   * Render the room into a cubemap once and hand it to the scene as an
   * environment. This is what turns the concrete from a matte Lambert plane
   * into a damp sealed floor with the racking smeared into it, and it costs one
   * render at load. Intensity is kept low: it is a reflection, not a fill.
   */
  captureEnvironment(renderer, scene, at = new THREE.Vector3(0, 3.2, 2)) {
    const cubeRT = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
    const cam = new THREE.CubeCamera(0.5, 90, cubeRT);
    cam.position.copy(at);
    const keepBg = scene.background;
    scene.background = null;
    cam.update(renderer, scene);
    scene.background = keepBg;
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileCubemapShader();
    const env = pmrem.fromCubemap(cubeRT.texture).texture;
    pmrem.dispose(); cubeRT.dispose();
    scene.environment = env;
    scene.environmentIntensity = 0.34;
    return env;
  }

  _setShadowExtent(r) {
    const c = this.moon.shadow.camera;
    c.left = -r; c.right = r; c.top = r; c.bottom = -r;
    c.updateProjectionMatrix();
  }

  /**
   * Register a lamp. `origin` is the world point light actually leaves from —
   * an asset declares it as userData.lightOrigin so this is not a guess about
   * where inside the fitting the bulb is.
   */
  addLamp(origin, kind = 'highbay', opts = {}) {
    const lamp = {
      pos: origin.clone(), kind,
      intensity: opts.intensity ?? (kind === 'highbay' ? 15.5 : 7.0),
      radius: opts.radius ?? (kind === 'highbay' ? 4.6 : 2.4),
      color: opts.color ?? 0xffc487,
      floorY: opts.floorY ?? 0,
      spot: null,
      flicker: opts.flicker ?? 0,
      on: true,
    };
    // The pool. This is the part that makes the coupling readable everywhere
    // rather than only inside the live-spot radius.
    const cold = (opts.color ?? 0xffb45a) === 0x8fb4d8;
    const m = new THREE.MeshBasicMaterial({
      map: cold ? this.coldPoolTex : this.poolTex,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      opacity: opts.poolOpacity ?? (kind === 'highbay' ? 0.5 : 0.3),
      toneMapped: true, side: THREE.FrontSide,
    });
    const q = new THREE.Mesh(new THREE.PlaneGeometry(lamp.radius * 2.5, lamp.radius * 2.5), m);
    q.rotation.x = -Math.PI / 2;
    q.position.set(lamp.pos.x, lamp.floorY + 0.012, lamp.pos.z);
    q.renderOrder = 2;
    q.matrixAutoUpdate = false; q.updateMatrix();
    this.poolGroup.add(q);
    lamp.pool = q;
    this._poolsDirty = true;
    this.lamps.push(lamp);
    return lamp;
  }

  /** A visible cone of haze from a lamp down to the floor. Used sparingly. */
  addShaft(origin, floorY, topR, botR, color = 0xffb45a, intensity = 0.20) {
    const hgt = origin.y - floorY;
    if (hgt < 0.5) return null;
    const g = new THREE.CylinderGeometry(topR, botR, hgt, 14, 1, true);
    const mesh = new THREE.Mesh(g, this._shaftMat(color, intensity));
    mesh.position.set(origin.x, floorY + hgt / 2, origin.z);
    mesh.renderOrder = 3;
    mesh.frustumCulled = true;
    this.shaftGroup.add(mesh);
    return mesh;
  }

  /** One ShaderMaterial per (colour, intensity) pair, not one per shaft. */
  _shaftMat(color, intensity) {
    this._shaftMats = this._shaftMats || new Map();
    const k = color + '|' + intensity;
    let m = this._shaftMats.get(k);
    if (!m) {
      m = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(color) }, uIntensity: { value: intensity } },
        vertexShader: SHAFT_VS, fragmentShader: SHAFT_FS,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      this._shaftMats.set(k, m);
    }
    return m;
  }

  /**
   * Roughly how much light reaches a point, 0..1.
   *
   * Drives the viewmodel's lighting from the room's. Measured against the
   * reference frames, a weapon lit by its own dedicated rig sits at 1.3 to 3.3
   * times the frame median; the twelve AAA frames run 0.80 to 1.27 and never
   * exceed 1.3. The weapon is never brighter than the room it is in, and a gun
   * that stays lit while you walk into a dark aisle is one of the most reliable
   * tells that something is a real-time render rather than a photograph.
   */
  illuminationAt(p) {
    let sum = 0;
    for (const l of this.lamps) {
      if (!l.on) continue;
      const d2 = (l.pos.x - p.x) ** 2 + (l.pos.y - p.y) ** 2 + (l.pos.z - p.z) ** 2;
      sum += l.intensity / (5 + d2);
    }
    return Math.min(1, sum / 2.2);
  }

  /**
   * Per frame: keep the shadow camera on the player, and hand the fixed spot
   * pool to the nearest lamps.
   */
  update(dt, camPos, t) {
    // Shadow camera follows the player, snapped to texel-sized steps so the
    // shadow edges do not crawl as you walk.
    const texel = (5.4 * 2) / this.q.shadowMap;
    const sx = Math.round(camPos.x / texel) * texel;
    const sz = Math.round(camPos.z / texel) * texel;
    this.moon.position.set(sx - 6.6, 12, sz + 5.2);
    this.moon.target.position.set(sx, 0, sz);
    this.moon.target.updateMatrixWorld();

    const near = [];
    for (const l of this.lamps) {
      if (!l.on || l.kind === 'sign') continue;
      const d2 = (l.pos.x - camPos.x) ** 2 + (l.pos.z - camPos.z) ** 2 + (l.pos.y - camPos.y) ** 2;
      near.push({ l, d2 });
    }
    near.sort((a, b) => a.d2 - b.d2);
    for (let i = 0; i < this.spotPool.length; i++) {
      const sp = this.spotPool[i];
      const e = near[i];
      if (!e || e.d2 > 34 * 34) { sp.visible = false; sp.intensity = 0; continue; }
      const l = e.l;
      sp.visible = true;
      sp.color.setHex(l.color);
      sp.position.copy(l.pos);
      sp.target.position.set(l.pos.x, l.floorY, l.pos.z);
      sp.target.updateMatrixWorld();
      sp.distance = l.kind === 'highbay' ? 24 : 13;
      sp.angle = l.kind === 'highbay' ? 0.78 : 0.62;
      sp.penumbra = 0.45;
      let k = 1;
      if (l.flicker) {
        const n = Math.sin(t * 31.7 + l.pos.x) * Math.sin(t * 11.3 + l.pos.z);
        k = n > 0.55 ? 0.25 : 1;
      }
      sp.intensity = l.intensity * k;
    }
  }
}
