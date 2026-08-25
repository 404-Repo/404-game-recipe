/**
 * Axis-aligned box world. Everything solid in the level registers a box here.
 *
 * NOTE on Box3.setFromObject: it returns a world-space AXIS-ALIGNED box, so any
 * rotation is already folded into the extents. Storing an object's rotation
 * alongside it and rotating again double-counts and inflates every angled prop
 * into a square big enough to block the aisle beside it. The boxes below are
 * used exactly as measured, with no second rotation.
 */
import * as THREE from 'three';

export class World {
  constructor() {
    this.boxes = [];       // {min:{x,y,z}, max:{x,y,z}, tag}
    this.grid = new Map(); // spatial hash, 4 m cells
    this.cell = 4;
  }

  _key(ix, iz) { return ix * 73856093 ^ iz * 19349663; }

  add(min, max, tag = '') {
    const b = { min, max, tag };
    this.boxes.push(b);
    const c = this.cell;
    for (let ix = Math.floor(min.x / c); ix <= Math.floor(max.x / c); ix++) {
      for (let iz = Math.floor(min.z / c); iz <= Math.floor(max.z / c); iz++) {
        const k = this._key(ix, iz);
        let arr = this.grid.get(k);
        if (!arr) this.grid.set(k, (arr = []));
        arr.push(b);
      }
    }
    return b;
  }

  addObject(obj, tag = '') {
    const b = new THREE.Box3().setFromObject(obj);
    if (!isFinite(b.min.x) || b.min.x > b.max.x) return null;
    return this.add({ x: b.min.x, y: b.min.y, z: b.min.z }, { x: b.max.x, y: b.max.y, z: b.max.z }, tag);
  }

  /** Boxes possibly overlapping an xz-radius around a point. */
  near(x, z, r) {
    const c = this.cell, out = [], seen = new Set();
    for (let ix = Math.floor((x - r) / c); ix <= Math.floor((x + r) / c); ix++) {
      for (let iz = Math.floor((z - r) / c); iz <= Math.floor((z + r) / c); iz++) {
        const arr = this.grid.get(this._key(ix, iz));
        if (!arr) continue;
        for (const b of arr) { if (!seen.has(b)) { seen.add(b); out.push(b); } }
      }
    }
    return out;
  }

  /**
   * Move a vertical capsule (radius r, from y=feet to y=feet+h) by (dx,dz),
   * resolving one axis at a time so sliding along a wall works. Returns the
   * new x/z and whether anything was hit.
   */
  moveXZ(x, y, z, r, h, dx, dz, stepUp = 0) {
    let nx = x + dx, nz = z + dz;
    const cands = this.near(nx, nz, r + Math.max(Math.abs(dx), Math.abs(dz)) + 0.7);
    let hit = false;
    const overlapY = (b) => !(b.max.y <= y + 0.02 + stepUp || b.min.y >= y + h);
    // x axis
    for (const b of cands) {
      if (!overlapY(b)) continue;
      if (nx + r > b.min.x && nx - r < b.max.x && z + r > b.min.z && z - r < b.max.z) {
        hit = true;
        nx = dx > 0 ? b.min.x - r - 1e-4 : b.max.x + r + 1e-4;
      }
    }
    // z axis
    for (const b of cands) {
      if (!overlapY(b)) continue;
      if (nx + r > b.min.x && nx - r < b.max.x && nz + r > b.min.z && nz - r < b.max.z) {
        hit = true;
        nz = dz > 0 ? b.min.z - r - 1e-4 : b.max.z + r + 1e-4;
      }
    }
    return { x: nx, z: nz, hit };
  }

  /** Highest surface under a cylinder at (x,z) at or below `fromY`. */
  floorAt(x, z, r, fromY) {
    let best = 0;
    for (const b of this.near(x, z, r + 0.4)) {
      if (x + r <= b.min.x || x - r >= b.max.x || z + r <= b.min.z || z - r >= b.max.z) continue;
      if (b.max.y <= fromY + 0.32 && b.max.y > best) best = b.max.y;
    }
    return best;
  }

  /** Ceiling above a cylinder at (x,z), above `fromY`. */
  ceilAt(x, z, r, fromY) {
    let best = Infinity;
    for (const b of this.near(x, z, r + 0.4)) {
      if (x + r <= b.min.x || x - r >= b.max.x || z + r <= b.min.z || z - r >= b.max.z) continue;
      if (b.min.y >= fromY && b.min.y < best) best = b.min.y;
    }
    return best;
  }

  /**
   * Ray vs the box set. Returns {t, normal, box} or null. Used for line of
   * sight and for bullets that miss everything alive.
   */
  raycast(o, d, maxT) {
    let bestT = maxT, bestB = null, bestN = null;
    const steps = Math.ceil(maxT / this.cell) + 1;
    const seen = new Set();
    for (let s = 0; s < steps; s++) {
      const t = Math.min(s * this.cell, maxT);
      const px = o.x + d.x * t, pz = o.z + d.z * t;
      for (const b of this.near(px, pz, this.cell)) {
        if (seen.has(b)) continue; seen.add(b);
        // A box the ray STARTS inside is not something the ray can hit. Without
        // this, a player standing on a stair box or clipped a centimetre into a
        // rack shoots the thing they are standing in, every shot lands at t~0,
        // and the kill count is zero for a reason no screenshot explains.
        if (o.x > b.min.x && o.x < b.max.x && o.y > b.min.y && o.y < b.max.y &&
            o.z > b.min.z && o.z < b.max.z) continue;
        let t0 = 0, t1 = bestT, n = null;
        for (const ax of ['x', 'y', 'z']) {
          const inv = 1 / (d[ax] || 1e-9);
          let a = (b.min[ax] - o[ax]) * inv, bb = (b.max[ax] - o[ax]) * inv;
          let sign = -1;
          if (a > bb) { const tmp = a; a = bb; bb = tmp; sign = 1; }
          if (a > t0) { t0 = a; n = { x: 0, y: 0, z: 0 }; n[ax] = sign; }
          if (bb < t1) t1 = bb;
          if (t0 > t1) { t0 = Infinity; break; }
        }
        if (t0 < bestT && t0 > 0.001 && t0 <= t1) { bestT = t0; bestB = b; bestN = n; }
      }
      if (bestB && bestT < t) break;
    }
    return bestB ? { t: bestT, normal: bestN || { x: 0, y: 1, z: 0 }, box: bestB } : null;
  }

  clearLine(a, b, pad = 0.0) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return true;
    const d = { x: dx / len, y: dy / len, z: dz / len };
    const h = this.raycast(a, d, len - pad);
    return !h;
  }
}
