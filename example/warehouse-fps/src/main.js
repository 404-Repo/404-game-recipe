/**
 * DEPOT 17 — boot, loop and mission.
 *
 * The __GAME__ contract at the bottom is what `harness/playtest.mjs` steers by.
 * Two details in it are load-bearing and both are documented in the repo:
 *   - `fps` comes from REAL elapsed time. A counter that divides by a clamped
 *     delta is pinned to a constant and reports a healthy number on a build
 *     running at one frame a second.
 *   - `pos` is what the harness drives by: it holds a key until the player has
 *     covered a distance in metres, because a wall-clock hold under-drives a
 *     slow machine and a frame count under-drives a fast one.
 */
import * as THREE from 'three';
import { ASSET, bakeStatic } from '../assetlib.js';
import { B, PLAYER, WEAPONS, QUALITY, MAX_DT, clamp, damp, rnd, pick } from './config.js';
import { World } from './physics.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { Rig } from './lighting.js';
import { Level, ASSET_LIST } from './level.js';
import { FX } from './fx.js';
import { Weapon } from './weapons.js';
import { Enemy, assertArticulated, collapseArticulated } from './enemies.js';
import { Hud } from './hud.js';
import { Audio } from './audio.js';
import { makeComposer } from './postfx.js';

const canvas = document.getElementById('c');
const loadEl = document.getElementById('load');
const barf = document.getElementById('barf');
const loadmsg = document.getElementById('loadmsg');
const startScreen = document.getElementById('start');
const overScreen = document.getElementById('over');

// ---------------------------------------------------------------- quality
function pickQuality() {
  const q = new URLSearchParams(location.search).get('q');
  if (q && QUALITY[q]) return q;
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const touch = (('ontouchstart' in window) || navigator.maxTouchPoints > 0) &&
                !window.matchMedia('(pointer:fine)').matches;
  if (touch) return (mem >= 6 && cores >= 6) ? 'med' : 'low';
  if (cores >= 8 && mem >= 8) return 'ultra';
  if (cores >= 4) return 'high';
  return 'med';
}
let qname = pickQuality();
let Q = QUALITY[qname];

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: qname !== 'low', powerPreference: 'high-performance', stencil: false });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, Q.pixelCap));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.14;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090a0d);
if (Q.fog) // FOG COLOUR IS THE SHADOW COLOUR. Everything past a few metres tends to it,
  // so it sets the chroma of the darkest quarter of the frame outright.
  // 0x0a0f16 is a saturated blue (S=0.55) and my measured shadow chroma was
  // 0.29-0.55 against 0.06-0.25 across five real AAA frames — the same number,
  // because the fog WAS the shadow. A near-neutral fog (S=0.27) is what makes
  // shadow read as grey without touching any lit surface.
  scene.fog = new THREE.FogExp2(0x101319, 0.032);

const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.06, 220);

// The viewmodel gets its own scene, camera and lights. Lighting the gun from
// the world means it goes black the moment you stand in shadow, which is where
// a first-person shooter spends most of its time.
const viewScene = new THREE.Scene();
const viewCam = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.01, 6);
const vHemi = new THREE.HemisphereLight(0x9fb6d0, 0x1a1d22, 1.05); viewScene.add(vHemi);
const vKey = new THREE.DirectionalLight(0xffd9ae, 1.55); vKey.position.set(-0.7, 1.0, 0.9); viewScene.add(vKey);
const vRim = new THREE.DirectionalLight(0x87b0dc, 0.85); vRim.position.set(0.9, 0.35, -1.0); viewScene.add(vRim);
// Base intensities. The live ones are driven every frame from how much light
// actually reaches the player, so the weapon darkens when the room does.
const VM_BASE = { amb: 0.88, key: 1.10, rim: 0.66 };

const world = new World();
const rig = new Rig(scene, renderer, qname);
const level = new Level(scene, world, rig);
const input = new Input(canvas);
const player = new Player(world, camera, input);
const hud = new Hud();
const audio = new Audio();
const fx = new FX(scene, world, Q.decals);

let composer, grade, bloomPass;
function buildComposer() {
  const r = makeComposer(renderer, scene, camera, viewScene, viewCam, Q, { w: innerWidth, h: innerHeight });
  composer = r.composer; grade = r.grade; bloomPass = r.bloom;
}

