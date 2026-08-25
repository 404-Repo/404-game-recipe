/**
 * Effects: tracers, impact sparks, bullet holes, ejected cases, blood, smoke.
 *
 * All of it is pooled and instanced. None of it is an "object" in the asset
 * sense — an object is a thing in the world and comes from the asset method;
 * a spark is a shader. The one exception is the spent case, whose geometry is
 * taken from the rifle asset's own declared `casingProto` rather than invented
 * here, because it IS a thing.
 */
import * as THREE from 'three';
import { rnd, clamp, PAL } from './config.js';

const MAXTRACER = 40, MAXSPARK = 700, MAXCASE = 26, MAXSMOKE = 60;

export class FX {
  constructor(scene, world, maxDecals = 64) {
    this.scene = scene; this.world = world;
    this.t = 0;

    // ---- tracers: instanced thin boxes stretched along the shot
    const tg = new THREE.BoxGeometry(0.024, 0.024, 1);
    const tm = new THREE.MeshBasicMaterial({ color: 0xffcf8a, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.tracers = new THREE.InstancedMesh(tg, tm, MAXTRACER);
    this.tracers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.tracers.frustumCulled = false; this.tracers.count = MAXTRACER;
    this.tracers.renderOrder = 4;
    scene.add(this.tracers);
    this.tracerData = Array.from({ length: MAXTRACER }, () => ({ life: 0 }));
    this._ti = 0;

    // ---- sparks: instanced points with gravity
    const sg = new THREE.BoxGeometry(0.017, 0.017, 0.017);
    const sm = new THREE.MeshBasicMaterial({ color: 0xffb85e, blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, toneMapped: false });
    this.sparks = new THREE.InstancedMesh(sg, sm, MAXSPARK);
    this.sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sparks.frustumCulled = false; this.sparks.count = MAXSPARK;
    this.sparks.renderOrder = 4;
    scene.add(this.sparks);
    this.sparkData = Array.from({ length: MAXSPARK }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), col: 0 }));
    this._si = 0;

