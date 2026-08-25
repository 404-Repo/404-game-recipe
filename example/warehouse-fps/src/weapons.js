/**
 * The weapon: viewmodel, feel, and hitscan.
 *
 * The viewmodel lives in its own scene rendered with its own camera and a
 * cleared depth buffer, which is how every game in this genre does it and the
 * only way a 0.9 m rifle held 40 cm from the eye does not intersect the wall
 * behind it.
 *
 * The rifle and the arms are generated assets loaded with keepHierarchy:true,
 * because the loader's default merge welds an asset solid — it renders
 * perfectly and can never move a part again, and no still frame shows you.
 */
import * as THREE from 'three';
import { WEAPONS, clamp, damp, lerp, rnd } from './config.js';

const FWD = new THREE.Vector3(0, 0, -1);
const VIEW_SCALE = 0.62;

export class Weapon {
  constructor({ viewScene, viewCam, camera, scene, world, fx, audio, player, spec = WEAPONS.carbine }) {
    this.viewScene = viewScene; this.viewCam = viewCam; this.camera = camera; this.scene = scene;
    this.world = world; this.fx = fx; this.audio = audio; this.player = player;
    this.spec = spec;
    this.mag = spec.mag; this.reserve = spec.reserve;
    this.cool = 0; this.reloading = 0; this.adsT = 0;
    this.rig = new THREE.Group();
    this.viewScene.add(this.rig);
    this.sway = new THREE.Vector2();
    this.kick = 0; this.kickRot = new THREE.Vector3();
    this.bob = 0;
    this.sprintT = 0;
    this.onHit = null;      // (target, damage, headshot) => void
    this.enemies = [];
    // Lives in the WORLD scene, not the viewmodel scene. The first version
    // was parented to the weapon rig, so a muzzle flash lit the weapon and
    // left the room it was fired in completely unchanged.
    this.flashLight = new THREE.PointLight(0xffcf95, 0, 11, 1.9);
    this.flashLight.visible = false;
    this._flashT = 0;
    this._ray = new THREE.Raycaster();
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
  }

