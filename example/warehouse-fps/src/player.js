import * as THREE from 'three';
import { PLAYER as P, clamp, damp, lerp } from './config.js';

export class Player {
  constructor(world, camera, input) {
    this.world = world; this.camera = camera; this.input = input;
    this.pos = new THREE.Vector3(0, 0, 18);
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI; this.pitch = 0;
    this.onGround = true;
    this.crouching = false; this.crouchT = 0;
    this.hp = P.maxHp; this.lastHurt = -99;
    this.bob = 0; this.bobAmt = 0;
    this.lean = 0; this.roll = 0;
    this.speed = 0;
    this.adsT = 0;
    this.landKick = 0;
    this.shakeT = 0; this.shakeMag = 0;
    this.recoilPitch = 0; this.recoilYaw = 0;
    this.dead = false;
    this.footstep = 0;
    this.onFootstep = null;
    this.onLand = null;
  }

  spawn(x, z, yaw) {
    this.pos.set(x, 0, z); this.vel.set(0, 0, 0);
    this.yaw = yaw; this.pitch = 0; this.hp = P.maxHp; this.dead = false;
    this.crouchT = 0; this.adsT = 0; this.recoilPitch = 0; this.recoilYaw = 0;
  }

  hurt(n, fromDir) {
    if (this.dead) return;
    this.hp -= n;
    this.lastHurt = performance.now() / 1000;
    this.shake(0.055, 0.16);
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
    this.hurtDir = fromDir;
  }

  shake(mag, time) { this.shakeMag = Math.max(this.shakeMag, mag); this.shakeT = Math.max(this.shakeT, time); }

  addRecoil(p, y) { this.recoilPitch += p; this.recoilYaw += y; }

  get eyeY() { return lerp(P.eye, P.eyeCrouch, this.crouchT); }

