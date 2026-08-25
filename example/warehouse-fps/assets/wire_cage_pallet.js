/**
 * wire_cage_pallet — arm A: assembled from primitives.
 *
 * 1200 x 800 x 900 collapsible steel stillage. Round tube frame from cylinders
 * with sphere elbows, welded square mesh on all four sides, a hinged half
 * drop-gate on the front (+Z), and three skids in the base leaving two forklift
 * channels. Every mesh panel and every open tube is DoubleSide: you look
 * straight through this object and into its own inside, and a single-sided wall
 * is a hole.
 */
export default function (THREE) {
  const g = new THREE.Group();

  const mat = (color, name, o) => {
    const m = new THREE.MeshStandardMaterial(Object.assign(
      { color, roughness: 0.68, metalness: 0.55 }, o || {}));
    if (name) m.name = name;
    return m;
  };
  const GAL  = mat(0x9aa0a3, 'metal', { roughness: 0.62, metalness: 0.66,
                                       side: THREE.DoubleSide });
  const GAL2 = mat(0x8f9598, 'metal', { roughness: 0.70, metalness: 0.58,
                                       side: THREE.DoubleSide });
  const GAL3 = mat(0xa3a8aa, 'metal', { roughness: 0.58, metalness: 0.70,
                                       side: THREE.DoubleSide });
  const WIRE = mat(0x9aa0a3, 'metal', { roughness: 0.60, metalness: 0.70,
                                        side: THREE.DoubleSide });
  const STL  = mat(0x878c8f, 'metal', { roughness: 0.74, metalness: 0.48,
                                        side: THREE.DoubleSide });
  const DARK = mat(0x5b6167, 'metal', { roughness: 0.80, metalness: 0.45 });
  const RUST = mat(0x6e4128, 'metal', { roughness: 0.94, metalness: 0.20,
                                       side: THREE.DoubleSide });
  const YEL  = mat(0xd6a41f, 'metal', { roughness: 0.80, metalness: 0.10 });

  const B = (w, h, d, m, x, y, z) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z); g.add(o); return o;
  };
  const UP = new THREE.Vector3(0, 1, 0);
  const tube = (a, b, r, seg, m) => {
    const d = new THREE.Vector3().subVectors(b, a), L = d.length();
    const o = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, L, seg, 1, true), m);
    o.position.copy(a).addScaledVector(d, 0.5);
    o.quaternion.setFromUnitVectors(UP, d.clone().normalize());
    g.add(o); return o;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const MX = (x, y, z, rx, ry, rz, sy) => new THREE.Matrix4().compose(
    V(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
    V(1, sy === undefined ? 1 : sy, 1));
  const instanced = (geo, m, mats) => {
    const c = new THREE.Vector3(), p = new THREE.Vector3();
    for (const q of mats) { p.setFromMatrixPosition(q); c.add(p); }
    c.divideScalar(mats.length || 1);
    const im = new THREE.InstancedMesh(geo, m, mats.length);
    const off = new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z);
    const t = new THREE.Matrix4();
    for (let i = 0; i < mats.length; i++) {
      t.multiplyMatrices(off, mats[i]); im.setMatrixAt(i, t);
    }
    im.position.copy(c);
    im.instanceMatrix.needsUpdate = true;
    g.add(im); return im;
  };

  const PX = 0.578, PZ = 0.378, R = 0.022;   // frame centreline, tube radius
  const Y0 = 0.128, Y1 = 0.878;              // base rail and top rail centres
  const rivets = [], wires = [];
  const WP = 0.020;   // wire prototype length; instance scale carries the rest

  // ---- base: three skids leaving two forklift channels -------------------
  for (const x of [-0.550, 0, 0.550]) {
    B(0.100, 0.092, 0.800, DARK, x, 0.046, 0);
    B(0.104, 0.014, 0.800, GAL2, x, 0.099, 0);
  }
  B(1.200, 0.022, 0.800, STL, 0, 0.117, 0);            // pressed base pan
  for (let i = 0; i < 9; i++) {                        // pan ribs, so it is not
    B(1.180, 0.008, 0.020, GAL2, 0, 0.132, -0.355 + i * 0.0888);  // one flat face
  }
  B(1.190, 0.030, 0.014, GAL2, 0, 0.113, 0.393);       // pan skirt front
  B(1.190, 0.030, 0.014, GAL2, 0, 0.113, -0.393);

  // ---- frame: base perimeter, corner posts, top perimeter ----------------
  for (const sz of [-1, 1]) {
    tube(V(-PX, Y0, sz * PZ), V(PX, Y0, sz * PZ), R, 10, GAL);
    tube(V(-PX, Y1, sz * PZ), V(PX, Y1, sz * PZ), R, 10, GAL);
  }
  for (const sx of [-1, 1]) {
    tube(V(sx * PX, Y0, -PZ), V(sx * PX, Y0, PZ), R, 10, GAL);
    tube(V(sx * PX, Y1, -PZ), V(sx * PX, Y1, PZ), R, 10, GAL);
    for (const sz of [-1, 1]) {
      tube(V(sx * PX, Y0, sz * PZ), V(sx * PX, Y1, sz * PZ), R, 10, GAL3);
      for (const y of [Y0, Y1]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(R, 6, 4), GAL2);
        e.position.set(sx * PX, y, sz * PZ); g.add(e);
      }
      // welded corner gusset and its rivets
      B(0.070, 0.070, 0.012, GAL2, sx * (PX - 0.040), Y1 - 0.048, sz * (PZ - 0.006));
      rivets.push(MX(sx * PX, 0.640, sz * (PZ + 0.020), Math.PI / 2, 0, 0));
      rivets.push(MX(sx * PX, 0.300, sz * (PZ + 0.020), Math.PI / 2, 0, 0));
      rivets.push(MX(sx * (PX + 0.020), 0.470, sz * (PZ - 0.140), 0, 0, Math.PI / 2));
    }
  }
  // knee-height rubbing rail at 0.45, worn back to bare metal on the sides
  for (const sx of [-1, 1]) tube(V(sx * PX, 0.450, -PZ), V(sx * PX, 0.450, PZ), 0.016, 8, RUST);
  tube(V(-PX, 0.450, -PZ), V(PX, 0.450, -PZ), 0.016, 8, RUST);

  // ---- the hinged half drop-gate on the front ---------------------------
  const GY0 = 0.150, GY1 = 0.552;
  tube(V(-0.556, GY0, PZ), V(0.556, GY0, PZ), 0.016, 8, GAL3);
  tube(V(-0.556, GY1, PZ), V(0.556, GY1, PZ), 0.016, 8, GAL3);
  for (const sx of [-1, 1]) {
    tube(V(sx * 0.556, GY0, PZ), V(sx * 0.556, GY1, PZ), 0.016, 8, GAL3);
    B(0.044, 0.056, 0.046, DARK, sx * 0.430, GY0, PZ + 0.006);   // bottom hinge
    B(0.030, 0.070, 0.030, GAL2, sx * 0.520, GY1 + 0.010, PZ + 0.010); // catch
    rivets.push(MX(sx * 0.430, GY0 + 0.030, PZ + 0.032, Math.PI / 2, 0, 0));
  }
  B(0.240, 0.026, 0.022, DARK, 0.100, GY1 + 0.012, PZ + 0.012);  // latch bar
  B(0.038, 0.038, 0.040, GAL2, 0.235, GY1 + 0.012, PZ + 0.014);  // latch pivot

  // ---- welded square mesh, four faces, every wire an instance -----------
  const panel = (nV, nH, span, hi, lo, axis, at) => {
    // axis 'z': panel normal is +/-Z, verticals along Y, horizontals along X
    for (let i = 0; i < nV; i++) {
      const t = -span + (2 * span * i) / (nV - 1);
      if (axis === 'z') wires.push(MX(t, (hi + lo) / 2, at, 0, 0, 0, (hi - lo) / WP));
      else wires.push(MX(at, (hi + lo) / 2, t, 0, 0, 0, (hi - lo) / WP));
    }
    for (let i = 0; i < nH; i++) {
      const y = lo + 0.010 + ((hi - lo - 0.020) * i) / (nH - 1);
      const off = axis === 'z' ? (at > 0 ? -0.006 : 0.006) : (at > 0 ? -0.006 : 0.006);
      if (axis === 'z') wires.push(MX(0, y, at + off, 0, 0, Math.PI / 2, (2 * span) / WP));
      else wires.push(MX(at + off, y, 0, Math.PI / 2, 0, 0, (2 * span) / WP));
    }
  };
  panel(21, 13, 0.556, 0.868, 0.140, 'z', -PZ);       // back
  panel(14, 13, 0.356, 0.868, 0.140, 'x', -PX);       // left
  panel(14, 13, 0.356, 0.868, 0.140, 'x',  PX);       // right
  panel(20, 8, 0.540, 0.545, 0.156, 'z',  PZ);        // the drop-gate

  instanced(new THREE.CylinderGeometry(0.0028, 0.0028, WP, 6, 1, true), WIRE, wires);
  instanced(new THREE.CylinderGeometry(0.009, 0.009, 0.010, 6), DARK, rivets);

  // ---- stencilled plates --------------------------------------------------
  B(0.170, 0.062, 0.006, YEL, -0.330, 0.113, 0.398);   // stencil block on the skirt
  B(0.110, 0.070, 0.006, GAL3, 0.360, 0.113, 0.398);   // number plate
  B(0.006, 0.070, 0.110, GAL3, -PX - 0.014, 0.700, 0.120);

  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });
  return g;
}
