/**
 * pallet_rack_bay — arm C: a different reading of the reference.
 *
 * Arms A and B both read the upright as one rolled section with the slots punched
 * through it. This arm reads the frame the way the right-hand frame in the photo
 * actually reads: a closed square tube column with a separate bolted-on
 * perforated slot strip down its aisle face, laced with a full X-brace in every
 * panel (not a zig-zag), on a boxed foot with an angle-iron column protector.
 * The deck is read as a waterfall mat with a downturned edge over each beam.
 */
export default function (THREE) {
  const g = new THREE.Group();

  const mat = (color, name, o) => {
    const m = new THREE.MeshStandardMaterial(Object.assign(
      { color, roughness: 0.78, metalness: 0.15 }, o || {}));
    if (name) m.name = name;
    return m;
  };
  const YEL   = mat(0xd6a41f, 'metal', { roughness: 0.72, metalness: 0.12 });
  const YEL2  = mat(0xc99a1c, 'metal', { roughness: 0.84, metalness: 0.10 });
  const YEL3  = mat(0xcf9f22, 'metal', { roughness: 0.76, metalness: 0.14 });
  const ORG   = mat(0xbe5220, 'metal', { roughness: 0.74, metalness: 0.12 });
  const ORG2  = mat(0xb04c1e, 'metal', { roughness: 0.86, metalness: 0.10 });
  const GALV  = mat(0x9aa0a3, 'metal', { roughness: 0.60, metalness: 0.68,
                                         side: THREE.DoubleSide });
  const GALV2 = mat(0x8f9598, 'metal', { roughness: 0.66, metalness: 0.62 });
  const STEEL = mat(0x5b6167, 'metal', { roughness: 0.82, metalness: 0.45 });
  const DARK  = mat(0x3a3d40, 'metal', { roughness: 0.88, metalness: 0.30,
                                         side: THREE.DoubleSide });
  const RUST  = mat(0x6e4128, 'metal', { roughness: 0.93, metalness: 0.18 });

  const B = (w, h, d, m, x, y, z) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z); g.add(o); return o;
  };
  const UP = new THREE.Vector3(0, 1, 0);
  const bar = (a, b, w, t, m) => {
    const d = new THREE.Vector3().subVectors(b, a), L = d.length();
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, L, t), m);
    o.position.copy(a).addScaledVector(d, 0.5);
    o.quaternion.setFromUnitVectors(UP, d.clone().normalize());
    g.add(o); return o;
  };
  const MX = (x, y, z, rx, ry, rz, sx, sy, sz) => new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
    new THREE.Vector3(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy,
                      sz === undefined ? 1 : sz));
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

  const XO = 1.35, CX = XO - 0.045, CF = 0.545, PLT = 0.014, H = 6.00;
  const LEVELS = [1.90, 3.60, 5.30];
  const bolts = [], wires = [];
  const WP = 0.020;   // wire prototype length; instance scale carries the rest

  // ---- closed square-tube columns + bolted perforated strip ---------------
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cx = sx * CX, hh = H - PLT, cy = PLT + hh / 2, cz = sz * (CF - 0.038);
      B(0.090, hh, 0.076, YEL,  cx, cy, cz);                     // RHS tube
      B(0.078, hh, 0.005, YEL3, cx, cy, cz + sz * 0.0355);       // aisle-face plate
      // bolted-on slot strip, standing 6mm proud of the tube
      B(0.060, hh - 0.10, 0.007, YEL2, cx, cy, sz * (CF + 0.003));
      // boxed foot
      B(0.160, 0.070, 0.185, STEEL, sx * (XO - 0.080), PLT + 0.035, sz * 0.455);
      B(0.180, PLT, 0.200, STEEL, sx * (XO - 0.090), PLT / 2, sz * 0.450);
      for (const dz of [-0.070, 0.070]) {
        bolts.push(MX(sx * (XO - 0.090), PLT + 0.007, sz * 0.450 + dz));
      }
      // knee-height protection: two bolted angle-iron shins, 0.30 - 0.60
      B(0.020, 0.300, 0.086, RUST, cx - sx * 0.038, 0.450, cz);
      B(0.086, 0.300, 0.020, RUST, cx, 0.450, cz + sz * 0.040);
      B(0.090, 0.012, 0.086, YEL2, cx, H - 0.006, cz);           // cap
    }
  }

  // ---- full X-bracing in every panel, bolted at the nodes -----------------
  const BZ = CF - 0.080;
  const HB = [0.66, 1.62, 2.62, 3.62, 4.62, 5.86];
  for (const sx of [-1, 1]) {
    const cx = sx * CX;
    for (let i = 0; i < HB.length; i++) {
      bar(new THREE.Vector3(cx, HB[i], -BZ), new THREE.Vector3(cx, HB[i], BZ),
          0.048, 0.030, YEL2);
      for (const sz of [-1, 1]) {
        B(0.056, 0.062, 0.032, YEL3, cx, HB[i], sz * (BZ - 0.020));
      }
    }
    for (let i = 0; i < HB.length - 1; i++) {
      bar(new THREE.Vector3(cx, HB[i], -BZ), new THREE.Vector3(cx, HB[i + 1], BZ),
          0.034, 0.020, YEL3);
      bar(new THREE.Vector3(cx, HB[i], BZ), new THREE.Vector3(cx, HB[i + 1], -BZ),
          0.034, 0.020, YEL3);
      B(0.040, 0.048, 0.040, YEL, cx, (HB[i] + HB[i + 1]) / 2, 0);   // crossing plate
    }
  }

  // ---- beams read as a fabrication: web box + welded top rail + bottom flange
  for (const yTop of LEVELS) {
    for (const sz of [-1, 1]) {
      const bz = sz * (CF - 0.026);
      B(2.700, 0.076, 0.045, ORG,  0, yTop - 0.052, bz);              // web box
      B(2.700, 0.018, 0.058, ORG2, 0, yTop - 0.009, bz - sz * 0.004); // top rail
      B(2.700, 0.014, 0.056, ORG2, 0, yTop - 0.097, bz - sz * 0.004); // bottom flange
      B(2.660, 0.010, 0.030, ORG,  0, yTop - 0.020, sz * (CF - 0.062)); // deck lip
      for (const sx of [-1, 1]) {
        B(0.080, 0.164, 0.012, STEEL, sx * CX, yTop - 0.052, sz * (CF + 0.010));
        B(0.080, 0.020, 0.026, STEEL, sx * CX, yTop - 0.140, sz * (CF + 0.004));
        for (const dy of [-0.056, 0.002, 0.060]) {
          bolts.push(MX(sx * CX, yTop - 0.052 + dy, sz * (CF + 0.021),
                        Math.PI / 2, 0, 0));
        }
      }
    }
    // four hat channels and a waterfall mat: fine cross wires, downturned edges
    for (const x of [-1.02, -0.34, 0.34, 1.02]) {
      B(0.048, 0.038, 1.010, GALV2, x, yTop - 0.022, 0);
    }
    for (let i = 0; i < 11; i++) {
      wires.push(MX(0, yTop + 0.007, -0.480 + i * 0.096, 0, 0, Math.PI / 2,
                    1, 2.660 / WP, 1));
    }
    for (let i = 0; i < 39; i++) {
      wires.push(MX(-1.320 + i * 0.0695, yTop + 0.016, 0, Math.PI / 2, 0, 0,
                    1, 1.070 / WP, 1));
    }
    for (const sz of [-1, 1]) {                      // downturned waterfall edge
      wires.push(MX(0, yTop - 0.012, sz * 0.536, 0, 0, Math.PI / 2, 1, 2.660 / WP, 1));
      wires.push(MX(0, yTop - 0.040, sz * 0.536, 0, 0, Math.PI / 2, 1, 2.660 / WP, 1));
    }
  }

  // ---- perforations on the bolted strip and on the outer face -------------
  const slots = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (let y = 0.16; y < H - 0.14; y += 0.062) {
        slots.push(MX(sx * CX, y, sz * (CF + 0.0082), 0, sz > 0 ? 0 : Math.PI, 0));
      }
      for (let y = 0.22; y < H - 0.16; y += 0.155) {
        slots.push(MX(sx * (XO - 0.0015), y, sz * (CF - 0.038),
                      0, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 0));
      }
    }
  }
  instanced(new THREE.PlaneGeometry(0.022, 0.038), DARK, slots);
  instanced(new THREE.CylinderGeometry(0.005, 0.005, WP, 4, 1, true), GALV, wires);
  instanced(new THREE.CylinderGeometry(0.013, 0.015, 0.013, 6), STEEL, bolts);

  // ---- plated markings ----------------------------------------------------
  B(0.230, 0.150, 0.008, GALV2, -0.780, 2.150, CF - 0.045);  // big load-rating plate
  B(0.076, 0.096, 0.006, GALV2,  CX, 1.550, CF + 0.010);     // bay tag on the column
  B(0.180, 0.062, 0.006, GALV2,  0.900, 1.842, CF - 0.047);  // hazard stencil patch

  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => { m.position.x -= c.x; m.position.y -= box.min.y; m.position.z -= c.z; });
  return g;
}
