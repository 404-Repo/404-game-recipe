/**
 * Hostiles.
 *
 * Each one is a generated `enemy_soldier` asset loaded with
 * `{ keepHierarchy: true }`, because the loader's default merge welds the
 * figure into one mesh per material and drops the userData that names its
 * joints. The result renders perfectly and can never move a limb, and no still
 * frame will ever show you that. `assertArticulated()` below fails loudly at
 * boot rather than letting the game ship with statues.
 */
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, damp, lerp, rnd, pick } from './config.js';

/**
 * Collapse an articulated asset to one mesh per material PER JOINT.
 *
 * `keepHierarchy: true` is mandatory for anything that moves — the default
 * merge welds the figure solid and drops the userData naming its limbs. What
 * the docs do not mention is the bill: this soldier arrives as 122 separate
 * meshes, and the game needs up to eight of them on screen. That is a thousand
 * draw calls for the hostiles alone, against a budget of nine hundred for the
 * entire frame.
 *
 * Merging per joint is the missing middle. Each joint keeps its own transform,
 * so every limb still moves, and everything rigidly attached to that limb
 * becomes one mesh per material. 122 meshes -> ~20, and nothing stops moving.
 */
function materialKey(m) {
  if (!m) return 'none';
  const t = (x) => (x ? x.uuid : '-');
  return [m.type, m.color?.getHexString?.(), m.roughness, m.metalness, m.transparent,
          m.opacity, m.side, m.emissive?.getHexString?.(), m.vertexColors,
          t(m.map), t(m.roughnessMap), t(m.normalMap)].join('|');
}

function mergeable(geos) {
  const plain = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let common = null;
  for (const g of plain) {
    const names = new Set(Object.keys(g.attributes));
    common = common ? new Set([...common].filter((n) => names.has(n))) : names;
  }
  if (!common || !common.has('position')) return null;
  for (const g of plain) {
    for (const n of Object.keys(g.attributes)) if (!common.has(n)) g.deleteAttribute(n);
    g.morphAttributes = {}; g.clearGroups();
  }
  return plain;
}

export function collapseArticulated(root, extraParts = []) {
  const joints = new Set([root]);
  const j = root.userData?.joints || {};
  for (const v of Object.values(j)) if (v && v.isObject3D) joints.add(v);
  for (const v of extraParts) if (v && v.isObject3D) joints.add(v);
  root.updateMatrixWorld(true);

  const owner = new Map();          // joint -> [mesh]
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry || Array.isArray(o.material)) return;
    let p = o.parent, host = root;
    while (p) { if (joints.has(p)) { host = p; break; } p = p.parent; }
    if (!owner.has(host)) owner.set(host, []);
    owner.get(host).push(o);
  });

  const inv = new THREE.Matrix4();
  let before = 0, after = 0;
  for (const [host, meshes] of owner) {
    before += meshes.length;
    if (meshes.length < 2) { after += meshes.length; continue; }
    inv.copy(host.matrixWorld).invert();
    const buckets = new Map();
    for (const m of meshes) {
      const k = materialKey(m.material) + '#' + Object.keys(m.geometry.attributes).sort().join(',');
      if (!buckets.has(k)) buckets.set(k, { mat: m.material, geos: [], cast: false });
      const b = buckets.get(k);
      b.cast = b.cast || m.castShadow;
      let g;
      if (m.isInstancedMesh) {
        // expand instances, or every copy but the first is silently deleted
        const im = new THREE.Matrix4();
        for (let i = 0; i < m.count; i++) {
          m.getMatrixAt(i, im);
          const gi = m.geometry.clone();
          gi.applyMatrix4(im); gi.applyMatrix4(m.matrixWorld); gi.applyMatrix4(inv);
          b.geos.push(gi);
        }
        continue;
      }
      g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld); g.applyMatrix4(inv);
      b.geos.push(g);
    }
    for (const m of meshes) m.parent && m.parent.remove(m);
    for (const { mat, geos, cast } of buckets.values()) {
      if (!geos.length) continue;
      let geo = geos.length === 1 ? geos[0] : null;
      if (!geo) {
        const ready = mergeable(geos);
        try { geo = ready ? BufferGeometryUtils.mergeGeometries(ready, false) : null; } catch { geo = null; }
      }
      if (!geo) { for (const g of geos) host.add(new THREE.Mesh(g, mat)); after += geos.length; continue; }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      host.add(mesh); after++;
    }
  }
  root.updateMatrixWorld(true);
  return { before, after };
}