  update(dt, wantAds) {
    const inp = this.input;
    const look = inp.sample(dt);
    if (!this.dead) {
      this.yaw += look.x;
      this.pitch = clamp(this.pitch + look.y, -1.50, 1.50);
    }

    // --- crouch, with a real headroom test so you cannot stand up inside a rack
    const wantCrouch = inp.crouch && !this.dead;
    if (!wantCrouch && this.crouchT > 0) {
      const ceil = this.world.ceilAt(this.pos.x, this.pos.z, P.radius, this.pos.y + 0.1);
      if (ceil - this.pos.y < P.height + 0.05) { /* blocked, stay down */ }
      else this.crouchT = damp(this.crouchT, 0, 13, dt);
    } else if (wantCrouch) {
      this.crouchT = damp(this.crouchT, 1, 13, dt);
    }
    this.crouching = this.crouchT > 0.5;

    this.adsT = damp(this.adsT, wantAds ? 1 : 0, 15, dt);

    // --- desired velocity in world space
    const sprinting = inp.sprint && inp.move.y > 0.1 && !this.crouching && !wantAds && !this.dead;
    let target = P.walk;
    if (sprinting) target = P.sprint;
    if (this.crouching) target *= P.crouchMul;
    if (wantAds) target *= P.adsMul;
    if (this.dead) target = 0;

    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const fx = -s, fz = -c;          // forward
    const rx = c, rz = -s;           // right
    const wishX = (fx * inp.move.y + rx * inp.move.x);
    const wishZ = (fz * inp.move.y + rz * inp.move.x);
    const wl = Math.hypot(wishX, wishZ);
    const wx = wl > 1e-4 ? wishX / wl : 0, wz = wl > 1e-4 ? wishZ / wl : 0;
    const wish = Math.min(wl, 1) * target;

    const accel = this.onGround ? P.accel : P.airAccel;
    const cur = this.vel.x * wx + this.vel.z * wz;
    const add = clamp(wish - cur, 0, accel * dt);
    this.vel.x += wx * add; this.vel.z += wz * add;

    if (this.onGround && wl < 1e-4) {
      const sp = Math.hypot(this.vel.x, this.vel.z);
      if (sp > 0) {
        const drop = Math.max(sp - Math.max(sp, 2.0) * P.friction * dt, 0);
        this.vel.x *= drop / sp; this.vel.z *= drop / sp;
      }
    }

    // --- jump / gravity
    if (inp.consumeJump() && this.onGround && !this.crouching && !this.dead) {
      this.vel.y = P.jump; this.onGround = false;
    }
    this.vel.y -= P.gravity * dt;

    // --- integrate xz with collision
    const h = P.height * (1 - 0.42 * this.crouchT);
    const r = P.radius;
    const res = this.world.moveXZ(this.pos.x, this.pos.y, this.pos.z, r, h,
                                  this.vel.x * dt, this.vel.z * dt, P.stepUp);
    if (res.hit) {
      // kill the component into the wall so we do not accumulate speed against it
      const mx = (res.x - this.pos.x) / (dt || 1e-6), mz = (res.z - this.pos.z) / (dt || 1e-6);
      if (Math.abs(mx) < Math.abs(this.vel.x) * 0.6) this.vel.x = mx;
      if (Math.abs(mz) < Math.abs(this.vel.z) * 0.6) this.vel.z = mz;
    }
    this.pos.x = res.x; this.pos.z = res.z;

    // --- vertical
    const wasAir = !this.onGround;
    this.pos.y += this.vel.y * dt;
    const floor = this.world.floorAt(this.pos.x, this.pos.z, r, this.pos.y);
    if (this.pos.y <= floor) {
      if (wasAir && this.vel.y < -3.5) {
        this.landKick = clamp(-this.vel.y / P.jump, 0, 1.6) * 0.10;
        this.shake(0.02 * clamp(-this.vel.y / 8, 0, 1.4), 0.12);
        if (this.onLand) this.onLand(clamp(-this.vel.y / 9, 0, 1));
      }
      this.pos.y = floor; this.vel.y = 0; this.onGround = true;
    } else {
      this.onGround = false;
    }
    const ceil = this.world.ceilAt(this.pos.x, this.pos.z, r, this.pos.y + h * 0.5);
    if (this.pos.y + h > ceil && this.vel.y > 0) { this.vel.y = 0; this.pos.y = ceil - h; }

    // --- health regen
    const now = performance.now() / 1000;
    if (!this.dead && this.hp < P.maxHp && now - this.lastHurt > P.regenDelay) {
      this.hp = Math.min(P.maxHp, this.hp + P.regenRate * dt);
    }

    // --- camera: bob, sway, recoil recovery, shake
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    const moving = this.onGround && this.speed > 0.6;
    const bobRate = sprinting ? 13.2 : 9.4;
    if (moving) {
      this.bob += dt * bobRate * (this.speed / P.walk);
      const phase = Math.sin(this.bob);
      if (phase < 0 && this._lastPhase >= 0) { if (this.onFootstep) this.onFootstep(sprinting); }
      this._lastPhase = phase;
    }
    this.bobAmt = damp(this.bobAmt, moving ? (sprinting ? 1 : 0.62) : 0, 9, dt);
    this.landKick = damp(this.landKick, 0, 9, dt);

    this.recoilPitch = damp(this.recoilPitch, 0, 8.5, dt);
    this.recoilYaw = damp(this.recoilYaw, 0, 8.5, dt);
    this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.shakeT <= 0) this.shakeMag = damp(this.shakeMag, 0, 12, dt);

    // strafe roll — small, but it is most of what makes a first-person camera
    // feel like a body rather than a floating eye
    const strafe = (this.vel.x * (Math.cos(this.yaw)) + this.vel.z * (-Math.sin(this.yaw))) / P.walk;
    this.roll = damp(this.roll, clamp(-strafe, -1, 1) * 0.026 * (1 - this.adsT * 0.7), 7, dt);

    this.applyCamera(dt);
  }

  applyCamera(dt) {
    const cam = this.camera;
    const bobY = Math.sin(this.bob * 2) * 0.031 * this.bobAmt;
    const bobX = Math.sin(this.bob) * 0.026 * this.bobAmt;
    const sh = this.shakeMag;
    const t = performance.now() * 0.001;
    const shx = sh ? (Math.sin(t * 61.3) + Math.sin(t * 37.7)) * 0.5 * sh : 0;
    const shy = sh ? (Math.sin(t * 53.1) + Math.sin(t * 43.3)) * 0.5 * sh : 0;

    const deadDrop = this.dead ? 1 : 0;
    cam.position.set(
      this.pos.x + bobX * Math.cos(this.yaw) + shx,
      this.pos.y + this.eyeY - this.landKick + bobY - deadDrop * 0.95 + shy,
      this.pos.z - bobX * Math.sin(this.yaw),
    );
    cam.rotation.set(0, 0, 0);
    cam.rotation.order = 'YXZ';
    cam.rotation.y = this.yaw + this.recoilYaw;
    cam.rotation.x = clamp(this.pitch + this.recoilPitch, -1.55, 1.55);
    cam.rotation.z = this.roll + (this.dead ? 0.55 : 0);
  }
}