  attach(rifle, arms, muzzleFlashMesh) {
    this.rifle = rifle; this.arms = arms;
    if (rifle) this.rig.add(rifle);
    if (arms) this.rig.add(arms);
    this._arms = arms;
    this.muzzle = rifle?.userData?.muzzle || null;
    this.ejectPort = rifle?.userData?.ejectPort || null;
    this.magazine = rifle?.userData?.magazine || null;
    this.charging = rifle?.userData?.charging || null;
    this.sightRear = rifle?.userData?.sightRear || null;
    this.sightFront = rifle?.userData?.sightFront || null;
    this.flash = muzzleFlashMesh;
    if (this.flash) { this.flash.visible = false; this.rig.add(this.flash); }
    this.scene.add(this.flashLight);
    if (this.muzzle) {
      const p = new THREE.Vector3();
      this.muzzle.getWorldPosition(p);
      this.rig.worldToLocal(p);
      this.flashLight.position.copy(p);
      if (this.flash) this.flash.position.copy(p);
    }
    // POSE, DERIVED FROM THE ASSET'S OWN GEOMETRY.
    //
    // The first version put a 0.90 m rifle 0.36 m from the eye. The asset is
    // centred on its own origin, so half of it sat BEHIND the camera and what
    // reached the frame was the inside of the barrel — a grey tube across a
    // quarter of the screen that read as a drainpipe. It was invisible in the
    // numbers, survived four rounds of draw-call work, and was obvious in the
    // first filmstrip anyone looked at.
    //
    // So both rest poses are solved rather than guessed: the stock is pushed
    // clear of the near plane, and ADS puts the asset's own declared rear sight
    // exactly on the camera axis.
    this.rig.position.set(0, 0, 0);
    this.rig.rotation.set(0, 0, 0);
    // Viewmodels are not built at world scale. A real 0.90 m carbine held at a
    // real arm's length fills a third of a 64-degree frame; every shooter in
    // this genre shrinks the weapon and pushes it out so it reads as held
    // rather than as pressed against the lens.
    this.rig.scale.setScalar(VIEW_SCALE);
    this.rig.updateMatrixWorld(true);
    // Measure the WEAPON, not the rig: the arms are deliberately stretched
    // past the camera and including them would shove the whole pose forward.
    const bb = new THREE.Box3().setFromObject(this.rifle || this.rig);
    const stockZ = Number.isFinite(bb.max.z) ? bb.max.z : 0.34;

    const rear = new THREE.Vector3();
    if (this.sightRear) { this.sightRear.getWorldPosition(rear); this.rig.worldToLocal(rear); }

    // OUT OF THE AIM BOX. Measured on the previous build, the weapon occluded
    // 32-44% of the central 20% of the frame — the box the crosshair sits in —
    // against a maximum of 0.4% across five real AAA frames. That is not an art
    // problem, it is the player being unable to see what they are shooting at.
    this.hipPos = new THREE.Vector3(0.210, -0.255, -(stockZ + 0.34));
    this.hipRot = new THREE.Vector3(0.052, 0.088, 0.020);
    this.adsPos = this.sightRear
      ? new THREE.Vector3(-rear.x, -rear.y, -0.34 - rear.z)
      : new THREE.Vector3(0, -0.055, -(stockZ + 0.22));
    this.adsRot = new THREE.Vector3(0, 0, 0);
    // Put the hands ON the weapon. Both assets were added at the rig origin,
    // which left the gloves floating in front of the lens with the fingers
    // pointing back at the camera — five fat capsules that read as anything but
    // a hand. The rifle declares its magazine; the firing grip sits just behind
    // and below the magwell, so the arms are offset by whatever moves their own
    // declared gripPoint to that spot.
    if (this._arms && this._arms.userData?.gripPoint && this.magazine) {
      const mag = new THREE.Vector3();
      this.magazine.getWorldPosition(mag); this.rig.worldToLocal(mag);
      const grip = new THREE.Vector3();
      this._arms.userData.gripPoint.getWorldPosition(grip); this.rig.worldToLocal(grip);
      // The firing grip is BEHIND and BELOW the magwell. In rig space the
      // weapon points down -Z, so behind is +Z; the first version offset the
      // hands -Z and put them out in front of the magazine, holding nothing.
      const want = mag.clone().add(new THREE.Vector3(0.004, -0.052, 0.088));
      this._arms.position.add(want.sub(grip));
      this._arms.position.y -= 0.004;
      // Push the forearms back until their cut ends are behind the near
      // plane. Unstretched they stopped 30 cm in front of the eye, and what
      // reached the frame was the sawn-off end of a forearm pointing at the
      // camera — a fat olive tube that read as anything but an arm. Every
      // first-person viewmodel stretches its arms for exactly this reason.
      const ab = new THREE.Box3().setFromObject(this._arms);
      const butt = ab.max.z + this.rig.position.z;   // where the cut end lands in view space
      if (butt < 0.06) this._arms.position.z += (0.06 - butt) / (this.rig.scale.z || 1);
    }

    this.basePose = { hip: this.hipPos.clone(), ads: this.adsPos.clone(), scale: VIEW_SCALE };
    this.setAspect(this.viewCam.aspect);
    this.poseInfo = { stockZ: +stockZ.toFixed(3), hip: this.hipPos.toArray().map((n) => +n.toFixed(3)),
                      ads: this.adsPos.toArray().map((n) => +n.toFixed(3)) };
  }

  /**
   * A phone held upright has a very narrow horizontal field of view, and a
   * weapon sized for 16:9 swallows a third of a portrait frame. Every mobile
   * shooter shrinks and retracts the viewmodel in portrait; without it the
   * game is unplayable one-handed because the gun covers the thing you are
   * shooting at.
   */
  setAspect(aspect) {
    if (!this.basePose || !isFinite(aspect) || aspect <= 0) return;
    const k = aspect >= 1.25 ? 1 : Math.max(0.52, 0.30 + 0.56 * aspect);
    this.rig.scale.setScalar(this.basePose.scale * k);
    this.hipPos.copy(this.basePose.hip).multiplyScalar(1);
    this.hipPos.x = this.basePose.hip.x * k;
    this.hipPos.y = this.basePose.hip.y * k;
    this.hipPos.z = this.basePose.hip.z * (0.72 + 0.28 * k);
    this.adsPos.copy(this.basePose.ads).multiplyScalar(k);
    this.adsPos.z = this.basePose.ads.z * (0.80 + 0.20 * k);
  }

  get canFire() { return this.mag > 0 && this.reloading <= 0 && this.cool <= 0 && this.sprintT < 0.55; }