const HITBOXES = [
  { part: 'head',  y: 1.63, r: 0.135 },
  { part: 'torso', y: 1.22, r: 0.255 },
  { part: 'torso', y: 0.96, r: 0.235 },
  { part: 'limbs', y: 0.62, r: 0.205 },
  { part: 'limbs', y: 0.24, r: 0.175 },
];

export class Enemy {
  constructor(model, world, opts = {}) {
    this.obj = model;
    this.world = world;
    this.joints = model.userData.joints || {};
    this.hp = opts.hp ?? 100;
    this.alive = true;
    this.state = 'idle';
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.aimYaw = 0;
    this.walkPhase = rnd(0, 6.28);
    this.t = 0;
    this.fireCool = rnd(0.6, 2.0);
    this.burst = 0;
    this.alertT = 0;
    this.lastSeen = new THREE.Vector3();
    this.hasSeen = false;
    this.deathT = 0;
    this.deathDir = new THREE.Vector3();
    this.patrol = opts.patrol || null;
    this.patrolI = 0;
    this.repathT = 0;
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.strafeT = rnd(1, 3);
    this.accuracy = opts.accuracy ?? 0.62;
    this.aggression = opts.aggression ?? 0.6;
    this.speed = opts.speed ?? 3.1;
    this.onShoot = null;
    this.onDie = null;
    this.headWorld = new THREE.Vector3();
    this._v = new THREE.Vector3();
  }

  place(x, z, yaw) {
    this.pos.set(x, 0, z); this.yaw = this.aimYaw = yaw;
    this.obj.position.copy(this.pos); this.obj.rotation.y = yaw;
  }

  /** Segment/sphere test against the stacked hitboxes. */
  rayHit(o, d, maxT) {
    let best = null;
    for (const hb of HITBOXES) {
      const cy = this.pos.y + hb.y * (this.alive ? 1 : 0.30);
      const ox = o.x - this.pos.x, oy = o.y - cy, oz = o.z - this.pos.z;
      const b = ox * d.x + oy * d.y + oz * d.z;
      const c = ox * ox + oy * oy + oz * oz - hb.r * hb.r;
      const disc = b * b - c;
      if (disc < 0) continue;
      const t = -b - Math.sqrt(disc);
      if (t > 0.05 && t < maxT && (!best || t < best.t)) best = { t, part: hb.part };
    }
    return best;
  }

  hurt(n, headshot, fromDir) {
    if (!this.alive) return false;
    this.hp -= n;
    this.alertT = 8;
    this.hasSeen = true;
    if (this.hp <= 0) {
      this.alive = false;
      this.state = 'dead';
      this.deathT = 0;
      this.deathDir.copy(fromDir || this._v.set(0, 0, 1));
      this.headshotKill = !!headshot;
      if (this.onDie) this.onDie(this, headshot);
      return true;
    }
    return false;
  }

  _canSee(target) {
    this.headWorld.set(this.pos.x, this.pos.y + 1.58, this.pos.z);
    return this.world.clearLine(this.headWorld, target, 0.1);
  }