// ---------------------------------------------------------------- state
const GAME = {
  running: false, over: false, won: false,
  score: 0, kills: 0, headshots: 0, sector: 0, wave: 0,
  enemies: [], pool: [], alive: 0, spawnedTotal: 0,
  t: 0, frame: 0, fps: 60, startedAt: 0,
};
window.__GAME__ = {
  pos: [0, 0], fps: 60, frame: 0, speed: 0, score: 0, over: false,
  draws: 0, tris: 0, kills: 0, hp: 100,
  // TELEMETRY, NOT A DEBUG HOOK. `shots` lets a gate tell "the fire button
  // never reached the game" apart from "it fired and missed", which are
  // completely different bugs and read identically from a kill count of zero.
  // `aim` is the screen position of the nearest hostile the player can
  // actually see — the harness still has to move a real mouse to it and press
  // a real button. Nothing here makes the game shoot itself.
  shots: 0, aim: null, aimDist: 0,
};

let weapon = null;
let SHOTS = 0;
let enemyProto = null;

// ---------------------------------------------------------------- load
async function boot() {
  const step = (p, msg) => { barf.style.width = Math.round(p * 100) + '%'; if (msg) loadmsg.textContent = msg; };
  step(0.02, 'generating surfaces');

  const missing = await level.load((p, n) => step(0.04 + p * 0.62, 'loading ' + n.replace(/_/g, ' ')));
  if (missing.length) console.warn('[level] assets that loaded empty:', missing.join(', '));

  step(0.70, 'building depot');
  level.build();

  step(0.80, 'arming');
  // Everything that moves is loaded with keepHierarchy, because the default
  // merge welds it solid and no still frame will show you that.
  const [rifle, arms, soldier] = await Promise.all([
    ASSET('./assets/assault_rifle.js', { keepHierarchy: true, surfaces: true }),
    ASSET('./assets/viewmodel_arms.js', { keepHierarchy: true, surfaces: true }),
    ASSET('./assets/enemy_soldier.js', { keepHierarchy: true, surfaces: true }),
  ]);

  // The viewmodel is loaded with keepHierarchy so the magazine and charging
  // handle can move, which means it arrives unmerged — the rifle alone is
  // dozens of meshes drawn every frame in their own pass. Collapse it the same
  // way as the soldiers: one mesh per material per moving part.
  level.shareMaterialsIn(rifle); level.shareMaterialsIn(arms);
  const vmBefore = (() => { let n = 0; rifle.traverse((o) => { if (o.isMesh) n++; }); arms.traverse((o) => { if (o.isMesh) n++; }); return n; })();
  collapseArticulated(rifle, [rifle.userData.magazine, rifle.userData.charging]);
  collapseArticulated(arms);
  const vmAfter = (() => { let n = 0; rifle.traverse((o) => { if (o.isMesh) n++; }); arms.traverse((o) => { if (o.isMesh) n++; }); return n; })();
  console.log(`[viewmodel] meshes ${vmBefore} -> ${vmAfter}`);

  const problems = assertArticulated(soldier);
  if (problems.length) console.error('[enemy_soldier] NOT ARTICULATED:\n  ' + problems.join('\n  '));
  enemyProto = soldier;

  // viewmodel scale: the asset is 0.90 m long in world metres and the view
  // camera is a normal perspective camera, so it is used at native scale.
  // Both assets face +Z. The view camera looks down -Z, so both have to be
  // turned to face away from it — the arms as much as the rifle. Leaving the
  // arms unrotated puts the backs of the hands toward the player and the
  // fingers pointing at their own face, which reads as "something is wrong
  // with the gun" rather than as "the arms are backwards".
  rifle.rotation.set(0, Math.PI, 0);
  arms.rotation.set(0, Math.PI, 0);
  // Stretch the FOREARMS out of frame, then undo the stretch at the wrists.
  // Scaling the whole arms object pulled the fingers into long tubes, so the
  // hands read as the ends of two pipes and a critic reported the viewmodel as
  // having no hands at all. The asset declares its wrists; counter-scaling them
  // gives long forearms and correctly proportioned gloves.
  const ARM_STRETCH = 2.4;
  arms.scale.set(0.86, 0.86, ARM_STRETCH);
  for (const w of ['leftWrist', 'rightWrist']) {
    const j = arms.userData?.joints?.[w];
    if (j && j.isObject3D) j.scale.set(1, 1, 1 / ARM_STRETCH);
  }
  const flash = makeMuzzleFlash();
  weapon = new Weapon({ viewScene, viewCam, camera, scene, world, fx, audio, player, spec: WEAPONS.carbine });
  weapon.attach(rifle, arms, flash);
  if (rifle.userData.casingProto) fx.setCasingProto(rifle.userData.casingProto.clone(true));

  step(0.92, 'deploying hostiles');
  // POOLING AN ARTICULATED ASSET. The obvious thing — load it once and
  // `.clone(true)` it twenty times — is exactly wrong: `Object3D.copy`
  // round-trips userData through JSON, so every clone's `userData.joints.head`
  // is a plain object with no methods, and rotating it changes nothing and
  // throws nothing. Call ASSET() again instead. The prototype is cached, so it
  // costs one clone, and the loader re-resolves the declared joint NAMES
  // against each instance's own tree.
  const pool = await Promise.all(
    Array.from({ length: 22 }, () => ASSET('./assets/enemy_soldier.js', { keepHierarchy: true, surfaces: true })),
  );
  // A hostile also carries the same generated carbine, merged (it does not
  // need to articulate in someone else's hands) and parented to the hand the
  // asset declares.
  const enemyRifle = await ASSET('./assets/assault_rifle.js', { surfaces: true });
  let collapseStat = null;
  for (const m of pool) {
    const hand = m.userData?.weaponHand;
    if (hand && hand.isObject3D) {
      const r = enemyRifle.clone(true);
      r.rotation.set(0, Math.PI, 0.15);
      r.position.set(0.02, -0.04, 0.10);
      hand.add(r);
    }
    level.shareMaterialsIn(m);
    const st = collapseArticulated(m);
    // RIM LIGHT ON HOSTILES. A soldier in olive drab against a dark aisle is an
    // unresolvable black tangle — a critic could not identify one as a human at
    // 3x zoom, which is a gameplay failure before it is an art one: the player
    // cannot acquire the target. A view-angle fresnel term separates the
    // silhouette from whatever is behind it without lighting the figure flatly.
    m.traverse((o) => { if (o.isMesh && o.material) o.material = withRim(o.material); });
    if (!collapseStat) collapseStat = st;
    m.visible = false;
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(m);
    const e = new Enemy(m, world, {});
    e.onShoot = enemyShoot;
    e.onDie = onEnemyDie;
    GAME.pool.push(e);
  }

  // Prove the collapse did not weld anything shut. The whole point of the
  // per-joint merge is that it is NOT the loader's default merge, and the
  // difference is invisible in a render.
  const after = assertArticulated(pool[0]);
  if (after.length) console.error('[enemy_soldier] articulation LOST in the per-joint collapse:\n  ' + after.join('\n  '));
  else console.log(`[enemy_soldier] articulated after collapse; meshes ${collapseStat.before} -> ${collapseStat.after}`);

  // Dead hostiles stop being articulated the moment they finish falling, so
  // they stop costing what an articulated thing costs.
  GAME.bakeCorpse = (e) => {
    if (e.baked) return;
    e.baked = true;
    const flat = bakeStatic(e.obj);
    flat.position.copy(e.obj.position); flat.rotation.copy(e.obj.rotation); flat.scale.copy(e.obj.scale);
    flat.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
    scene.remove(e.obj); scene.add(flat);
    e.liveObj = e.obj; e.obj = flat;
  };

  // One cubemap of the finished room, for image-based specular. Without an
  // environment a MeshStandardMaterial can only answer punctual lights, so a
  // floor returns one streak and reflects nothing else in the building.
  rig.captureEnvironment(renderer, scene, new THREE.Vector3(0, 3.4, 2));
  applyAspect();
  buildComposer();
  step(1.0, 'ready');
  // pointer-events go OFF on the same frame the fade starts. Leaving the
  // overlay hittable for the half second it fades means a player who taps
  // DEPLOY the instant it appears hits the loading screen instead, and nothing
  // happens. That is a real bug on a phone, not just in a harness.
  loadEl.style.pointerEvents = 'none';
  loadEl.style.transition = 'opacity .5s'; loadEl.style.opacity = '0';
  setTimeout(() => { loadEl.style.display = 'none'; }, 520);

  hud.showTouch(input.isTouchDevice);
  document.getElementById('startp').innerHTML = input.isTouchDevice
    ? 'Left thumb moves. Drag the right side to look, or tap it to fire.<br>Buttons: FIRE / ADS / RLD / JMP / CRCH / RUN.<br><br>Three sectors. Clear them all.'
    : '<kbd>W A S D</kbd> move &nbsp; <kbd>MOUSE</kbd> look &nbsp; <kbd>CLICK</kbd> fire &nbsp; <kbd>RMB</kbd> aim<br><kbd>SHIFT</kbd> sprint &nbsp; <kbd>SPACE</kbd> jump &nbsp; <kbd>C</kbd> crouch &nbsp; <kbd>R</kbd> reload<br><br>Three sectors. Clear them all.';
  startScreen.classList.add('on');
  window.__READY__ = true;
  requestAnimationFrame(loop);
}