  startReload() {
    if (this.reloading > 0 || this.mag >= this.spec.mag || this.reserve <= 0) return false;
    this.reloading = this.spec.reload;
    this.audio?.reload();
    return true;
  }

  fire(spreadScale) {
    if (!this.canFire) {
      if (this.mag <= 0 && this.cool <= 0) { this.audio?.dryFire(); this.cool = 0.32; this.startReload(); }
      return null;
    }
    const s = this.spec;
    this.mag--;
    this.cool = 60 / s.rpm;
    this.kick = 1;
    this.kickRot.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1));
    this._flashT = 0.042;
    this._shots = (this._shots || 0) + 1;

    this.player.addRecoil(s.recoil * (1 - this.adsT * 0.42), (Math.random() - 0.5) * 2 * s.recoilH);
    this.player.shake(0.010 * (1 - this.adsT * 0.5), 0.05);
    this.audio?.shot();

    // spread grows with movement and shrinks in ADS
    const moveK = clamp(this.player.speed / 5.0, 0, 1);
    const spread = lerp(s.spread, s.adsSpread, this.adsT) + s.moveSpread * moveK * (1 - this.adsT * 0.6);

    const origin = new THREE.Vector3();
    this.camera.getWorldPosition(origin);
    const dir = FWD.clone().applyQuaternion(this.camera.quaternion);
    // cone, uniform in the disc
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
    const up = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
    const right = dir.clone().cross(up).normalize();
    dir.addScaledVector(up, Math.cos(a) * r).addScaledVector(right, Math.sin(a) * r).normalize();

    const hit = this._trace(origin, dir, s.range);

    if (this.ejectPort) {
      const p = new THREE.Vector3(); this.ejectPort.getWorldPosition(p);
      // the port is in view space; put the case in the world beside the player
      const wp = new THREE.Vector3();
      this.camera.getWorldPosition(wp);
      const rr = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
      const uu = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
      wp.addScaledVector(rr, 0.24).addScaledVector(uu, -0.10).addScaledVector(dir, 0.30);
      this.fx.ejectCase(wp, rr, uu);
    }
    return hit;
  }

  _trace(origin, dir, range) {
    // 1. living things first, by capsule
    let best = null;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const h = e.rayHit(origin, dir, range);
      if (h && (!best || h.t < best.t)) best = { ...h, enemy: e };
    }
    // 2. the world, so a bullet stopped by a crate does not hit the man behind it
    const w = this.world.raycast(origin, dir, best ? best.t : range);
    if (w && (!best || w.t < best.t)) {
      const p = origin.clone().addScaledVector(dir, w.t);
      const n = new THREE.Vector3(w.normal.x, w.normal.y, w.normal.z);
      const kind = /timber|carton|pallet/.test(w.box.tag) ? 'wood'
                 : /container|rack|drum|steel|forklift/.test(w.box.tag) ? 'metal' : 'hard';
      this.fx.impact(p, n, kind);
      this._muzzleTracer(p);
      return { world: true, point: p };
    }
    if (best) {
      const p = origin.clone().addScaledVector(dir, best.t);
      this.fx.impact(p, dir.clone().negate(), 'flesh');
      this._muzzleTracer(p);
      const dmg = this.spec.damage * (best.part === 'head' ? this.spec.headMul : best.part === 'limbs' ? 0.72 : 1);
      if (this.onHit) this.onHit(best.enemy, dmg, best.part === 'head');
      return { enemy: best.enemy, point: p, head: best.part === 'head' };
    }
    const p = origin.clone().addScaledVector(dir, range);
    this._muzzleTracer(p);
    return null;
  }

  _muzzleTracer(to) {
    if ((this._shots % this.spec.tracerEvery) !== 0) return;
    const from = new THREE.Vector3();
    this.camera.getWorldPosition(from);
    const r = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const u = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    from.addScaledVector(r, 0.16).addScaledVector(u, -0.10);
    this.fx.tracer(from, to);
  }

  update(dt, input, wantAds) {
    const s = this.spec;
    this.cool = Math.max(0, this.cool - dt);
    this.adsT = damp(this.adsT, wantAds ? 1 : 0, 15, dt);
    this.sprintT = damp(this.sprintT, (input.sprint && input.move.y > 0.1 && !wantAds && this.player.speed > 4.4) ? 1 : 0, 10, dt);

    if (this.reloading > 0) {
      const before = this.reloading;
      this.reloading -= dt;
      if (this.magazine) {
        const k = 1 - this.reloading / s.reload;
        // out, then in
        const drop = k < 0.42 ? Math.sin(k / 0.42 * Math.PI) : 0;
        this.magazine.position.y = -drop * 0.11;
        this.magazine.rotation.x = drop * 0.5;
      }
      if (before > s.reload * 0.32 && this.reloading <= s.reload * 0.32) this.audio?.magIn();
      if (this.reloading <= 0) {
        const need = s.mag - this.mag;
        const take = Math.min(need, this.reserve);
        this.mag += take; this.reserve -= take;
        if (this.magazine) { this.magazine.position.y = 0; this.magazine.rotation.x = 0; }
        if (this.charging) this.charging.position.z = 0;
      }
    }

    // muzzle flash
    this._flashT = Math.max(0, this._flashT - dt);
    const on = this._flashT > 0;
    if (this.flash) {
      this.flash.visible = on;
      if (on) {
        this.flash.rotation.z = this._flashRot ?? 0;
        if (Math.random() < 0.6) this._flashRot = rnd(0, 6.28);
        // Firing registered nowhere in the frame statistics (hi180 = 0.000):
        // the flash was a small additive card sitting below the bloom
        // threshold, so a shot produced no brightening of the frame at all.
        const k = 1.35 + Math.random() * 0.9;
        this.flash.scale.setScalar(k * (1 - this.adsT * 0.30));
      }
    }
    this.flashLight.visible = on;
    this.flashLight.intensity = on ? 26 : 0;
    if (on) {
      const p = new THREE.Vector3();
      this.camera.getWorldPosition(p);
      const d = FWD.clone().applyQuaternion(this.camera.quaternion);
      const r = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
      this.flashLight.position.copy(p).addScaledVector(d, 0.75).addScaledVector(r, 0.12);
    }

    // --- pose
    this.kick = damp(this.kick, 0, 13, dt);
    const moving = this.player.speed > 0.6 && this.player.onGround;
    this.bob += dt * (this.player.speed * 2.3);
    const bobK = clamp(this.player.speed / 5.2, 0, 1) * (1 - this.adsT * 0.85) * (moving ? 1 : 0);
    this._bobK = damp(this._bobK ?? 0, bobK, 8, dt);

    // sway lags the look, which is most of what makes a weapon feel weighty
    const lookLag = this._lookLag ?? (this._lookLag = new THREE.Vector2());
    lookLag.x = damp(lookLag.x, this.player.yaw, 11, dt);
    lookLag.y = damp(lookLag.y, this.player.pitch, 11, dt);
    const swayX = clamp((this.player.yaw - lookLag.x) * 0.55, -0.10, 0.10) * (1 - this.adsT * 0.75);
    const swayY = clamp((this.player.pitch - lookLag.y) * 0.55, -0.10, 0.10) * (1 - this.adsT * 0.75);

    const pos = this._tmp.copy(this.hipPos).lerp(this.adsPos, this.adsT);
    const rot = this._tmp2.copy(this.hipRot).lerp(this.adsRot, this.adsT);

    // sprint: gun down and across
    const sp = this.sprintT;
    pos.x += sp * 0.075; pos.y -= sp * 0.075; pos.z += sp * 0.030;

    const reloadK = this.reloading > 0 ? Math.sin(clamp(1 - this.reloading / s.reload, 0, 1) * Math.PI) : 0;

    this.rig.position.set(
      pos.x + swayX + Math.sin(this.bob) * 0.0135 * this._bobK - this.kick * 0.010,
      pos.y + swayY + Math.abs(Math.sin(this.bob * 0.5)) * 0.0125 * this._bobK - this.kick * 0.014 - reloadK * 0.085,
      pos.z + this.kick * 0.052,
    );
    this.rig.rotation.set(
      rot.x - swayY * 1.5 + this.kick * 0.085 * (0.5 + this.kickRot.x * 0.5) + this._bobK * Math.sin(this.bob * 0.5) * 0.010 + reloadK * 0.34,
      rot.y - swayX * 1.5 + this.kick * 0.020 * this.kickRot.y + sp * 0.42,
      rot.z + this.kick * 0.026 * this.kickRot.z + this._bobK * Math.sin(this.bob) * 0.014 - sp * 0.30 - reloadK * 0.20,
    );
  }
}