  update(dt, playerPos, playerAlive) {
    this.t += dt;
    if (!this.alive) { this._death(dt); return; }

    const toP = this._v.set(playerPos.x - this.pos.x, 0, playerPos.z - this.pos.z);
    const dist = toP.length();
    const eyeTarget = new THREE.Vector3(playerPos.x, playerPos.y + 1.5, playerPos.z);
    const sees = playerAlive && dist < 46 && this._canSee(eyeTarget);

    if (sees) {
      if (this.alertT <= 0) this.reaction = rnd(0.45, 1.15);   // spotting you is not the same as shooting you
      this.alertT = 6.5; this.hasSeen = true; this.lastSeen.copy(playerPos);
    } else this.alertT = Math.max(0, this.alertT - dt);
    this.reaction = Math.max(0, (this.reaction || 0) - dt);

    let moveTo = null;
    if (this.alertT > 0) {
      this.state = sees ? (dist < 5.5 ? 'engage' : 'advance') : 'search';
      const want = sees ? clamp(dist, 0, 100) : 0;
      if (sees) {
        // hold a fighting distance and strafe, rather than walking into the muzzle
        this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafeDir *= -1; this.strafeT = rnd(1.1, 2.8); }
        const ideal = 8.5;
        const radial = clamp((want - ideal) * 0.5, -1, 1);
        const fwd = toP.clone().normalize();
        const side = new THREE.Vector3(-fwd.z, 0, fwd.x).multiplyScalar(this.strafeDir);
        moveTo = this.pos.clone()
          .addScaledVector(fwd, radial * 2.4)
          .addScaledVector(side, 1.8);
      } else {
        moveTo = this.lastSeen.clone();
      }
    } else if (this.patrol) {
      this.state = 'patrol';
      const p = this.patrol[this.patrolI];
      if (Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 1.2) this.patrolI = (this.patrolI + 1) % this.patrol.length;
      moveTo = new THREE.Vector3(p.x, 0, p.z);
    } else {
      this.state = 'idle';
    }

    // --- steering with a cheap whisker avoidance against the box world
    let wish = new THREE.Vector3();
    if (moveTo) {
      wish.set(moveTo.x - this.pos.x, 0, moveTo.z - this.pos.z);
      const d = wish.length();
      if (d > 0.35) {
        wish.divideScalar(d);
        const probe = 1.5;
        const org = { x: this.pos.x, y: this.pos.y + 0.95, z: this.pos.z };
        for (const ang of [0.55, -0.55]) {
          const c = Math.cos(ang), s = Math.sin(ang);
          const wd = { x: wish.x * c - wish.z * s, y: 0, z: wish.x * s + wish.z * c };
          if (this.world.raycast(org, wd, probe)) {
            wish.x -= wd.x * 0.9; wish.z -= wd.z * 0.9;
          }
        }
        wish.y = 0;
        if (wish.lengthSq() > 1e-6) wish.normalize();
      } else wish.set(0, 0, 0);
    }

    const targetSpeed = this.state === 'patrol' ? this.speed * 0.42
                      : this.state === 'advance' ? this.speed
                      : this.state === 'engage' ? this.speed * 0.72
                      : this.speed * 0.7;
    this.vel.x = damp(this.vel.x, wish.x * targetSpeed, 7, dt);
    this.vel.z = damp(this.vel.z, wish.z * targetSpeed, 7, dt);

    const r = 0.36;
    const res = this.world.moveXZ(this.pos.x, this.pos.y, this.pos.z, r, 1.75,
                                  this.vel.x * dt, this.vel.z * dt, 0.35);
    this.pos.x = res.x; this.pos.z = res.z;
    this.pos.y = this.world.floorAt(this.pos.x, this.pos.z, r, this.pos.y + 0.4);

    // --- facing
    const spd = Math.hypot(this.vel.x, this.vel.z);
    const faceTarget = (sees || this.alertT > 0) ? Math.atan2(playerPos.x - this.pos.x, playerPos.z - this.pos.z)
                     : (spd > 0.2 ? Math.atan2(this.vel.x, this.vel.z) : this.yaw);
    let dy = faceTarget - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += clamp(dy, -5.5 * dt, 5.5 * dt);