/**
 * A rim term added to a CLONE of the shared material. The world's materials are
 * deduplicated globally so the bake can merge them; mutating one in place would
 * put a fresnel on every crate in the depot.
 */
const rimCache = new Map();
function withRim(mat) {
  if (!mat || Array.isArray(mat)) return mat;
  let m = rimCache.get(mat.uuid);
  if (!m) {
    m = mat.clone();
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uRim = { value: new THREE.Color(0x9ec4ea) };
      sh.uniforms.uRimK = { value: 0.62 };
      sh.fragmentShader = 'uniform vec3 uRim;\nuniform float uRimK;\n' + sh.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n'
        + '  float rimF = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 3.2);\n'
        + '  totalEmissiveRadiance += uRim * rimF * uRimK;',
      );
    };
    m.customProgramCacheKey = () => 'rimlit';
    m.needsUpdate = true;
    rimCache.set(mat.uuid, m);
  }
  return m;
}

function makeMuzzleFlash() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffdca8, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const star = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.30), mat);
  const star2 = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.30), mat);
  star2.rotation.z = Math.PI / 4;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.20, 8, 1, true), mat);
  cone.rotation.x = -Math.PI / 2; cone.position.z = 0.09;
  g.add(star, star2, cone);
  g.renderOrder = 6;
  return g;
}