    // ---- smoke / dust puffs
    const puffTex = this._puffTexture();
    const gm = new THREE.MeshBasicMaterial({ map: puffTex, transparent: true, depthWrite: false,
      opacity: 0.5 });
    gm.color = new THREE.Color(0x9c988f);
    this.smoke = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), gm, MAXSMOKE);
    this.smoke.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.smoke.frustumCulled = false; this.smoke.count = MAXSMOKE;
    this.smoke.renderOrder = 5;
    scene.add(this.smoke);
    this.smokeData = Array.from({ length: MAXSMOKE }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: 1, rot: 0 }));
    this._gi = 0;

    // ---- bullet holes: instanced quads, oldest recycled
    const hm = new THREE.MeshBasicMaterial({ map: this._holeTexture(), transparent: true,
      depthWrite: false, opacity: 0.92, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    this.holes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), hm, maxDecals);
    this.holes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.holes.frustumCulled = false; this.holes.count = maxDecals;
    this.holes.renderOrder = 1;
    scene.add(this.holes);
    this.maxDecals = maxDecals;
    this._hi = 0;
    this._hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < maxDecals; i++) this.holes.setMatrixAt(i, this._hidden);
    for (let i = 0; i < MAXTRACER; i++) this.tracers.setMatrixAt(i, this._hidden);
    for (let i = 0; i < MAXSPARK; i++) this.sparks.setMatrixAt(i, this._hidden);
    for (let i = 0; i < MAXSMOKE; i++) this.smoke.setMatrixAt(i, this._hidden);

    this.cases = [];
    this.caseProto = null;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._col = new THREE.Color();
  }

  _puffTexture() {
    const s = 128, cv = document.createElement('canvas'); cv.width = cv.height = s;
    const ctx = cv.getContext('2d'); const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const dx = (x + .5) / s * 2 - 1, dy = (y + .5) / s * 2 - 1;
      const d = Math.hypot(dx, dy);
      const n = (Math.sin(x * 0.31) * Math.sin(y * 0.27) + Math.sin(x * 0.11 + y * 0.17)) * 0.14;
      const a = clamp((1 - d) * (1 + n), 0, 1);
      const i = (y * s + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(Math.pow(a, 1.9) * 255);
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  _holeTexture() {
    const s = 64, cv = document.createElement('canvas'); cv.width = cv.height = s;
    const ctx = cv.getContext('2d'); const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const dx = (x + .5) / s * 2 - 1, dy = (y + .5) / s * 2 - 1;
      const d = Math.hypot(dx, dy);
      const core = d < 0.30 ? 1 : 0;
      const ring = clamp(1 - Math.abs(d - 0.46) / 0.30, 0, 1) * 0.55;
      const a = clamp(core + ring * (0.5 + 0.5 * Math.sin(Math.atan2(dy, dx) * 7)), 0, 1) * (d < 0.92 ? 1 : 0);
      const i = (y * s + x) * 4;
      const v = core ? 12 : 96;
      img.data[i] = v; img.data[i + 1] = v - 2; img.data[i + 2] = v - 6;
      img.data[i + 3] = Math.round(a * 255);
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  setCasingProto(obj) {
    if (!obj) return;
    this.caseProto = obj;
    for (let i = 0; i < MAXCASE; i++) {
      const c = obj.clone(true);
      c.visible = false;
      c.matrixAutoUpdate = true;
      this.scene.add(c);
      this.cases.push({ obj: c, life: 0, v: new THREE.Vector3(), w: new THREE.Vector3() });
    }
    this._ci = 0;
  }

  tracer(from, to) {
    const d = this._v.copy(to).sub(from);
    const len = d.length();
    if (len < 0.2) return;
    const i = this._ti = (this._ti + 1) % MAXTRACER;
    const mid = from.clone().addScaledVector(d, 0.5);
    this._q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.clone().normalize());
    this._m.compose(mid, this._q, this._s.set(1, 1, len));
    this.tracers.setMatrixAt(i, this._m);
    this.tracers.instanceMatrix.needsUpdate = true;
    this.tracerData[i].life = 0.055;
    this.tracerData[i].m = this._m.clone();
  }

  impact(p, n, kind = 'hard') {
    const cols = { hard: 0xffb85e, flesh: 0x8e1414, metal: 0xffd79a, wood: 0xc79a5a };
    const col = cols[kind] ?? cols.hard;
    const count = kind === 'flesh' ? 10 : 15;
    for (let k = 0; k < count; k++) {
      const i = this._si = (this._si + 1) % MAXSPARK;
      const d = this.sparkData[i];
      d.life = rnd(0.16, kind === 'flesh' ? 0.30 : 0.52);
      d.maxLife = d.life;
      d.p.copy(p).addScaledVector(n, 0.02);
      d.v.set(n.x + rnd(-0.85, 0.85), n.y + rnd(-0.3, 1.15), n.z + rnd(-0.85, 0.85))
        .multiplyScalar(rnd(1.6, 6.4));
      d.col = col;
    }
    if (kind !== 'flesh') {
      this.decal(p, n);
      this.puff(p, n, 0.30, 0.35);
    } else {
      this.puff(p, n, 0.24, 0.16, 0x6b1010);
    }
  }

  puff(p, n, r, life, color) {
    const i = this._gi = (this._gi + 1) % MAXSMOKE;
    const d = this.smokeData[i];
    d.life = life; d.maxLife = life;
    d.p.copy(p).addScaledVector(n, 0.08);
    d.v.set(rnd(-0.25, 0.25), rnd(0.2, 0.75), rnd(-0.25, 0.25));
    d.r = r; d.rot = rnd(0, 6.28); d.color = color;
  }

  decal(p, n) {
    const i = this._hi = (this._hi + 1) % this.maxDecals;
    this._q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this._v.copy(n).normalize());
    const sc = rnd(0.07, 0.12);
    this._m.compose(this._v.copy(p).addScaledVector(n, 0.008), this._q, this._s.set(sc, sc, sc));
    this.holes.setMatrixAt(i, this._m);
    this.holes.instanceMatrix.needsUpdate = true;
  }

  ejectCase(p, dir, up) {
    if (!this.cases.length) return;
    const i = this._ci = (this._ci + 1) % this.cases.length;
    const c = this.cases[i];
    c.obj.visible = true;
    c.obj.position.copy(p);
    c.obj.rotation.set(rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28));
    c.life = 2.4;
    c.v.copy(dir).multiplyScalar(rnd(2.1, 3.4)).addScaledVector(up, rnd(1.1, 2.0));
    c.v.x += rnd(-0.4, 0.4); c.v.z += rnd(-0.4, 0.4);
    c.w.set(rnd(-14, 14), rnd(-14, 14), rnd(-14, 14));
  }

  update(dt) {
    this.t += dt;
    // tracers
    let tu = false;
    for (let i = 0; i < MAXTRACER; i++) {
      const d = this.tracerData[i];
      if (d.life > 0) {
        d.life -= dt;
        if (d.life <= 0) { this.tracers.setMatrixAt(i, this._hidden); tu = true; }
        else if (d.m) { this.tracers.setMatrixAt(i, d.m); tu = true; }
      }
    }
    if (tu) this.tracers.instanceMatrix.needsUpdate = true;

    // sparks
    let su = false;
    for (let i = 0; i < MAXSPARK; i++) {
      const d = this.sparkData[i];
      if (d.life <= 0) continue;
      d.life -= dt; su = true;
      if (d.life <= 0) { this.sparks.setMatrixAt(i, this._hidden); continue; }
      d.v.y -= 15 * dt; d.v.multiplyScalar(1 - 2.4 * dt);
      d.p.addScaledVector(d.v, dt);
      if (d.p.y < 0.01) { d.p.y = 0.01; d.v.y *= -0.28; d.v.x *= 0.6; d.v.z *= 0.6; }
      const k = clamp(d.life / (d.maxLife || 1), 0, 1);
      this._m.compose(d.p, this._q.identity(), this._s.set(k, k, k * (1 + Math.min(3, d.v.length() * 0.3))));
      this.sparks.setMatrixAt(i, this._m);
      this._col.setHex(d.col);
      this.sparks.setColorAt(i, this._col);
    }
    if (su) {
      this.sparks.instanceMatrix.needsUpdate = true;
      if (this.sparks.instanceColor) this.sparks.instanceColor.needsUpdate = true;
    }

    // smoke, billboarded in update() by the caller-supplied camera quaternion
    let gu = false;
    for (let i = 0; i < MAXSMOKE; i++) {
      const d = this.smokeData[i];
      if (d.life <= 0) continue;
      d.life -= dt; gu = true;
      if (d.life <= 0) { this.smoke.setMatrixAt(i, this._hidden); continue; }
      d.p.addScaledVector(d.v, dt); d.v.multiplyScalar(1 - 1.6 * dt);
      const age = 1 - d.life / (d.maxLife || 1);
      const r = d.r * (0.5 + age * 1.7);
      this._q.copy(this.camQ || this._q.identity());
      this._m.compose(d.p, this._q, this._s.set(r, r, r));
      this.smoke.setMatrixAt(i, this._m);
    }
    if (gu) this.smoke.instanceMatrix.needsUpdate = true;

    // cases
    for (const c of this.cases) {
      if (c.life <= 0) continue;
      c.life -= dt;
      if (c.life <= 0) { c.obj.visible = false; continue; }
      c.v.y -= 19 * dt;
      c.obj.position.addScaledVector(c.v, dt);
      c.obj.rotation.x += c.w.x * dt; c.obj.rotation.y += c.w.y * dt; c.obj.rotation.z += c.w.z * dt;
      const fl = this.world.floorAt(c.obj.position.x, c.obj.position.z, 0.03, c.obj.position.y);
      if (c.obj.position.y < fl + 0.012) {
        c.obj.position.y = fl + 0.012;
        c.v.y *= -0.34; c.v.x *= 0.55; c.v.z *= 0.55; c.w.multiplyScalar(0.5);
        if (Math.abs(c.v.y) < 0.35) { c.v.set(0, 0, 0); c.w.set(0, 0, 0); }
      }
    }
  }
}