    // --- firing
    this.fireCool -= dt;
    if (sees && dist < 23 && this.token && this.reaction <= 0 && this.fireCool <= 0 && Math.abs(dy) < 0.30) {
      if (this.burst <= 0) this.burst = 2 + Math.floor(Math.random() * 3);
      this.burst--;
      this.fireCool = this.burst > 0 ? 0.12 : rnd(1.5, 3.0) * (2 - this.aggression);
      if (this.onShoot) {
        const from = new THREE.Vector3(this.pos.x, this.pos.y + 1.42, this.pos.z);
        const off = (1 - this.accuracy) * 0.10;
        const to = eyeTarget.clone().add(new THREE.Vector3(rnd(-off, off) * dist * 0.4, rnd(-off, off) * dist * 0.4, rnd(-off, off) * dist * 0.4));
        this.onShoot(this, from, to, dist);
      }
    }

    this._animate(dt, spd, sees || this.alertT > 0);
    this.obj.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.obj.rotation.y = this.yaw;
  }

  _animate(dt, spd, aiming) {
    const j = this.joints;
    if (!j || !j.leftHip) return;
    const stride = clamp(spd / 3.2, 0, 1);
    this.walkPhase += dt * (5.2 + spd * 1.5);
    const p = this.walkPhase;
    const sw = Math.sin(p) * 0.72 * stride;
    const sw2 = Math.sin(p + Math.PI) * 0.72 * stride;

    const set = (n, x, y, z) => { const o = j[n]; if (!o) return; o.rotation.x = x; if (y !== undefined) o.rotation.y = y; if (z !== undefined) o.rotation.z = z; };

    // Signs are the asset's own, measured on its rig and recorded on
    // userData.jointHints: knee flexion is +rotation.x, hip swing forward is -,
    // elbow flex is -. Guessing these gives a soldier who walks backwards
    // through his own knees, and it looks fine in a still.
    set('leftHip', -sw); set('rightHip', -sw2);
    set('leftKnee', clamp(sw * 0.9 + 0.20, 0.05, 1.5));
    set('rightKnee', clamp(sw2 * 0.9 + 0.20, 0.05, 1.5));

    if (aiming) {
      // weapon up, both hands forward, torso turned into the shot
      // A shoulder rotates about a pivot AT the joint, so a large swing plus a
      // large roll visibly separates the upper arm from the torso — a critic
      // reported the figure's arm as detached. Keep the roll small and put the
      // reach into the elbow.
      set('leftShoulder', -1.05, 0, 0.13);
      set('rightShoulder', -1.00, 0, -0.17);
      set('leftElbow', -1.05); set('rightElbow', -1.25);
      if (j.torso) { j.torso.rotation.y = -0.22; j.torso.rotation.x = 0.06 + Math.sin(p * 2) * 0.012 * stride; }
      if (j.head) { j.head.rotation.x = 0.04; j.head.rotation.y = 0.10; }
    } else {
      set('leftShoulder', sw2 * 0.55, 0, 0.14);
      set('rightShoulder', sw * 0.55, 0, -0.14);
      set('leftElbow', -0.34 - Math.abs(sw2) * 0.3);
      set('rightElbow', -0.34 - Math.abs(sw) * 0.3);
      if (j.torso) { j.torso.rotation.y = -sw * 0.10; j.torso.rotation.x = 0.03; }
      if (j.head) { j.head.rotation.x = 0; j.head.rotation.y = Math.sin(this.t * 0.7) * 0.28; }
    }
    if (j.hips) {
      j.hips.position.y = Math.abs(Math.sin(p)) * 0.045 * stride;
      j.hips.rotation.z = Math.sin(p) * 0.05 * stride;
    }
  }

  _death(dt) {
    this.deathT += dt;
    const k = clamp(this.deathT / 0.62, 0, 1);
    const e = 1 - Math.pow(1 - k, 3);
    const j = this.joints;
    this.obj.rotation.y = this.yaw;
    // A cheap, readable collapse: fold at the hips and knees, rotate about the
    // heel in the direction the shot came from.
    const dir = Math.atan2(this.deathDir.x, this.deathDir.z) - this.yaw;
    this.obj.rotation.x = Math.cos(dir) * e * 1.42;
    this.obj.rotation.z = -Math.sin(dir) * e * 1.42;
    this.obj.position.set(this.pos.x, this.pos.y + Math.sin(e * Math.PI) * 0.10, this.pos.z);
    if (j && j.leftKnee) {
      const set = (n, x, y, z) => { const o = j[n]; if (!o) return; o.rotation.x = x; if (y !== undefined) o.rotation.y = y; if (z !== undefined) o.rotation.z = z; };
      set('leftKnee', e * 1.15); set('rightKnee', e * 0.85);
      set('leftHip', -e * 0.35); set('rightHip', -e * 0.15);
      set('leftShoulder', -e * (this.headshotKill ? 1.9 : 0.9), 0, e * 0.7);
      set('rightShoulder', -e * (this.headshotKill ? 1.7 : 0.7), 0, -e * 0.8);
      set('leftElbow', -e * 0.5); set('rightElbow', -e * 0.4);
      if (j.torso) j.torso.rotation.x = e * 0.42;
      if (j.head) j.head.rotation.x = e * (this.headshotKill ? -0.7 : 0.5);
    }
  }
}