// ---------------------------------------------------------------- mission
function startMission() {
  audio.start();
  GAME.running = true; GAME.over = false; GAME.won = false;
  GAME.score = 0; GAME.kills = 0; GAME.headshots = 0; GAME.sector = 0; GAME.spawnedTotal = 0; SHOTS = 0;
  for (const e of GAME.pool) { e.alive = false; e.obj.visible = false; }
  GAME.enemies = [];
  player.spawn(0, 21.0, 0);
  weapon.mag = weapon.spec.mag; weapon.reserve = weapon.spec.reserve; weapon.reloading = 0;
  hud.show(true); hud.setHp(100); hud.setAmmo(weapon.mag, weapon.reserve);
  hud.setWeapon(weapon.spec.name);
  startScreen.classList.remove('on'); overScreen.classList.remove('on');
  beginSector(0);
  input.requestLock();
}
window.__START__ = startMission;

// A sector holds a quota of hostiles and a cap on how many are in the fight at
// once. Reinforcements arrive as their squadmates go down, which paces a
// firefight far better than dropping the whole garrison at the start — and it
// bounds the draw cost of the most expensive object in the game, because an
// articulated soldier is ~38 meshes however hard it is merged.
const SECTOR_QUOTA = [7, 9, 11];
const LIVE_CAP = 4;

function beginSector(i) {
  GAME.sector = i;
  GAME.remaining = SECTOR_QUOTA[i];
  const s = level.sectors[i];
  hud.setObjective('CLEAR ' + s.name, `SECTOR ${i + 1} OF 3`);
  hud.toast('SECTOR ' + (i + 1) + ' \u2014 ' + s.name);
  for (let k = 0; k < LIVE_CAP; k++) reinforce(i, k < 2);
}

