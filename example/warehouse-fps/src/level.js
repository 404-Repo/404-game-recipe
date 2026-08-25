/**
 * DEPOT 17 — the level.
 *
 * Layout is AUTHORED, not generated. Placement rules do not compose: a rule
 * that scatters crates sensibly and a rule that lines racking up sensibly
 * produce, together, a warehouse where the crates are inside the racking. Every
 * coordinate below was chosen, and the only procedural part is small jitter on
 * things that would look machined without it.
 *
 * Cost discipline, from the repo's own measurements:
 *  - Draw calls dominate, not triangles. A few hundred placed props is a few
 *    hundred draws before anything is merged.
 *  - So static scenery is baked with bakeStatic() PER BLOCK. Baking the whole
 *    world into one mesh fixes the draw count and destroys frustum culling,
 *    which costs more than it saved.
 *  - Collision boxes are taken from each object BEFORE its block is baked,
 *    because after the bake there are no individual objects left.
 */
import * as THREE from 'three';
import { ASSET, bakeStatic, preloadAssets } from '../assetlib.js';
import { setSurfaceDefaults } from '../surfaces.js';
import { B, PAL, rnd, rndi, pick, clamp } from './config.js';

const A = (n) => `./assets/${n}.js`;

// The locked palette, in sRGB 0..1, as the snap target.
const PAL_SRGB = Object.values(PAL).map((h) => [
  ((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255,
]);

export const ASSET_LIST = [
  'structural_bay', 'wall_panel_bay', 'roller_shutter_door', 'floor_bay_slab',
  'catwalk_section', 'steel_stair_flight', 'duct_run_section', 'pipe_run_bracketed',
  'pallet_rack_bay', 'wooden_pallet', 'carton_pallet_load', 'wire_cage_pallet',
  'shipping_container_20ft', 'oil_drum', 'ibc_tote', 'gas_cylinder_rack',
  'forklift', 'pallet_jack', 'cable_reel', 'conveyor_section',
  'high_bay_lamp', 'wall_flood_light', 'exit_sign_box', 'electrical_panel',
  'jersey_barrier', 'sandbag_wall', 'chainlink_fence_section', 'site_office_cabin',
  'ammo_crate', 'tool_chest_trolley',
];

// Blocks are 16 m x 16 m, giving exactly six over the building footprint.
//
// This number was measured, not chosen, and it went the opposite way to
// intuition. `bakeStatic` collapses a block to one mesh per material VALUE, so
// the static cost of the level is roughly blocks x materials-in-that-block —
// splitting into more blocks does not divide the work, it MULTIPLIES the mesh
// count and then relies on culling to win it back. Measured on this level:
//
//     block size   blocks   static meshes   peak draws
//     16 x 12          20             734         1644
//      8 x  8          24            ~1100        2163
//     16 x 16           6             ~330         (below)
//
// The repo's warning still holds in the other direction — one bake over the
// whole world cannot be frustum-culled at all, and every triangle behind you is
// still submitted. Six is the point where the bake has collapsed as much as it
// can and there is still something for the frustum to throw away.
const BX = 16, BZ = 16;

export class Level {
  constructor(scene, world, rig) {
    this.scene = scene; this.world = world; this.rig = rig;
    this.blocks = new Map();
    this.spawnPoints = [];
    this.sectors = [];
    this.missing = [];
    this.placed = 0;
    this.root = new THREE.Group();
    scene.add(this.root);
  }

  /**
   * One shared material per QUANTISED appearance, across the whole level.
   *
   * `assetlib` merges by material VALUES, which is exactly right, and the style
   * lock asked every agent for "3-8% variation between parts of the same
   * object" so the set would not look injection-moulded. Those two rules
   * multiply: thirty-three asset types times five-ish materials each, none of
   * them landing on the same float, produced ~150 distinct material values per
   * baked block and 1,340 meshes across the level. Nothing merges with anything
   * from a different asset.
   *
   * Snapping colour to 24 steps in sRGB and roughness/metalness to 1/12 puts
   * near-identical materials back onto the same value so the bake can collapse
   * them. The step is below the threshold at which the variation was visible in
   * the first place — and the procedural surface maps, which are what actually
   * carries per-texel variation, are untouched.
   */
  _shareMaterial(m) {
    if (!m || Array.isArray(m)) return m;
    const q = (v, n) => Math.round(v * n) / n;
    let r = 0, g = 0, b = 0;
    if (m.color) {
      const c = m.color.clone().convertLinearToSRGB();
      // SNAP TO THE LOCKED PALETTE. Every agent was handed the same twenty hex
      // values and told to vary parts of the same object by 3-8% so the set
      // would not look injection-moulded. That worked, and it also meant no two
      // assets ever landed on the same float, so nothing merged with anything
      // from a different module: 207 distinct materials and 1,127 meshes after
      // the bake. Snapping back onto the palette the variation was measured
      // FROM is close to lossless — the per-texel variation that actually
      // carries the surface comes from surfaces.js, which is untouched — and it
      // is what lets bakeStatic collapse across assets instead of within them.
      let best = null, bd = 1e9;
      for (const p of PAL_SRGB) {
        const d = (p[0] - c.r) ** 2 + (p[1] - c.g) ** 2 + (p[2] - c.b) ** 2;
        if (d < bd) { bd = d; best = p; }
      }
      if (best && bd < 0.075) { r = best[0]; g = best[1]; b = best[2]; }
      else { r = q(c.r, 10); g = q(c.g, 10); b = q(c.b, 10); }
    }
    const key = [
      m.type, `${r},${g},${b}`, q(m.roughness ?? 1, 3), q(m.metalness ?? 0, 3),
      m.transparent ? 1 : 0, q(m.opacity ?? 1, 10), m.side, m.flatShading ? 1 : 0,
      m.emissive ? m.emissive.getHexString() : '-', m.emissiveIntensity ?? 1,
      m.vertexColors ? 1 : 0,
      m.map?.uuid ?? '-', m.roughnessMap?.uuid ?? '-', m.normalMap?.uuid ?? '-',
    ].join('|');
    let out = this.matCache.get(key);
    if (!out) {
      out = m.clone();
      if (m.color) out.color.setRGB(r, g, b).convertSRGBToLinear();
      out.roughness = q(m.roughness ?? 1, 3);
      out.metalness = q(m.metalness ?? 0, 3);
      this.matCache.set(key, out);
    }
    return out;
  }

  shareMaterialsIn(root) {
    root.traverse((o) => { if (o.isMesh && o.material) o.material = this._shareMaterial(o.material); });
    return root;
  }

  _blockFor(x, z) {
    // Clamp to the building footprint. The roof, the wall panels and the
    // floor tiles overhang it slightly, and unclamped that spawned eight
    // extra blocks holding ten meshes each — eighty draw calls of pure
    // bookkeeping, all of them inside the cull radius at all times.
    const cx = Math.max(-B.halfX + 0.1, Math.min(B.halfX - 0.1, x));
    const cz = Math.max(-B.halfZ + 0.1, Math.min(B.halfZ - 0.1, z));
    const k = `${Math.floor(cx / BX)},${Math.floor(cz / BZ)}`;
    let g = this.blocks.get(k);
    if (!g) { g = new THREE.Group(); this.blocks.set(k, g); }
    return g;
  }

  /**
   * Place one asset instance. Registers collision from the object's own
   * measured bounds, then hands it to its block for baking later.
   */
  put(name, { x, y = 0, z, ry = 0, rx = 0, rz = 0, height, solid = true, tag, scale, scaleV, shrink = 0, center = false }) {
    const proto = this.protos[name];
    if (!proto) { return null; }
    const o = proto.clone(true);
    if (height) {
      const n = this.sizes[name];
      if (n && n.y > 1e-6) o.scale.setScalar(height / n.y);
    }
    if (scale) o.scale.multiplyScalar(scale);
    if (scaleV) o.scale.multiply(new THREE.Vector3(scaleV.x ?? 1, scaleV.y ?? 1, scaleV.z ?? 1));
    o.position.set(x, y, z);
    o.rotation.set(rx, ry, rz);
    o.updateMatrixWorld(true);
    if (center) {
      // Placement by measured bounds rather than by the asset's origin. A prop
      // rotated about its own base no longer sits where its coordinate says,
      // and for tiling ceiling panels that gap is the whole roof.
      const bb = new THREE.Box3().setFromObject(o);
      const c = bb.getCenter(new THREE.Vector3());
      o.position.x += x - c.x; o.position.z += z - c.z; o.position.y += y - bb.min.y;
      o.updateMatrixWorld(true);
    }
    if (solid) {
      const b = new THREE.Box3().setFromObject(o);
      if (isFinite(b.min.x)) {
        const sh = shrink;
        this.world.add(
          { x: b.min.x + sh, y: b.min.y, z: b.min.z + sh },
          { x: b.max.x - sh, y: b.max.y, z: b.max.z - sh },
          tag || name,
        );
      }
    }
    this._blockFor(x, z).add(o);
    this.placed++;
    return o;
  }

  async load(onProgress) {
    setSurfaceDefaults({ on: true });
    let done = 0;
    this.protos = {}; this.sizes = {};
    this.matCache = new Map();
    await Promise.all(ASSET_LIST.map(async (n) => {
      const o = await ASSET(A(n), { surfaces: true });
      // The floor is 40% of every frame and a matte Lambert plane is the single
      // biggest thing separating this from the reference: real depot concrete is
      // sealed, worn and slightly damp, and it answers the lamps above it with a
      // long specular streak. Roughness down and a little metalness is what
      // turns the pools from painted-on patches into light on a surface.
      if (n === 'floor_bay_slab') {
        o.traverse((m) => {
          if (!m.isMesh || !m.material || Array.isArray(m.material)) return;
          m.material = m.material.clone();
          // Roughness, NOT metalness. Concrete is a dielectric; giving it
          // metalness 0.26 made the whole slab reflect ambient and go pale,
          // and at a grazing angle down a 48 m hall it blew a hard-edged
          // white band across the middle of the frame. Low roughness alone
          // gives the damp-sealed-concrete highlight without the flat lift.
          m.material.roughness = Math.min(m.material.roughness ?? 1, 0.52);
          m.material.metalness = 0.04;
        });
      }
      this.shareMaterialsIn(o);
      const box = new THREE.Box3().setFromObject(o);
      const size = box.getSize(new THREE.Vector3());
      if (!o.children.length || size.y < 1e-4) this.missing.push(n);
      this.protos[n] = o;
      this.sizes[n] = size;
      done++;
      onProgress?.(done / ASSET_LIST.length, n);
    }));
    // Build the raised-shutter prototype once, from the asset's own declared
    // curtain node.
    const door = await ASSET(A('roller_shutter_door'), { keepHierarchy: true, surfaces: true });
    const curtain = door.userData?.curtain;
    if (curtain && curtain.isObject3D) curtain.position.y += 1.10;
    else this.missing.push('roller_shutter_door:curtain');
    door.updateMatrixWorld(true);
    this.shareMaterialsIn(door);
    this.dockDoor = bakeStatic(door);   // it never moves again, so it does not need to stay articulated
    return this.missing;
  }

  build() {
    this._floor();
    this._shell();
    this._roofAndSky();
    this._racking();
    this._dock();
    this._mainFloor();
    this._litter();
    this._mezzanine();
    this._office();
    this._services();
    this._lights();
    this._bake();
    this._sectors();
  }

  // ---------------------------------------------------------------- floor
  _floor() {
    for (let ix = -1; ix <= 1; ix += 2) {
      for (const x of [ix * 4, ix * 12]) {
        for (const z of [-20, -12, -4, 4, 12, 20]) {
          this.put('floor_bay_slab', { x, z, y: -0.12, ry: (Math.floor(rnd(0, 4)) * Math.PI / 2), solid: false });
        }
      }
    }
    // one flat collision plane rather than 24 boxes
    this.world.add({ x: -B.halfX - 2, y: -2, z: -B.halfZ - 2 }, { x: B.halfX + 2, y: 0, z: B.halfZ + 2 }, 'ground');
  }

  // ---------------------------------------------------------------- shell
  _shell() {
    const ZS = [-20, -12, -4, 4, 12, 20];
    // portal frames flanking the central hall
    for (const z of ZS) {
      this.put('structural_bay', { x: -12, z, solid: false });
      this.put('structural_bay', { x: 12, z, solid: false });
    }
    // columns get their own slim collision so you can take cover behind them
    for (const x of [-16, -8, 8, 16]) {
      for (const z of ZS) {
        this.world.add({ x: x - 0.22, y: 0, z: z - 0.22 }, { x: x + 0.22, y: B.eaves, z: z + 0.22 }, 'column');
      }
    }
    // side walls
    for (const z of ZS) {
      this.put('wall_panel_bay', { x: -B.halfX - 0.1, z, ry: Math.PI / 2, solid: false });
      this.put('wall_panel_bay', { x: B.halfX + 0.1, z, ry: -Math.PI / 2, solid: false });
    }
    // end walls, with the dock doors cut into the +Z end
    const dockDoorsX = [-4, 4];
    for (const x of [-12, -4, 4, 12]) {
      if (!dockDoorsX.includes(x)) this.put('wall_panel_bay', { x, z: B.halfZ + 0.1, ry: Math.PI, solid: false });
      if (x !== 12) this.put('wall_panel_bay', { x, z: -B.halfZ - 0.1, solid: false });
    }
    // The dock shutters are raised by 1.1 m on the node the asset itself
    // declares (`userData.curtain`), which only exists if it is loaded with
    // keepHierarchy — the default merge welds the curtain to the guide rails.
    // It is re-merged immediately afterwards, because it never has to move
    // again and an unmerged door is thirty draw calls.
    for (const x of dockDoorsX) {
      const d = this.dockDoor ? this.dockDoor.clone(true) : null;
      if (d) {
        d.position.set(x, 0, B.halfZ - 0.2);
        d.rotation.y = Math.PI;
        d.updateMatrixWorld(true);
        this._blockFor(x, B.halfZ - 0.2).add(d);
        this.placed++;
      }
    }
    if (this.dockDoor) {
      const d = this.dockDoor.clone(true);
      d.position.set(12, 0, -B.halfZ + 0.2);
      d.updateMatrixWorld(true);
      this._blockFor(12, -B.halfZ + 0.2).add(d);
    }

    // wall collision: four slabs, not one per panel
    const t = 0.5;
    this.world.add({ x: -B.halfX - t, y: 0, z: -B.halfZ - t }, { x: -B.halfX, y: B.eaves, z: B.halfZ + t }, 'wall');
    this.world.add({ x: B.halfX, y: 0, z: -B.halfZ - t }, { x: B.halfX + t, y: B.eaves, z: B.halfZ + t }, 'wall');
    this.world.add({ x: -B.halfX - t, y: 0, z: -B.halfZ - t }, { x: B.halfX + t, y: B.eaves, z: -B.halfZ }, 'wall');
    // the +Z end wall is broken by the two dock openings, so it goes in as three pieces
    this.world.add({ x: -B.halfX - t, y: 0, z: B.halfZ }, { x: -6.2, y: B.eaves, z: B.halfZ + t }, 'wall');
    this.world.add({ x: -1.8, y: 0, z: B.halfZ }, { x: 1.8, y: B.eaves, z: B.halfZ + t }, 'wall');
    this.world.add({ x: 6.2, y: 0, z: B.halfZ }, { x: B.halfX + t, y: B.eaves, z: B.halfZ + t }, 'wall');
    // The dock openings are lit but not passable: there is no yard modelled
    // beyond them, and a player who walks out of the level is standing in a
    // void looking back at the outside of a building that was never built.
    // Collision closes the aperture; the raised curtain still lets the cold
    // exterior wash in under it, which is where it was always coming from.
    for (const x of dockDoorsX) {
      this.world.add({ x: x - 2.3, y: 0, z: B.halfZ - 0.05 }, { x: x + 2.3, y: B.eaves, z: B.halfZ + 0.45 }, 'wall');
    }
  }

  /**
   * The roof is the same generated ribbed cladding panel laid flat. Reusing a
   * wall panel as roof deck is what a real shed does, and it keeps the rule
   * that every object comes from the asset method — a hand-made ceiling plane
   * would not.
   *
   * Gaps are left for skylight strips. The moon reaches the floor through them,
   * which is where the cold half of the two-temperature rig comes from and why
   * there is anything to aim a light shaft at.
   */
  _roofAndSky() {
    // Rows given as [zCentre, zLength]. The gaps between them are the
    // skylights, and they are why the cold half of the rig has anywhere to
    // come from. Panels are placed by measured bounds (`center: true`) because
    // a panel rotated flat about its own base no longer sits where its
    // coordinate says, and over five rows that gap is the whole roof.
    const ROWS = [[-20.6, 8.8], [-11.8, 8.8], [1.5, 8.0], [13.2, 6.6], [21.4, 5.0]];
    const SKY = [[-6.2, 2.4], [6.8, 2.6], [17.6, 2.0]];
    for (const [zc, zl] of ROWS) {
      for (const x of [-12, -4, 4, 12]) {
        this.put('wall_panel_bay', {
          x, z: zc, y: B.eaves + 0.12, rx: Math.PI / 2,      // +x pitches the FRONT DOWN, which is what a ceiling wants
          scaleV: { z: zl / 9.5 }, center: true, solid: false,
        });
      }
    }
    this.world.add({ x: -B.halfX, y: B.eaves + 0.06, z: -B.halfZ }, { x: B.halfX, y: B.eaves + 0.6, z: B.halfZ }, 'roof');

    const paneMat = new THREE.MeshBasicMaterial({ color: 0x9dbfe4, transparent: true, opacity: 0.34,
      side: THREE.DoubleSide, depthWrite: false, toneMapped: true });
    for (const [zc, zl] of SKY) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(30, zl), paneMat);
      pane.rotation.x = Math.PI / 2;
      pane.position.set(0, B.eaves + 0.04, zc);
      pane.renderOrder = 1;
      this.root.add(pane);
      for (const x of [-11.5, -4, 4, 11.5]) {
        this.rig.addLamp(new THREE.Vector3(x, B.eaves - 0.8, zc), 'sky',
          { color: 0x8fb4d8, intensity: 7.2, radius: 3.8, poolOpacity: 0.17 });
        this.rig.addShaft(new THREE.Vector3(x, B.eaves - 0.15, zc), 0, 0.9, 2.2, 0x8fb4d8, 0.085);
      }
    }
    // the open dock doors: a wide cold wash off the yard, at floor level
    for (const x of [-4, 4]) {
      this.rig.addLamp(new THREE.Vector3(x, 1.7, B.halfZ - 1.6), 'sky',
        { color: 0x8fb4d8, intensity: 8.5, radius: 4.4, poolOpacity: 0.22 });
    }
  }

  // ---------------------------------------------------------------- racking
  _racking() {
    // A rack bay is 2.70 WIDE and 1.10 DEEP. Bays sit shoulder to shoulder, so
    // a run along Z needs the bay turned a quarter turn — placed unrotated and
    // stepped by 2.70 it leaves 1.6 m holes between bays and is 2.7 m thick
    // across the aisle, which is how the player ended up standing inside the
    // racking. ry = +PI/2 turns the open face toward +X.
    const runs = [
      { x: -15.0, ry: Math.PI / 2 },   // against the west wall, facing the aisle
      { x: -10.0, ry: -Math.PI / 2 },  // aisle between these two
      { x: 10.0, ry: Math.PI / 2 },
      { x: 15.0, ry: -Math.PI / 2 },
    ];
    const zs = [];
    for (let z = -14.85; z <= 14.85; z += 2.7) zs.push(+z.toFixed(2));
    this.rackLoads = 0;
    for (const run of runs) {
      for (const z of zs) {
        this.put('pallet_rack_bay', { x: run.x, z, ry: run.ry, tag: 'rack', shrink: 0.06 });
        // stock, deliberately patchy — a full rack and an empty rack both read
        // as set dressing; a half-worked one reads as a working building
        for (const [li, ly] of [[0, 0.20], [1, 1.98], [2, 3.68]]) {
          if (Math.random() > (li === 0 ? 0.78 : li === 1 ? 0.46 : 0.24)) continue;
          const load = Math.random() < 0.62 ? 'carton_pallet_load'
                     : Math.random() < 0.6 ? 'wire_cage_pallet' : 'wooden_pallet';
          const dx = (run.ry > 0 ? 0.05 : -0.05);
          this.put(load, { x: run.x + dx + rnd(-0.04, 0.04), y: ly, z: z + rnd(-0.06, 0.06),
                           ry: run.ry + rnd(-0.05, 0.05), solid: li === 0, tag: 'timber' });
          this.rackLoads++;
        }
      }
      // exit sign at the end of each run
    }
    // aisle-end protection
    for (const x of [-12.5, 12.5]) {
      for (const z of [-16.8, 16.8]) {
        this.put('jersey_barrier', { x, z, ry: Math.PI / 2, tag: 'concrete' });
      }
    }
  }

  // ---------------------------------------------------------------- dock
  _dock() {
    // containers, stacked, forming the cover the first firefight happens in
    this.put('shipping_container_20ft', { x: -10.4, z: 19.2, ry: 0, tag: 'container' });
    this.put('shipping_container_20ft', { x: -10.4, z: 19.2, y: 2.62, ry: Math.PI, tag: 'container' });
    this.put('shipping_container_20ft', { x: 10.6, z: 19.6, ry: 0.06, tag: 'container' });
    this.put('shipping_container_20ft', { x: 2.2, z: 21.6, ry: Math.PI / 2 + 0.02, tag: 'container' });

    this.put('forklift', { x: -5.4, z: 14.2, ry: 2.35, tag: 'forklift' });
    this.put('pallet_jack', { x: 5.8, z: 15.4, ry: -1.1, tag: 'metal' });

    for (const [x, z, r] of [[-2.6, 17.4, 0.2], [-1.4, 16.6, 1.1], [7.4, 12.6, -0.4], [8.5, 13.4, 0.8]]) {
      this.put('wooden_pallet', { x, z, ry: r, tag: 'timber' });
      if (Math.random() < 0.6) this.put('carton_pallet_load', { x: x + rnd(-.06, .06), z: z + rnd(-.06, .06), ry: r + rnd(-.1, .1), tag: 'timber' });
    }
    for (const [x, z] of [[-13.4, 21.4], [-12.6, 20.4], [13.2, 21.8], [12.3, 20.9], [13.9, 20.2]]) {
      this.put('oil_drum', { x, z, ry: rnd(0, 6.28), tag: 'drum' });
    }
    this.put('jersey_barrier', { x: 0, z: 12.4, ry: 0, tag: 'concrete' });
    this.put('jersey_barrier', { x: 3.1, z: 12.4, ry: 0, tag: 'concrete' });
    this.put('sandbag_wall', { x: -7.2, z: 11.6, ry: 0.1, tag: 'sandbag' });
    this.put('chainlink_fence_section', { x: 6.6, z: 8.2, ry: Math.PI / 2, tag: 'fence' });
    this.put('chainlink_fence_section', { x: 6.6, z: 11.2, ry: Math.PI / 2, tag: 'fence' });
  }

  // ---------------------------------------------------------------- main hall
  _mainFloor() {
    // conveyor line down the west side of the hall
    for (let z = -12; z <= 6; z += 3) this.put('conveyor_section', { x: -6.6, z, tag: 'metal' });
    this.put('cable_reel', { x: -4.2, z: 8.4, ry: 0.3, tag: 'timber' });
    this.put('cable_reel', { x: -3.0, z: 9.6, ry: -0.9, tag: 'timber' });

    for (const [x, z, r] of [[4.4, 6.2, 0.1], [5.9, 6.4, 0.4], [4.6, 4.7, -0.2]]) {
      this.put('ibc_tote', { x, z, ry: r, tag: 'ibc' });
    }
    this.put('ibc_tote', { x: 4.4, z: 6.2, y: 1.17, ry: 0.5, tag: 'ibc' });

    this.put('gas_cylinder_rack', { x: -6.9, z: -16.4, ry: 0.1, tag: 'metal' });
    this.put('gas_cylinder_rack', { x: -5.5, z: -16.4, ry: -0.06, tag: 'metal' });

    for (const [x, z, r] of [[2.0, -3.2, 0.6], [3.0, -4.0, -0.3], [1.2, -4.4, 1.2],
                             [-2.4, -9.6, 0.2], [-1.4, -10.4, 0.9], [6.2, -13.8, 0.4]]) {
      this.put('oil_drum', { x, z, ry: r, tag: 'drum' });
    }
    for (const [x, z, r] of [[-3.4, 1.2, 0.2], [-2.4, 0.4, 1.4], [3.8, -8.6, 0.0], [4.9, -8.2, 0.7]]) {
      this.put('wooden_pallet', { x, z, ry: r, tag: 'timber' });
    }
    this.put('carton_pallet_load', { x: -3.4, z: 1.2, ry: 0.2, tag: 'timber' });
    this.put('wire_cage_pallet', { x: 3.8, z: -8.6, tag: 'metal' });

    // cover for the middle fight
    this.put('sandbag_wall', { x: 1.4, z: -0.4, ry: 0.05, tag: 'sandbag' });
    this.put('jersey_barrier', { x: -4.6, z: -6.0, ry: 0.02, tag: 'concrete' });
    this.put('jersey_barrier', { x: 5.2, z: -6.0, ry: -0.03, tag: 'concrete' });
    this.put('jersey_barrier', { x: -1.0, z: -18.2, ry: Math.PI / 2, tag: 'concrete' });
    this.put('sandbag_wall', { x: 3.6, z: -18.6, ry: -0.1, tag: 'sandbag' });

    this.put('shipping_container_20ft', { x: -3.6, z: -20.4, ry: Math.PI / 2 + 0.03, tag: 'container' });
    this.put('forklift', { x: 6.6, z: 2.4, ry: -0.9, tag: 'forklift' });
  }

  /**
   * Loose objects on the walkable floor.
   *
   * Counted on the reference set: five of five AAA frames carry litter on the
   * ground — a pallet on its side, a cable coil, a crushed box, a drum lying
   * down. Zero of five of my frames did, and a critic named it as one of two
   * binary features that split the two sets with no error at all. A working
   * depot floor is not swept.
   */
  _litter() {
    const items = [
      ['wooden_pallet', -8.4, 3.2, 0.9, 0], ['wooden_pallet', 11.6, -3.4, 2.1, 0],
      ['wooden_pallet', -2.2, -13.6, 0.4, 1], ['wooden_pallet', 7.8, 20.4, 1.7, 1],
      ['oil_drum', -8.9, -2.1, 0.3, 2], ['oil_drum', 12.1, 8.6, 1.1, 2],
      ['oil_drum', -12.4, 6.4, 0.6, 0], ['oil_drum', 2.6, 20.9, 2.4, 2],
      ['ammo_crate', -6.2, 17.9, 0.5, 0], ['ammo_crate', 9.4, -8.4, 1.9, 0],
      ['ammo_crate', -11.1, -12.6, 2.8, 0], ['ammo_crate', 5.4, 4.1, 0.8, 0],
      ['tool_chest_trolley', 12.6, 3.1, 1.4, 0], ['tool_chest_trolley', -12.8, 11.2, 2.6, 0],
      ['cable_reel', 12.9, -11.4, 0.7, 3], ['cable_reel', -8.6, 21.1, 2.2, 0],
      ['wire_cage_pallet', -13.1, -6.2, 1.2, 0], ['wire_cage_pallet', 8.2, 8.9, 0.2, 0],
      ['carton_pallet_load', -2.8, 8.9, 1.6, 0], ['carton_pallet_load', 6.9, -16.2, 0.9, 0],
    ];
    // mode 0 upright, 1 on its side, 2 tipped over, 3 rolled onto its face
    for (const [name, x, z, ry, mode] of items) {
      const opts = { x, z, ry: ry + rnd(-0.12, 0.12), tag: 'litter', shrink: 0.04 };
      if (mode === 1) { opts.rx = Math.PI / 2; opts.center = true; opts.y = 0; }
      if (mode === 2) { opts.rz = Math.PI / 2 + rnd(-0.1, 0.1); opts.center = true; opts.y = 0; }
      if (mode === 3) { opts.rx = Math.PI / 2; opts.center = true; opts.y = 0; }
      this.put(name, opts);
    }
  }

  // ---------------------------------------------------------------- mezzanine
  _mezzanine() {
    const Y = B.mezzY;              // 5.0 m: two 2.5 m stair flights, not one
    // catwalk spanning the hall at z = -6, from the west wall across to the stair
    for (const x of [-8, -4, 0, 4, 8]) this.put('catwalk_section', { x, z: -6, y: Y - 0.16, solid: false });
    this.world.add({ x: -10.1, y: Y - 0.08, z: -6.62 }, { x: 10.1, y: Y + 0.02, z: -5.38 }, 'catwalk');
    this.world.add({ x: -10.1, y: Y, z: -6.74 }, { x: 10.1, y: Y + 1.06, z: -6.60 }, 'rail');
    this.world.add({ x: -10.1, y: Y, z: -5.40 }, { x: 10.1, y: Y + 1.06, z: -5.26 }, 'rail');

    // Two flights with a half landing, in the aisle between the internal
    // columns and the east racking run. One flight cannot reach 5 m — the
    // asset rises 2.5 m and scaling it up would give a warehouse 42 cm treads.
    const SX = 10.0;
    this.put('steel_stair_flight', { x: SX, z: 0.6, y: 0, solid: false });
    this.put('steel_stair_flight', { x: SX, z: -4.0, y: 2.5, solid: false });
    this.put('catwalk_section', { x: SX, z: -1.9, y: 2.5 - 0.16, ry: Math.PI / 2, solid: false });

    const ramp = (z0, z1, y0, y1) => {
      const n = 14;
      for (let i = 0; i < n; i++) {
        const a = z0 + (z1 - z0) * (i / n), b = z0 + (z1 - z0) * ((i + 1) / n);
        this.world.add({ x: SX - 0.58, y: 0, z: Math.min(a, b) },
                       { x: SX + 0.58, y: y0 + (y1 - y0) * ((i + 1) / n), z: Math.max(a, b) }, 'stairs');
      }
    };
    ramp(2.2, -1.0, 0, 2.5);
    this.world.add({ x: SX - 0.64, y: 2.42, z: -3.95 }, { x: SX + 0.64, y: 2.52, z: -0.90 }, 'landing');
    ramp(-2.4, -5.6, 2.5, Y);

    this.put('tool_chest_trolley', { x: -6.4, z: -6.0, y: Y, ry: 0.3, tag: 'metal' });
    this.put('ammo_crate', { x: 2.4, z: -6.0, y: Y, ry: -0.2, tag: 'crate' });
    this.put('ammo_crate', { x: 3.1, z: -5.8, y: Y, ry: 0.5, tag: 'crate' });
    this.put('electrical_panel', { x: -9.6, z: -6.5, y: Y + 1.2, ry: 0, solid: false });
  }

  // ---------------------------------------------------------------- office
  _office() {
    this.put('site_office_cabin', { x: -11.4, z: -20.6, ry: 0.02, tag: 'cabin' });
    this.put('tool_chest_trolley', { x: -7.4, z: -21.6, ry: -0.4, tag: 'metal' });
    this.put('tool_chest_trolley', { x: -6.5, z: -21.0, ry: 0.2, tag: 'metal' });
    this.put('ammo_crate', { x: -7.9, z: -18.9, ry: 0.3, tag: 'crate' });
    this.put('ammo_crate', { x: -7.4, z: -18.6, y: 0.31, ry: -0.5, tag: 'crate' });
    this.put('chainlink_fence_section', { x: -8.4, z: -17.0, ry: 0, tag: 'fence' });
    this.put('chainlink_fence_section', { x: -5.4, z: -17.0, ry: 0, tag: 'fence' });
    this.put('cable_reel', { x: -14.6, z: -17.2, ry: 1.2, tag: 'timber' });
  }

  // ---------------------------------------------------------------- services
  _services() {
    for (const x of [-9.4, 9.4]) {
      for (let z = -21; z <= 21; z += 4) {
        this.put('duct_run_section', { x, z: z + 2, y: 6.86, solid: false });   // hanger tops reach 7.51, just under the bottom chord
      }
    }
    for (let z = -21; z <= 21; z += 4) {
      this.put('pipe_run_bracketed', { x: 2.4, z: z + 2, y: 6.30, solid: false });
    }
    for (const [x, z, ry] of [[-B.halfX + 0.22, -12, Math.PI / 2], [-B.halfX + 0.22, 4, Math.PI / 2],
                              [B.halfX - 0.22, -8, -Math.PI / 2], [B.halfX - 0.22, 8, -Math.PI / 2]]) {
      this.put('electrical_panel', { x, z, y: 1.35, ry, solid: false });
    }
  }

  // ---------------------------------------------------------------- lights
  _lights() {
    // Sodium high bays on the structural grid. Every one of them emits (the
    // lens), lights (a real spot at the slab) and pools (an additive ground
    // quad) — see lighting.js for why all three.
    const rows = [-11, 0, 11];
    const cols = [-19, -12.5, -6, 0.5, 7, 13.5, 20];
    let i = 0;
    for (const x of rows) {
      for (const z of cols) {
        i++;
        const dead = (i % 11 === 3);          // a couple out, one on the blink
        const flick = (i % 13 === 5) ? 1 : 0;
        this.put('high_bay_lamp', { x, z, y: 6.92, solid: false });   // hook at 7.42, clear of the 7.55 chord
        if (dead) continue;
        this.rig.addLamp(new THREE.Vector3(x, 7.038, z), 'highbay',
          { intensity: 13.0, radius: 4.8, flicker: flick, poolOpacity: 0.13 });
        if (i % 3 === 0) this.rig.addShaft(new THREE.Vector3(x, 6.98, z), 0, 0.34, 2.3, 0xffc487, 0.075);
      }
    }
    // wall floods washing the racking, low down, where a high bay cannot reach
    for (const [x, z, ry, ax] of [[-B.halfX + 0.3, -16, Math.PI / 2, 1], [-B.halfX + 0.3, 0, Math.PI / 2, 1],
                                  [-B.halfX + 0.3, 16, Math.PI / 2, 1], [B.halfX - 0.3, -16, -Math.PI / 2, -1],
                                  [B.halfX - 0.3, 0, -Math.PI / 2, -1], [B.halfX - 0.3, 16, -Math.PI / 2, -1]]) {
      this.put('wall_flood_light', { x, z, y: 5.6, ry, solid: false });
      this.rig.addLamp(new THREE.Vector3(x + ax * 0.30, 5.74, z), 'flood',
        { intensity: 6.2, radius: 3.0, poolOpacity: 0.10 });
    }
    // exit signs: the green third temperature, small and only near the doors
    for (const [x, z, ry] of [[-4, B.halfZ - 0.5, Math.PI], [4, B.halfZ - 0.5, Math.PI],
                              [12, -B.halfZ + 0.5, 0], [-B.halfX + 0.3, -6, Math.PI / 2]]) {
      this.put('exit_sign_box', { x, z, y: 2.55, ry, solid: false });
      this.rig.addLamp(new THREE.Vector3(x, 2.652, z), 'sign',
        { color: 0x2fd06a, intensity: 2.2, radius: 1.3, poolOpacity: 0.22 });
    }
  }

  // ---------------------------------------------------------------- bake
  _bake() {
    this.rig.bakePools();
    this.blockMeshes = [];
    let before = 0, after = 0;
    for (const [k, g] of this.blocks) {
      g.updateMatrixWorld(true);
      let n = 0; g.traverse((o) => { if (o.isMesh) n++; });
      before += n;
      const baked = bakeStatic(g);
      let m = 0; baked.traverse((o) => { if (o.isMesh) m++; });
      after += m;
      baked.name = 'block_' + k;
      this.root.add(baked);
      this.blockMeshes.push(baked);
    }
    this.bakeStats = { blocks: this.blocks.size, materials: this.matCache.size, meshesBefore: before, meshesAfter: after,
      perBlock: this.blockMeshes.map((b) => { let n = 0; b.traverse((o) => { if (o.isMesh) n++; }); return n; }) };
    this.blocks.clear();
    for (const b of this.blockMeshes) {
      const bb = new THREE.Box3().setFromObject(b);
      b.userData.centre = bb.getCenter(new THREE.Vector3());
      b.userData.radius = bb.getSize(new THREE.Vector3()).length() * 0.5;
      let n = 0; b.traverse((o) => { if (o.isMesh) n++; }); b.userData.meshes = n;
    }
  }

  /**
   * Hide blocks that are too far to matter. Frustum culling already throws away
   * what is behind you; this throws away what is in front of you and 40 m into
   * fog you cannot see through anyway. Cheap, and it is the difference between
   * drawing two blocks and drawing twenty.
   */
  cull(camPos, range = 42) {
    let n = 0, m = 0;
    for (const b of this.blockMeshes) {
      const c = b.userData.centre;
      const d = Math.hypot(c.x - camPos.x, c.z - camPos.z) - b.userData.radius;
      b.visible = d < range;
      if (b.visible) { n++; m += b.userData.meshes; }
    }
    this.visibleBlocks = n;
    this.visibleMeshes = m;
  }

  // ---------------------------------------------------------------- sectors
  _sectors() {
    this.sectors = [
      { name: 'LOADING DOCK', min: { x: -B.halfX, z: 8 }, max: { x: B.halfX, z: B.halfZ },
        spawns: [[-12.5, 21], [12.5, 21.5], [0, 22.5], [-9, 14], [9, 16], [3, 19]] },
      { name: 'MAIN FLOOR', min: { x: -B.halfX, z: -10 }, max: { x: B.halfX, z: 8 },
        spawns: [[-13, 2], [13, -2], [0, 4], [-6, -8], [6, -8], [-13, -8], [13, 6]] },
      { name: 'REAR STORES', min: { x: -B.halfX, z: -B.halfZ }, max: { x: B.halfX, z: -10 },
        spawns: [[-12, -21], [12, -21], [0, -22], [-6, -14], [6, -14], [13, -16]] },
    ];
    this.patrols = [
      [{ x: -13, z: 12 }, { x: -13, z: -12 }, { x: -9, z: -14 }, { x: -9, z: 12 }],
      [{ x: 13, z: 12 }, { x: 13, z: -12 }, { x: 9, z: -14 }, { x: 9, z: 12 }],
      [{ x: -4, z: 6 }, { x: 4, z: 6 }, { x: 4, z: -14 }, { x: -4, z: -14 }],
    ];
  }
}