/**
 * Fails loudly at boot if the soldier arrived welded. This is the check the
 * whole keepHierarchy warning exists for, and the failure it catches is
 * invisible in every screenshot.
 */
export function assertArticulated(model) {
  const j = model?.userData?.joints;
  const problems = [];
  if (!j) problems.push('no userData.joints — the asset was merged, or never declared them');
  else {
    for (const n of ['hips', 'torso', 'head', 'leftHip', 'leftKnee', 'rightHip', 'rightKnee',
                     'leftShoulder', 'leftElbow', 'rightShoulder', 'rightElbow']) {
      if (!j[n]) { problems.push(`joint "${n}" missing`); continue; }
      if (!j[n].isObject3D) { problems.push(`joint "${n}" is not an Object3D (userData round-tripped through JSON)`); continue; }
      let found = false;
      model.traverse((o) => { if (o === j[n]) found = true; });
      if (!found) problems.push(`joint "${n}" is not inside this instance — it points at the prototype`);
    }
    // and prove one actually moves geometry
    if (j.leftKnee && j.leftKnee.isObject3D) {
      const before = new THREE.Vector3(), after = new THREE.Vector3();
      const mesh = (() => { let m = null; j.leftKnee.traverse((o) => { if (!m && o.isMesh) m = o; }); return m; })();
      if (!mesh) problems.push('leftKnee has no mesh under it, so nothing would move');
      else {
        // Measure a VERTEX, not the mesh's origin. After a per-joint merge the
        // limb mesh sits exactly at the joint with the offset baked into its
        // vertices, so `getWorldPosition` returns the joint's own origin and
        // rotating about it moves that point not at all. The assertion then
        // reports a perfectly articulated figure as welded solid — which is a
        // false alarm in the vocabulary of the one failure it exists to catch.
        const pa = mesh.geometry.attributes.position;
        const vtx = (out) => {
          model.updateMatrixWorld(true);
          let far = -1;
          for (let i = 0; i < pa.count; i += Math.max(1, Math.floor(pa.count / 64))) {
            const v = new THREE.Vector3().fromBufferAttribute(pa, i).applyMatrix4(mesh.matrixWorld);
            const d = v.lengthSq(); if (d > far) { far = d; out.copy(v); }
          }
        };
        vtx(before);
        const r = j.leftKnee.rotation.x;
        j.leftKnee.rotation.x = r + 0.9;
        vtx(after);
        j.leftKnee.rotation.x = r; model.updateMatrixWorld(true);
        if (before.distanceTo(after) < 1e-3) problems.push('rotating leftKnee moved no geometry — the figure is welded solid');
      }
    }
  }
  return problems;
}