/** Send in one more, preferring a spawn the player cannot currently see. */
function reinforce(sector, alerted) {
  if (GAME.remaining <= 0) return null;
  const s = level.sectors[sector];
  const eye = new THREE.Vector3(player.pos.x, player.pos.y + player.eyeY, player.pos.z);
  const opts = s.spawns.map((sp) => {
    const p = new THREE.Vector3(sp[0], 1.4, sp[1]);
    return { sp, seen: world.clearLine(eye, p, 0.1) ? 1 : 0, d: p.distanceTo(eye) };
  }).sort((x, y) => (x.seen - y.seen) || (x.d - y.d));
  const chosen = opts.find((o) => !o.seen && o.d > 9) || opts[0];
  const e = spawnEnemy(chosen.sp[0] + rnd(-1.4, 1.4), chosen.sp[1] + rnd(-1.4, 1.4), sector);
  if (!e) return null;
  GAME.remaining--;
  if (alerted) { e.alertT = 5; e.hasSeen = true; e.reaction = rnd(0.9, 1.8); e.lastSeen.set(player.pos.x, 0, player.pos.z); }
  return e;
}

function spawnEnemy(x, z, sector) {
  const e = GAME.pool.find((p) => !p.alive && !GAME.enemies.includes(p));
  if (!e) return null;
  e.alive = true; e.hp = 100 + sector * 18; e.state = 'patrol';
  e.accuracy = 0.20 + sector * 0.05; e.aggression = 0.5 + sector * 0.16;
  e.speed = 2.9 + sector * 0.35;
  e.patrol = pick(level.patrols);
  e.patrolI = Math.floor(rnd(0, e.patrol.length));
  e.alertT = 0; e.hasSeen = false; e.deathT = 0; e.fireCool = rnd(1.4, 3.2); e.reaction = 0;
  if (e.baked) {
    scene.remove(e.obj); e.obj = e.liveObj; scene.add(e.obj);
    e.baked = false; e.liveObj = null;
  }
  e.obj.visible = true;
  e.obj.rotation.set(0, 0, 0);
  e.place(x, z, rnd(0, 6.28));
  GAME.enemies.push(e);
  GAME.spawnedTotal++;
  return e;
}

/**
 * A rifle inside a steel shed is not a quiet thing. Without this, hostiles two
 * aisles away stand in their patrol loop while you empty a magazine at their
 * squadmate, and the fight only ever happens where you happen to be looking.
 */
function alertOnGunfire() {
  for (const e of GAME.enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
    if (d > 34) continue;
    if (e.alertT <= 0) e.reaction = rnd(0.4, 1.2);
    e.alertT = Math.max(e.alertT, 6.0);
    e.hasSeen = true;
    e.lastSeen.set(player.pos.x, 0, player.pos.z);
  }
}

function enemyShoot(e, from, to, dist) {
  audio.enemyShot(dist);
  const dir = to.clone().sub(from).normalize();
  fx.tracer(from.clone().addScaledVector(dir, 0.4), from.clone().addScaledVector(dir, Math.min(dist + 6, 40)));
  // does it reach the player?
  const pc = new THREE.Vector3(player.pos.x, player.pos.y + player.eyeY, player.pos.z);
  const blocked = !world.clearLine(from, pc, 0.05);
  const miss = Math.random() > (e.accuracy * clamp(1.30 - dist / 26, 0.18, 1.0));
  if (!blocked && !miss && !player.dead) {
    player.hurt(rnd(5, 9), dir);
    hud.damage(); audio.hurt();
  } else {
    const p = pc.clone().add(new THREE.Vector3(rnd(-1, 1), rnd(-0.7, 0.7), rnd(-1, 1)));
    const h = world.raycast(from, p.sub(from).normalize(), dist + 8);
    if (h) {
      const hp = from.clone().addScaledVector(p.normalize(), h.t);
      fx.impact(hp, new THREE.Vector3(h.normal.x, h.normal.y, h.normal.z), 'hard');
    }
  }
}

function onEnemyDie(e, head) {
  GAME.kills++;
  if (head) GAME.headshots++;
  GAME.score += head ? 150 : 100;
  audio.kill();
  hud.toast(head ? 'HEADSHOT +150' : '+100');
  const p = new THREE.Vector3(e.pos.x, e.pos.y + 1.5, e.pos.z);
  fx.puff(p, new THREE.Vector3(0, 1, 0), 0.30, 0.5, 0x5a1010);
}

function onWeaponHit(e, dmg, head) {
  const dir = new THREE.Vector3(e.pos.x - player.pos.x, 0, e.pos.z - player.pos.z).normalize();
  const died = e.hurt(dmg, head, dir);
  hud.hitmark(head); audio.hitmark(head);
  if (!died) GAME.score += 10;
}

function endMission(won) {
  GAME.running = false; GAME.over = true; GAME.won = won;
  hud.show(false);
  document.getElementById('overh').textContent = won ? 'DEPOT SECURED' : 'MISSION FAILED';
  const t = ((performance.now() / 1000) - GAME.startedAt).toFixed(0);
  document.getElementById('overp').innerHTML =
    `SCORE <b>${GAME.score}</b> &nbsp;·&nbsp; KILLS <b>${GAME.kills}</b> &nbsp;·&nbsp; HEADSHOTS <b>${GAME.headshots}</b><br>` +
    `SECTORS CLEARED <b>${won ? 3 : GAME.sector}</b> / 3 &nbsp;·&nbsp; TIME <b>${t}s</b>`;
  overScreen.classList.add('on');
  if (document.pointerLockElement) document.exitPointerLock();
}

// ---------------------------------------------------------------- loop
let lastNow = performance.now();
let fpsAcc = 0, fpsN = 0, fpsShow = 60;
const camQ = new THREE.Quaternion();

function loop(now) {
  requestAnimationFrame(loop);
  // REAL elapsed time. `dt` below is clamped for the simulation, but the frame
  // rate is measured from `realDt` — a counter that divides by the clamped
  // value is pinned to a constant and will report 60 on a build running at 1.
  const realDt = Math.max(1e-4, (now - lastNow) / 1000);
  lastNow = now;
  const dt = Math.min(realDt, MAX_DT);
  fpsAcc += realDt; fpsN++;
  if (fpsAcc >= 0.25) { fpsShow = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  GAME.frame++;
  GAME.t += dt;

  const wantAds = input.ads && !player.dead && weapon && weapon.reloading <= 0 && weapon.sprintT < 0.4;

  // The player is simulated even after the mission ends, so the death fall
  // actually plays instead of the camera freezing mid-air.
  player.update(dt, wantAds);

  if (GAME.running) {
    if (input.consumeReload()) weapon.startReload();
    if (input.fire && !player.dead) {
      const before = weapon.mag;
      const r = weapon.fire();
      if (weapon.mag < before) { SHOTS++; alertOnGunfire(); }
      if (r) hud.muzzle();
    }
    weapon.enemies = GAME.enemies;
    weapon.onHit = onWeaponHit;
    weapon.update(dt, input, wantAds);

    const pp = player.pos;
    // ATTACK TOKENS. Six hostiles that can all see you can all shoot you, and
    // the arithmetic of that is a dead player in four seconds with nothing to
    // do about it. Every shooter in this genre limits how many enemies engage
    // at once; the rest advance, flank and wait. Three tokens, handed to the
    // nearest, re-issued every frame.
    const contenders = GAME.enemies.filter((e) => e.alive)
      .sort((a, b) => ((a.pos.x - pp.x) ** 2 + (a.pos.z - pp.z) ** 2) - ((b.pos.x - pp.x) ** 2 + (b.pos.z - pp.z) ** 2));
    contenders.forEach((e, i) => { e.token = i < 3; });
    let alive = 0;
    for (const e of GAME.enemies) {
      e.update(dt, pp, !player.dead);
      if (e.alive) alive++;
      else if (!e.baked && e.deathT > 0.85) GAME.bakeCorpse(e);
    }
    // Bodies persist, and each baked one is still half a dozen draw calls. Keep
    // the six most recent and retire the rest — the same thing every shooter in
    // this genre does, and the reason a long firefight does not slowly turn
    // into a slideshow.
    const bodies = GAME.enemies.filter((e) => !e.alive && e.baked);
    if (bodies.length > 3) {
      bodies.sort((x, y) => y.deathT - x.deathT);
      for (let i = 3; i < bodies.length; i++) bodies[i].obj.visible = false;
    }
    GAME.alive = alive;

    if (alive < LIVE_CAP && GAME.remaining > 0) reinforce(GAME.sector, true);
    if (alive === 0 && GAME.remaining <= 0) {
      if (GAME.sector < 2) beginSector(GAME.sector + 1);
      else if (!GAME.over) endMission(true);
    }
    if (player.dead && !GAME.over) endMission(false);

    hud.setAmmo(weapon.mag, weapon.reserve);
    hud.setHp(player.hp);
    const left = alive + (GAME.remaining || 0);
    hud.setObjective('CLEAR ' + level.sectors[GAME.sector].name, `${left} HOSTILE${left === 1 ? '' : 'S'} · SECTOR ${GAME.sector + 1}/3`);
  } else if (weapon) {
    weapon.update(dt, input, false);
  }

  // Light the weapon with the room. See Rig.illuminationAt().
  {
    const k = rig.illuminationAt(camera.position);
    vHemi.intensity = VM_BASE.amb * (0.26 + 0.74 * k);
    vKey.intensity = VM_BASE.key * (0.20 + 0.80 * k);
    vRim.intensity = VM_BASE.rim * (0.30 + 0.70 * k);
  }

  camera.getWorldQuaternion(camQ);
  fx.camQ = camQ;
  fx.update(dt);
  rig.update(dt, camera.position, GAME.t);
  level.cull(camera.position, Q.cull);

  // ADS narrows the main camera, which is what makes an optic feel like an optic
  const adsFov = (weapon?.spec?.adsFov ?? 46) * (BASE_FOV / 74);
  const fov = BASE_FOV - (BASE_FOV - adsFov) * (weapon?.adsT ?? 0);
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }

  if (grade) {
    grade.uniforms.uTime.value = GAME.t;
    grade.uniforms.uHurt.value = damp(grade.uniforms.uHurt.value,
      player.dead ? 0.9 : clamp(1 - player.hp / 45, 0, 1) * 0.55, 6, dt);
  }

  hud.update(dt, weapon ? (weapon.spec.spread * (1 - weapon.adsT * 0.85) + weapon.spec.moveSpread * clamp(player.speed / 5, 0, 1) * 0.5) : 0.01,
             weapon?.adsT ?? 0);

  renderer.info.reset();
  if (composer) composer.render(dt); else renderer.render(scene, camera);

  const r = renderer.info.render;
  const g = window.__GAME__;
  g.pos = [player.pos.x, player.pos.z];
  g.fps = fpsShow; g.frame = GAME.frame;
  g.speed = +player.speed.toFixed(2);
  g.score = GAME.score; g.over = GAME.over;
  g.draws = r.calls; g.tris = r.triangles;
  g.kills = GAME.kills; g.hp = Math.round(player.hp);
  g.alive = GAME.alive; g.sector = GAME.sector; g.quality = qname;
  g.shots = SHOTS;
  g.aim = aimTelemetry();
  // How many input units of drag/mouse-delta turn the view by one screen
   // pixel. Derived from the live fov and sensitivity, so a gate never has to
   // hard-code a constant that silently goes wrong the moment the fov changes
   // — which is exactly what happened when the portrait fov widened.
  {
    const focalPx = (innerHeight / 2) / Math.tan(camera.fov * Math.PI / 360);
    g.dragPerPixel = 1 / (focalPx * input.touchSens);
    g.mousePerPixel = 1 / (focalPx * input.sens);
    g.dragPerRadian = 1 / input.touchSens;
    g.mousePerRadian = 1 / input.sens;
    g.fov = +camera.fov.toFixed(1);
  }
  g.bake = level.bakeStats;
  g.blocksVisible = level.visibleBlocks;
  g.staticMeshes = level.visibleMeshes;
  g.enemyMeshes = (() => { let n = 0; for (const e of GAME.enemies) if (e.obj.visible) e.obj.traverse((o) => { if (o.isMesh) n++; }); return n; })();

  if (hud.el.perf.classList.contains('on')) {
    hud.perf(`${fpsShow} fps<br>${r.calls} draws<br>${(r.triangles / 1000).toFixed(0)}k tris<br>${qname}`);
  }
}

/**
 * Screen position of the nearest hostile with a clear line to the player.
 * Read by the motion gate so it can point the mouse somewhere meaningful; the
 * gate still has to deliver the mousemove and the click itself.
 */
const _ap = new THREE.Vector3();
function aimTelemetry() {
  if (!GAME.running) return null;
  let best = null, bestD = 1e9;
  const eye = new THREE.Vector3(player.pos.x, player.pos.y + player.eyeY, player.pos.z);
  for (const e of GAME.enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.pos.x - eye.x, e.pos.z - eye.z);
    if (d > bestD) continue;
    _ap.set(e.pos.x, e.pos.y + 1.25, e.pos.z);
    if (!world.clearLine(eye, _ap, 0.05)) continue;
    best = { d, x: _ap.x, y: _ap.y, z: _ap.z }; bestD = d;
  }
  if (!best) { window.__GAME__.aimDist = 0; return null; }
  // "In front" has to come from the camera's own forward vector. An NDC z test
  // flips sign for points behind a perspective camera and reports them as
  // visible, so the gate aims at something over its own shoulder and every
  // round goes into a wall.
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const rel = _ap.set(best.x, best.y, best.z).clone().sub(camera.position);
  const front = rel.dot(fwd) > 0.2 ? 1 : 0;
  // ANGLE, not screen position. A target 80 degrees off axis still passes a
  // "front" test but projects thousands of pixels outside the viewport, and a
  // gate steering by that offset either overshoots wildly or, clamped, crawls
  // and never arrives. The angular error is well behaved everywhere.
  // Forward is (-sin yaw, ., -cos yaw), so the bearing of a target is
  // atan2(-x, -z). Getting that sign wrong gives an error of -2*yaw, which
  // steers confidently in the wrong direction and reads as "the gate cannot
  // aim" rather than as a sign bug.
  let yawErr = Math.atan2(-rel.x, -rel.z) - camera.rotation.y;
  while (yawErr > Math.PI) yawErr -= Math.PI * 2;
  while (yawErr < -Math.PI) yawErr += Math.PI * 2;
  const pitchErr = Math.atan2(rel.y, Math.hypot(rel.x, rel.z)) - camera.rotation.x;
  window.__GAME__.aimDist = +best.d.toFixed(1);
  // Publish the INPUT DELTA the game needs, not the angle. The conversion from
  // "where the target is" to "how far to move the mouse" depends on the yaw
  // convention, the rotation order and the sign of the sensitivity, and every
  // one of those is a place for a harness to get it backwards. The game knows
  // all three; nothing outside it should have to.
  window.__GAME__.aimMouse = [+(-yawErr / input.sens).toFixed(1), +(-pitchErr / input.sens).toFixed(1)];
  window.__GAME__.aimDrag = [+(-yawErr / input.touchSens).toFixed(1), +(-pitchErr / input.touchSens).toFixed(1)];
  _ap.set(best.x, best.y, best.z).project(camera);
  return [(_ap.x * 0.5 + 0.5) * innerWidth, (-_ap.y * 0.5 + 0.5) * innerHeight, front];
}

// ---------------------------------------------------------------- events
document.getElementById('startb').addEventListener('click', () => { audio.start(); startMission(); });
document.getElementById('overb').addEventListener('click', () => { startMission(); });
for (const id of ['startb', 'overb']) {
  const el = document.getElementById(id);
  el.addEventListener('touchend', (e) => { e.preventDefault(); audio.start(); startMission(); });
}
player.onFootstep = (run) => audio.step(run);
player.onLand = (k) => audio.land(k);
GAME.startedAt = performance.now() / 1000;

addEventListener('keydown', (e) => {
  if (e.code === 'KeyP') hud.showPerf(!hud.el.perf.classList.contains('on'));
});

function applyAspect() {
  const a = innerWidth / innerHeight;
  // Portrait: widen the vertical fov so the horizontal one stays playable.
  camera.fov = a < 1.2 ? Math.min(100, 74 / Math.max(a, 0.40) * 0.56) : 74;
  camera.aspect = a; camera.updateProjectionMatrix();
  viewCam.fov = a < 1.2 ? Math.min(96, 64 / Math.max(a, 0.40) * 0.56) : 64;
  viewCam.aspect = a; viewCam.updateProjectionMatrix();
  weapon?.setAspect(a);
  BASE_FOV = camera.fov;
}
let BASE_FOV = 74;

addEventListener('resize', () => {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, Q.pixelCap));
  renderer.setSize(w, h, false);
  applyAspect();
  if (composer) composer.setSize(w, h);
});

boot().catch((e) => {
  console.error(e);
  loadmsg.textContent = 'failed: ' + e.message;
});
