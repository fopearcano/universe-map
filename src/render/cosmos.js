import * as THREE from 'three';
import { comovingMpc, displayRadius, displayRadiusFromMpc, distanceColor, MPC_TO_PC } from '../util/cosmology.js';

// Standard IAU/Hipparcos J2000 galactic → equatorial rotation (row-major): an
// equatorial unit vector e=(cos δ cos α, cos δ sin α, sin δ) equals R·g for a
// galactic unit vector g=(cos b cos l, cos b sin l, sin b). Verified against the
// galactic centre (α=266.405°, δ=−28.936°) and the NGP (α=192.859°, δ=+27.128°).
const G2E = [
  [-0.0548755604, 0.4941094279, -0.8676661490],
  [-0.8734370902, -0.4448296300, -0.1980763734],
  [-0.4838350155, 0.7469822445, 0.4559837762],
];
const PC_TO_LY = 3.2615638;

// The cosmological world: galaxies, quasars, the Local Group, our galaxy's stars,
// scale rings and the CMB shell, all placed on a logarithmic radial scale so the
// whole observable universe (~93 Gly across) fits one navigable scene centred on
// the Sun. Objects keep their true sky direction; only the radius is compressed.
export class CosmosWorld {
  constructor(scene, cosmosData, starCatalog, extras = {}) {
    this.scene = scene;
    this.data = cosmosData;
    this.catalog = starCatalog;
    this.decadeUnit = cosmosData.meta.decadeUnit;
    this.cmbR = cosmosData.meta.cmb.displayR;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    this.state = {
      zMax: 6, sizeScale: 1,
      show: { twomrs: true, sdssGal: true, sdssQso: true, localGroup: true, starCore: true, bridge: true, cmb: false, procedural: false },
    };
    this.procMode = 'green'; // 'green' | 'match'

    this.pointLayers = []; // { key, kind, count, data, points, worldPos:Float32 }
    this.ringTex = makeRingTexture();

    this._buildStarCore();
    this._buildLayer('twomrs', 'galaxy', 2.4);
    this._buildLayer('sdssGal', 'galaxy', 2.1);
    this._buildLayer('sdssQso', 'quasar', 2.7);
    const superVoids = extras.supervoids || [];
    this._buildProcedural([
      // structures.json voids, minus any the curated supervoid list already covers
      ...(extras.structures || []).filter((s) => s.type === 'void' && !superVoids.some((v) => v.name === s.name)),
      ...superVoids,
    ]);
    this._buildBridge();
    this._buildLocalGroup();
    this._buildRings();
    this._buildCMB();
  }

  // ---- procedural fill: a synthetic, fully-catalogued universe.
  // A "known universe" for storytelling — every direction is brought UP TO the
  // peak surface density of the best-surveyed real regions, so the sky reads as
  // completely mapped. Catalogued voids stay empty. Each object is real enough to
  // use: it is placed with a true distance (from a sampled redshift), is
  // selectable, carries a generated (imagined) identity, and can be added to a
  // route exactly like a real galaxy. Clearly imagined — green by default.
  //
  // Distribution is GRAVITY-SHAPED, not smooth: points cluster onto a cosmic web
  // that reflects the real data. Two fields drive placement — (a) a coarse 3-D
  // map of the real galaxy density (so the fill traces and extends the observed
  // filaments and clusters), and (b) a Worley/Voronoi "void" field whose seed
  // points are dropped into the real voids, so even under-surveyed regions grow
  // walls, filaments and cluster-nodes around empty voids. ----
  _buildProcedural(voids = []) {
    const MAX = 700000;                 // hard cap for GPU + pick performance
    const NB = 72, MB = 36;             // angular cells (lon × lat)
    let seed = 20240711;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

    // 1) real angular coverage + a redshift CDF, so the fill matches how a
    //    complete survey would actually look (same depth distribution).
    const grid = new Uint32Array(NB * MB);
    const ZBINS = 240; const zh = new Float64Array(ZBINS); let zHi = 0.05;
    for (const key of ['twomrs', 'sdssGal', 'sdssQso']) {
      const L = this.data.layers[key]; if (!L) continue;
      zHi = Math.max(zHi, L.zmax ?? 0.05);
    }
    for (const key of ['twomrs', 'sdssGal', 'sdssQso']) {
      const L = this.data.layers[key]; if (!L) continue;
      const d = L.data;
      for (let i = 0; i < L.count; i++) {
        const x = d[i * 4], y = d[i * 4 + 1], zc = d[i * 4 + 2], zr = d[i * 4 + 3];
        const bi = Math.min(NB - 1, Math.floor(((Math.atan2(y, x) + Math.PI) / (2 * Math.PI)) * NB));
        const bj = Math.min(MB - 1, Math.floor((Math.asin(Math.max(-1, Math.min(1, zc))) / Math.PI + 0.5) * MB));
        grid[bj * NB + bi]++;
        zh[Math.min(ZBINS - 1, Math.max(0, Math.floor((zr / zHi) * ZBINS)))]++;
      }
    }
    // redshift inverse-CDF sampler
    let zsum = 0; for (let i = 0; i < ZBINS; i++) zsum += zh[i];
    const zcdf = new Float64Array(ZBINS); let acc = 0;
    for (let i = 0; i < ZBINS; i++) { acc += zh[i] / zsum; zcdf[i] = acc; }
    const sampleZ = () => {
      const u = rnd(); let lo = 0, hi = ZBINS - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (zcdf[m] < u) lo = m + 1; else hi = m; }
      return Math.max(0.004, ((lo + rnd()) / ZBINS) * zHi);
    };

    // 2) target = peak real surface density, scaled per cell by solid angle so the
    //    completed sky has uniform density (not polar clumping). Fill each cell's
    //    deficit to that target.
    const counts = Array.from(grid).sort((a, b) => a - b);
    const peak = counts[Math.floor(counts.length * 0.9)] || 1; // robust "densest region"
    const cellDeficit = new Float64Array(NB * MB);
    let ideal = 0;
    for (let bj = 0; bj < MB; bj++) {
      const latC = ((bj + 0.5) / MB) * Math.PI - Math.PI / 2;
      const area = Math.max(0.06, Math.cos(latC));
      for (let bi = 0; bi < NB; bi++) {
        const def = Math.max(0, peak * area - grid[bj * NB + bi]);
        cellDeficit[bj * NB + bi] = def; ideal += def;
      }
    }
    const scale = ideal > MAX ? MAX / ideal : 1;
    this._procFraction = scale; // <1 means we hit the cap (density = scale × peak)

    // void exclusion zones (angular cap + radial band around each catalogued void;
    // supervoids carry their own measured extent, others fall back to a default)
    const voidZ = voids.map((v) => ({ dir: v.dir, r: v.displayR, cosR: v.cosR ?? 0.945, band: v.band ?? 2.2 }));
    const inVoid = (dir, r) => {
      for (const v of voidZ) {
        const dot = dir[0] * v.dir[0] + dir[1] * v.dir[1] + dir[2] * v.dir[2];
        if (dot > v.cosR && Math.abs(r - v.r) < v.band) return true;
      }
      return false;
    };

    // 2b) build the cosmic-web weight field over the display volume (precomputed
    //     on a coarse 3-D grid so per-point placement is a cheap lookup).
    const webGrid = this._buildWebField(rnd, voidZ);

    // 3) place points cell by cell, rejection-sampling each toward the web so the
    //    completed sky keeps its per-direction density but drapes onto filaments,
    //    walls and cluster-nodes around the voids (instead of a smooth haze).
    const cap = Math.min(MAX, Math.ceil(ideal * scale) + NB * MB);
    const pos = new Float32Array(cap * 3), col = new Float32Array(cap * 3);
    const zs = new Float32Array(cap), sz = new Float32Array(cap);
    this.procData = new Float32Array(cap * 4);     // [dx,dy,dz,z] per object (for pick/describe)
    this.procType = new Uint8Array(cap);           // 0 galaxy · 1 quasar
    let k = 0;
    for (let bj = 0; bj < MB && k < cap; bj++) {
      for (let bi = 0; bi < NB && k < cap; bi++) {
        let n = Math.floor(cellDeficit[bj * NB + bi] * scale);
        while (n-- > 0 && k < cap) {
          // draw a few candidate positions in this cell; accept the first that
          // survives a test ∝ the web weight (importance sampling onto filaments &
          // walls). If none is accepted, fall back to the HIGHEST-weight candidate
          // seen — so even the fallback leans onto the web — while still placing one
          // point, preserving the per-direction count and thus sky completeness.
          let px = 0, py = 0, pz = 0, dir = null, z = 0, r = 0, have = false, bestW = -1;
          for (let attempt = 0; attempt < 12; attempt++) {
            const lon = ((bi + rnd()) / NB) * 2 * Math.PI - Math.PI;
            const vv = ((bj + rnd()) / MB) * 2 - 1;                 // uniform in sin(lat)
            const dec = Math.asin(vv), cd = Math.cos(dec);
            const d2 = [cd * Math.cos(lon), cd * Math.sin(lon), Math.sin(dec)];
            const zz = sampleZ();
            const rr = displayRadiusFromMpc(comovingMpc(zz), this.decadeUnit);
            if (inVoid(d2, rr)) continue;
            const qx = d2[0] * rr, qy = d2[1] * rr, qz = d2[2] * rr, wv = this._webAt(webGrid, qx, qy, qz);
            if (!have || wv > bestW) { bestW = wv; px = qx; py = qy; pz = qz; dir = d2; z = zz; r = rr; have = true; }
            if (rnd() < wv) { px = qx; py = qy; pz = qz; dir = d2; z = zz; r = rr; break; }  // accepted onto the web
          }
          if (!have) continue;                                     // whole column fell in a catalogued void
          pos[k * 3] = px; pos[k * 3 + 1] = py; pos[k * 3 + 2] = pz;
          const [cr, cg, cb] = distanceColor(r / this.cmbR);
          col[k * 3] = cr; col[k * 3 + 1] = cg; col[k * 3 + 2] = cb;
          zs[k] = z; sz[k] = 0.85 + (z > zHi * 0.5 ? 0.15 : 0);
          this.procData[k * 4] = dir[0]; this.procData[k * 4 + 1] = dir[1]; this.procData[k * 4 + 2] = dir[2]; this.procData[k * 4 + 3] = z;
          this.procType[k] = (z > 0.5 && rnd() < 0.22) ? 1 : 0;
          k++;
        }
      }
    }
    this._procCount = k;
    this.procWorld = pos.subarray(0, k * 3); // world positions for picking

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, k * 3), 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col.subarray(0, k * 3), 3));
    geo.setAttribute('aZ', new THREE.BufferAttribute(zs.subarray(0, k), 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sz.subarray(0, k), 1));
    const mat = this._pointMaterial(2.3);
    mat.uniforms.uProc.value = 1; // green by default
    this.procMat = mat;
    this.procPoints = new THREE.Points(geo, mat);
    this.procPoints.frustumCulled = false;
    this.procPoints.visible = this.state.show.procedural;
    this.group.add(this.procPoints);
  }

  // Cosmic-web weight field (0..1) sampled on a coarse 3-D grid over the display
  // volume. Combines the real galaxy density (so procedural structure continues
  // the observed web) with a Worley/Voronoi field whose seeds sit in the real
  // voids — walls/filaments lie on the boundaries between voids (points nearly
  // equidistant to two seeds), cluster-nodes at the vertices (three+ seeds), and
  // void interiors keep only a sparse floor. Returns { NG, R, cell, w }.
  _buildWebField(rnd, voidZ) {
    const R = this.cmbR, NG = 48, cell = (2 * R) / NG;
    const gi = (x, y, z) => {
      const gx = Math.min(NG - 1, Math.max(0, ((x + R) / cell) | 0));
      const gy = Math.min(NG - 1, Math.max(0, ((y + R) / cell) | 0));
      const gz = Math.min(NG - 1, Math.max(0, ((z + R) / cell) | 0));
      return (gz * NG + gy) * NG + gx;
    };
    // (a) real density → box-blurred so it reads as coherent filaments
    const dens = new Float32Array(NG * NG * NG);
    for (const L of this.pointLayers) {
      const wp = L.worldPos;
      for (let i = 0; i < L.count; i++) dens[gi(wp[i * 3], wp[i * 3 + 1], wp[i * 3 + 2])]++;
    }
    const blur = new Float32Array(NG * NG * NG);
    for (let z = 0; z < NG; z++) for (let y = 0; y < NG; y++) for (let x = 0; x < NG; x++) {
      let s = 0, c = 0;
      for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy, zz = z + dz;
        if (xx < 0 || yy < 0 || zz < 0 || xx >= NG || yy >= NG || zz >= NG) continue;
        s += dens[(zz * NG + yy) * NG + xx]; c++;
      }
      blur[(z * NG + y) * NG + x] = s / c;
    }
    const nz = []; for (let i = 0; i < blur.length; i++) if (blur[i] > 0) nz.push(blur[i]);
    nz.sort((a, b) => a - b);
    const dRef = nz.length ? (nz[Math.floor(nz.length * 0.9)] || 1) : 1;

    // (b) Worley void seeds: uniform in the ball, kept with probability ∝ (1 −
    //     realDensity) so they fall into the real voids; catalogued voids seeded too.
    const seeds = [];
    for (const v of voidZ) seeds.push([v.dir[0] * v.r, v.dir[1] * v.r, v.dir[2] * v.r]);
    const TARGET = 1100, MAXTRY = TARGET * 40;
    for (let t = 0; t < MAXTRY && seeds.length < TARGET; t++) {
      const ct = 2 * rnd() - 1, st = Math.sqrt(Math.max(0, 1 - ct * ct)), ph = 2 * Math.PI * rnd(), rr = R * Math.cbrt(rnd());
      const x = rr * st * Math.cos(ph), y = rr * st * Math.sin(ph), z = rr * ct;
      const rn = Math.min(1, blur[gi(x, y, z)] / dRef);
      if (rnd() < 0.12 + 0.88 * (1 - rn)) seeds.push([x, y, z]);
    }
    // bucket seeds for fast nearest-two
    const BG = Math.max(4, Math.round((2 * R) / 6)), bc = (2 * R) / BG;
    const bi = (x, y, z) => {
      const gx = Math.min(BG - 1, Math.max(0, ((x + R) / bc) | 0));
      const gy = Math.min(BG - 1, Math.max(0, ((y + R) / bc) | 0));
      const gz = Math.min(BG - 1, Math.max(0, ((z + R) / bc) | 0));
      return (gz * BG + gy) * BG + gx;
    };
    const buckets = Array.from({ length: BG * BG * BG }, () => []);
    seeds.forEach((s, si) => buckets[bi(s[0], s[1], s[2])].push(si));
    const nearestTwo = (x, y, z) => {
      const gx = Math.min(BG - 1, Math.max(0, ((x + R) / bc) | 0));
      const gy = Math.min(BG - 1, Math.max(0, ((y + R) / bc) | 0));
      const gz = Math.min(BG - 1, Math.max(0, ((z + R) / bc) | 0));
      let f1 = Infinity, f2 = Infinity;
      for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = gx + dx, yy = gy + dy, zz = gz + dz;
        if (xx < 0 || yy < 0 || zz < 0 || xx >= BG || yy >= BG || zz >= BG) continue;
        for (const si of buckets[(zz * BG + yy) * BG + xx]) {
          const s = seeds[si], d = Math.hypot(x - s[0], y - s[1], z - s[2]);
          if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
        }
      }
      return [f1, f2];
    };
    // (c) bake the combined weight per cell centre
    const w = new Float32Array(NG * NG * NG);
    for (let z = 0; z < NG; z++) for (let y = 0; y < NG; y++) for (let x = 0; x < NG; x++) {
      const cx = -R + (x + 0.5) * cell, cy = -R + (y + 0.5) * cell, cz = -R + (z + 0.5) * cell;
      const [f1, f2] = nearestTwo(cx, cy, cz);
      let wall = 0;
      if (isFinite(f2)) { const edge = (f2 - f1) / (f2 + f1 + 1e-6); let t = 1 - Math.min(1, edge / 0.16); wall = t * t * (3 - 2 * t); }
      const rn = Math.min(1, blur[(z * NG + y) * NG + x] / dRef);
      w[(z * NG + y) * NG + x] = Math.min(1, 0.05 + 0.82 * wall + 1.0 * rn);
    }
    return { NG, R, cell, w };
  }

  _webAt(field, x, y, z) {
    const { NG, R, cell, w } = field;
    const gx = Math.min(NG - 1, Math.max(0, ((x + R) / cell) | 0));
    const gy = Math.min(NG - 1, Math.max(0, ((y + R) / cell) | 0));
    const gz = Math.min(NG - 1, Math.max(0, ((z + R) / cell) | 0));
    return w[(gz * NG + gy) * NG + gx];
  }

  // ---- cyan "galactic bridge" ----
  // Fills the empty display shell between the ~1 kpc local star bubble (star core,
  // displayR≲9) and the Local Group / extragalactic data (displayR≳14) — the body
  // of our own Galaxy and the inner Local Group, which no per-object catalogue maps
  // at this fidelity. A modelled Milky Way (exponential disk + four logarithmic
  // spiral arms, boxy bar/bulge), its globular-cluster & stellar halo, the
  // Magellanic Clouds and their bridge, and a scatter reaching toward Andromeda.
  // Built in galactic coordinates (Sun at the origin, the Galactic Centre R0≈8.2 kpc
  // toward Sagittarius) then rotated into the scene's equatorial frame, so the band
  // of the Milky Way crosses the sky at the correct tilt. Cyan, selectable, route-able.
  _buildBridge() {
    const D = this.decadeUnit, R0 = 8200;                 // Sun→GC in parsecs
    let seed = 8675309;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 2;    // ≈ unit-variance (σ≈1)

    const CAP = 340000;
    const pos = new Float32Array(CAP * 3), col = new Float32Array(CAP * 3), sz = new Float32Array(CAP);
    const data = new Float32Array(CAP * 4);               // [dx,dy,dz, distPc]
    const knd = new Uint8Array(CAP);                      // 0 disk 1 bulge 2 halo/GC 3 magellanic 4 LG
    let k = 0;
    const CY = [0.30, 0.86, 1.0];
    const put = (dx, dy, dz, dpc, kind, bright, size) => {   // dx.. = equatorial unit dir
      if (k >= CAP || dpc < 1) return;
      const dr = displayRadius(dpc, D);
      pos[k * 3] = dx * dr; pos[k * 3 + 1] = dy * dr; pos[k * 3 + 2] = dz * dr;
      col[k * 3] = CY[0] * bright; col[k * 3 + 1] = CY[1] * bright; col[k * 3 + 2] = CY[2] * bright;
      sz[k] = size;
      data[k * 4] = dx; data[k * 4 + 1] = dy; data[k * 4 + 2] = dz; data[k * 4 + 3] = dpc;
      knd[k] = kind; k++;
    };
    // heliocentric galactic vector (pc) → rotate to equatorial → store
    const putGal = (gx, gy, gz, kind, bright, size) => {
      const dpc = Math.hypot(gx, gy, gz); if (dpc < 1) return;
      const ex = G2E[0][0] * gx + G2E[0][1] * gy + G2E[0][2] * gz;
      const ey = G2E[1][0] * gx + G2E[1][1] * gy + G2E[1][2] * gz;
      const ez = G2E[2][0] * gx + G2E[2][1] * gy + G2E[2][2] * gz;
      const inv = 1 / dpc; put(ex * inv, ey * inv, ez * inv, dpc, kind, bright, size);
    };
    const eqDir = (raD, decD) => { const a = raD * Math.PI / 180, d = decD * Math.PI / 180, cd = Math.cos(d); return [cd * Math.cos(a), cd * Math.sin(a), Math.sin(d)]; };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const nrm = (v) => { const m = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / m, v[1] / m, v[2] / m]; };
    // a Gaussian blob of n points at a given equatorial direction & distance
    const blob = (dir, dpc, spread, n, kind, size) => {
      const up = Math.abs(dir[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
      const t1 = nrm(cross(up, dir)), t2 = cross(dir, t1);
      for (let i = 0; i < n; i++) {
        const a = gauss() * spread, b = gauss() * spread, rr = dpc + gauss() * spread;
        const x = dir[0] * rr + t1[0] * a + t2[0] * b, y = dir[1] * rr + t1[1] * a + t2[1] * b, z = dir[2] * rr + t1[2] * a + t2[2] * b;
        const d = Math.hypot(x, y, z); put(x / d, y / d, z / d, d, kind, 0.7 + rnd() * 0.3, size);
      }
    };

    // 1) thin disk + four logarithmic spiral arms + sparse flared outer disk
    const DISK = 200000, Rd = 2600, hZ = 300, cotP = 1 / Math.tan(12.8 * Math.PI / 180), ARMS = 4;
    const armPhase = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
    for (let i = 0; i < DISK; i++) {
      const flared = rnd() < 0.06;
      // Erlang(2, Rd) — the correct radial law for a 2-D exponential-surface-density
      // disk sampled in polar coords: p(R) ∝ R·e^(−R/Rd), peaking at one scale length
      // (a plain exponential would cusp at R=0 and pile onto the bulge).
      let Rg = flared ? 16000 + rnd() * 16000 : -Rd * (Math.log(1 - rnd()) + Math.log(1 - rnd()));
      if (!(Rg <= 34000)) continue;                            // also skips the rare log(0)→∞
      const onArm = !flared && rnd() < 0.62;
      let th = rnd() * 2 * Math.PI;
      if (onArm) th = armPhase[(Math.floor(rnd() * ARMS))] + Math.log(Rg / 2600) * cotP + gauss() * 0.13;
      const zscale = flared ? hZ * 3 : hZ;
      const z = -zscale * Math.log(1 - rnd() * 0.98) * (rnd() < 0.5 ? 1 : -1);
      putGal(R0 + Rg * Math.cos(th), Rg * Math.sin(th), z, 0, onArm ? 0.82 + rnd() * 0.18 : 0.5 + rnd() * 0.3, onArm ? 0.85 : 0.68);
    }
    // 2) boxy bar / bulge — triaxial concentration at the GC, tilted to the Sun-GC line
    const BAR = 34000, ba = 27 * Math.PI / 180, ca = Math.cos(ba), sa = Math.sin(ba);
    for (let i = 0; i < BAR; i++) {
      const a = gauss() * 2200, b = gauss() * 900, c = gauss() * 700;
      putGal(R0 + (a * ca - b * sa), a * sa + b * ca, c, 1, 0.72 + rnd() * 0.28, 0.8);
    }
    // 3) globular-cluster system (~200 clusters, 90% within 40 kpc, rare outliers to 150 kpc)
    for (let g = 0; g < 200; g++) {
      const outlier = rnd() < 0.1;
      const rr = outlier ? 40000 + rnd() * 110000 : 2000 + 38000 * Math.pow(rnd(), 0.8);
      const ct = 2 * rnd() - 1, st = Math.sqrt(Math.max(0, 1 - ct * ct)), ph = 2 * Math.PI * rnd();
      const cx = rr * st * Math.cos(ph), cy = rr * st * Math.sin(ph), cz = rr * ct, cs = 130 + rnd() * 160;
      for (let j = 0; j < 46; j++) putGal(R0 + cx + gauss() * cs, cy + gauss() * cs, cz + gauss() * cs, 2, 0.8 + rnd() * 0.2, 0.82);
    }
    // 3b) diffuse stellar halo, number ∝ r^-1.5 dr (density ∝ r^-3.5) out to ~150 kpc
    for (let i = 0; i < 12000; i++) {
      const a = Math.pow(5000, -0.5), b = Math.pow(150000, -0.5);
      const rr = Math.pow(a + (b - a) * rnd(), -2);
      const ct = 2 * rnd() - 1, st = Math.sqrt(Math.max(0, 1 - ct * ct)), ph = 2 * Math.PI * rnd();
      putGal(R0 + rr * st * Math.cos(ph), rr * st * Math.sin(ph), rr * ct, 2, 0.4 + rnd() * 0.3, 0.6);
    }
    // 4) Magellanic Clouds + the Magellanic Bridge between them
    const lmc = eqDir(80.894, -69.756), smc = eqDir(13.19, -72.83), lmcD = 49970, smcD = 62440;
    blob(lmc, lmcD, 3400, 20000, 3, 0.95);
    blob(smc, smcD, 2300, 10000, 3, 0.88);
    for (let i = 0; i < 4000; i++) {
      const t = rnd();
      const d = nrm([lmc[0] + (smc[0] - lmc[0]) * t, lmc[1] + (smc[1] - lmc[1]) * t, lmc[2] + (smc[2] - lmc[2]) * t]);
      put(d[0], d[1], d[2], lmcD + (smcD - lmcD) * t + gauss() * 3000, 3, 0.45 + rnd() * 0.3, 0.6);
    }
    // 5) inner Local Group — blobs toward Andromeda (M31) & Triangulum (M33), plus a
    //    diffuse scatter reaching out to ~3 Mpc so the cyan bridge meets the 2MRS shell
    blob(eqDir(10.68, 41.27), 780000, 60000, 8000, 4, 1.1);
    blob(eqDir(23.46, 30.66), 970000, 45000, 4000, 4, 1.0);
    for (let i = 0; i < 13000; i++) {
      const ct = 2 * rnd() - 1, st = Math.sqrt(Math.max(0, 1 - ct * ct)), ph = 2 * Math.PI * rnd();
      put(st * Math.cos(ph), st * Math.sin(ph), ct, 200000 + Math.pow(rnd(), 0.7) * 2800000, 4, 0.4 + rnd() * 0.3, 0.7);
    }

    this.bridgeCount = k;
    this.bridgeData = data.subarray(0, k * 4);
    this.bridgeWorld = pos.subarray(0, k * 3);
    this.bridgeKind = knd.subarray(0, k);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, k * 3), 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col.subarray(0, k * 3), 3));
    geo.setAttribute('aZ', new THREE.BufferAttribute(new Float32Array(k), 1));   // z=0 → never redshift-hidden
    geo.setAttribute('aSize', new THREE.BufferAttribute(sz.subarray(0, k), 1));
    const mat = this._pointMaterial(1.7);
    this.bridgeMat = mat;
    this.bridgePoints = new THREE.Points(geo, mat);
    this.bridgePoints.frustumCulled = false;
    this.bridgePoints.visible = this.state.show.bridge;
    this.group.add(this.bridgePoints);
  }

  // Instant green ↔ distance-colour toggle for the procedural fill.
  setProceduralColor(mode) {
    this.procMode = mode;
    if (this.procMat) this.procMat.uniforms.uProc.value = mode === 'green' ? 1 : 0;
  }
  proceduralCount() { return this._procCount || 0; }
  proceduralFraction() { return this._procFraction ?? 1; }

  // ---- our galaxy's stars, log-radialised into a central core ----
  _buildStarCore() {
    const c = this.catalog;
    if (!c) return;
    const N = c.count;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const x = c.positions[i * 3], y = c.positions[i * 3 + 1], z = c.positions[i * 3 + 2];
      const d = Math.hypot(x, y, z);
      const r = displayRadius(d, this.decadeUnit);
      if (d < 1e-6) { pos[i * 3] = pos[i * 3 + 1] = pos[i * 3 + 2] = 0; continue; }
      const k = r / d;
      pos[i * 3] = x * k; pos[i * 3 + 1] = y * k; pos[i * 3 + 2] = z * k;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(constColor(N, [0.85, 0.86, 0.7]), 3));
    geo.setAttribute('aZ', new THREE.BufferAttribute(new Float32Array(N), 1)); // z=0, always shown
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(N).fill(1), 1));
    const mat = this._pointMaterial(1.5);
    this.starCore = new THREE.Points(geo, mat);
    this.starCore.frustumCulled = false;
    this.group.add(this.starCore);
  }

  _buildLayer(key, kind, size) {
    const layer = this.data.layers[key];
    if (!layer) return;
    const N = layer.count, src = layer.data;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const zs = new Float32Array(N);
    const sz = new Float32Array(N);
    // per-layer redshift span, so nearer objects in each shell read a touch bigger
    const zLo = layer.zmin ?? 0, zHi = Math.max(layer.zmax ?? 1, zLo + 1e-6);
    for (let i = 0; i < N; i++) {
      const dx = src[i * 4], dy = src[i * 4 + 1], dz = src[i * 4 + 2], z = src[i * 4 + 3];
      const mpc = comovingMpc(z);
      const r = displayRadiusFromMpc(mpc, this.decadeUnit);
      pos[i * 3] = dx * r; pos[i * 3 + 1] = dy * r; pos[i * 3 + 2] = dz * r;
      const [cr, cg, cb] = distanceColor(r / this.cmbR);
      col[i * 3] = cr; col[i * 3 + 1] = cg; col[i * 3 + 2] = cb;
      zs[i] = z;
      // proximity cue: nearest in the shell ≈1.35×, farthest ≈0.8× the base size
      const f = Math.min(1, Math.max(0, (z - zLo) / (zHi - zLo)));
      sz[i] = 1.35 - 0.55 * f;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aZ', new THREE.BufferAttribute(zs, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    const mat = this._pointMaterial(size);
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.group.add(points);
    this.pointLayers.push({ key, kind, count: N, data: src, worldPos: pos, points, mat });
  }

  _pointMaterial(size) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uSize: { value: size },
        uSizeScale: { value: 1 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uZMax: { value: 6 },
        uProc: { value: 0 },                       // 1 = tint uniform green (procedural fill)
        uProcColor: { value: new THREE.Color(0.32, 1.0, 0.45) },
      },
      vertexShader: /* glsl */`
        attribute vec3 aColor; attribute float aZ; attribute float aSize;
        uniform float uSize, uSizeScale, uPixelRatio, uZMax, uProc;
        uniform vec3 uProcColor;
        varying vec3 vColor; varying float vHide;
        void main(){
          vColor = mix(aColor, uProcColor, uProc);
          vHide = aZ > uZMax ? 1.0 : 0.0;
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = (vHide > 0.5 ? 0.0 : uSize * aSize * uSizeScale * uPixelRatio);
          gl_Position = projectionMatrix * mv;
        }`,
      // Soft round points — no diffraction shards here. aSize on the real catalogue
      // layers is only a per-shell proximity proxy (no photometry), so a brightness
      // gate can't be honestly derived from it; magnitude-driven shards live in the
      // LOCAL star field (starfield.js) where apparent magnitude actually exists.
      fragmentShader: /* glsl */`
        varying vec3 vColor; varying float vHide;
        void main(){
          if(vHide > 0.5) discard;
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if(d > 0.5) discard;
          float a = smoothstep(0.5, 0.08, d);
          gl_FragColor = vec4(vColor, a * 0.9);
        }`,
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    });
  }

  _buildLocalGroup() {
    const lg = this.data.localGroup;
    this.localGroupPos = [];
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(lg.length * 3);
    lg.forEach((g, i) => {
      const r = g.displayR;
      const p = new THREE.Vector3(g.dir[0] * r, g.dir[1] * r, g.dir[2] * r);
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      this.localGroupPos.push(p);
    });
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 10, map: this.ringTex, sizeAttenuation: false, transparent: true,
      color: 0x9fe8ff, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.localGroupPoints = new THREE.Points(geo, mat);
    this.localGroupPoints.frustumCulled = false;
    this.group.add(this.localGroupPoints);
  }

  _buildRings() {
    const rings = new THREE.Group();
    const mat = new THREE.LineBasicMaterial({ color: 0x2b4a63, transparent: true, opacity: 0.5 });
    this.ringLabels = [];
    for (const d of this.data.meta.decades) {
      addCircle(rings, d.displayR, mat);
      this.ringLabels.push({ pos: new THREE.Vector3(d.displayR * 0.707, d.displayR * 0.707, 0), text: d.label, cls: 'lbl-ring' });
    }
    // CMB ring
    const cmbMat = new THREE.LineBasicMaterial({ color: 0x8a5a9a, transparent: true, opacity: 0.7 });
    addCircle(rings, this.cmbR, cmbMat);
    this.ringLabels.push({ pos: new THREE.Vector3(this.cmbR * 0.707, -this.cmbR * 0.707, 0), text: 'CMB · z≈1100', cls: 'lbl-axis' });
    this.rings = rings;
    this.group.add(rings);
  }

  _buildCMB() {
    const geo = new THREE.SphereGeometry(this.cmbR, 96, 64);
    const mat = new THREE.MeshBasicMaterial({
      map: makeCMBTexture(), side: THREE.BackSide, transparent: true, opacity: 0.12, depthWrite: false,
    });
    this.cmb = new THREE.Mesh(geo, mat);
    // Orient so the texture's poles sit at the celestial poles (see the RA/Dec
    // derivation baked into scripts/build-cmb.mjs).
    this.cmb.rotation.x = Math.PI / 2;
    this.cmb.frustumCulled = false;
    this.group.add(this.cmb);

    // Upgrade the placeholder to the real reprojected WMAP CMB map when present.
    const base = import.meta.env.BASE_URL || '/';
    new THREE.TextureLoader().load(
      `${base}data/cmb.png`.replace(/([^:])\/\/+/g, '$1/'),
      (tex) => { tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; mat.map = tex; mat.needsUpdate = true; this.cmbReal = true; },
      undefined,
      () => {} // keep the procedural fallback on error
    );
  }

  // Manual CMB opacity override (null = auto fade with camera distance).
  setCmbOpacity(v) { this._cmbOverride = v; }

  // Fade the CMB shell in as the camera pulls out toward the horizon, so it stays
  // a faint backdrop while exploring the interior and only asserts itself at the edge.
  update(camera) {
    if (!this.cmb || !this.cmb.visible) return;
    if (this._cmbOverride != null) { this.cmb.material.opacity = this._cmbOverride; return; }
    const frac = Math.min(1, camera.position.length() / this.cmbR);
    this.cmb.material.opacity = 0.06 + 0.28 * frac * frac;
  }

  // ---- state ----
  setVisible(v) { this.group.visible = v; }

  applyFilter(partial = {}) {
    if (partial.show) Object.assign(this.state.show, partial.show);
    if (partial.zMax != null) this.state.zMax = partial.zMax;
    if (partial.sizeScale != null) this.state.sizeScale = partial.sizeScale;
    const s = this.state;
    for (const L of this.pointLayers) {
      L.points.visible = !!s.show[L.key];
      L.mat.uniforms.uZMax.value = s.zMax;
      L.mat.uniforms.uSizeScale.value = s.sizeScale;
    }
    if (this.starCore) { this.starCore.visible = s.show.starCore; this.starCore.material.uniforms.uSizeScale.value = s.sizeScale; }
    if (this.procPoints) {
      this.procPoints.visible = !!s.show.procedural;
      this.procMat.uniforms.uZMax.value = s.zMax;
      this.procMat.uniforms.uSizeScale.value = s.sizeScale;
    }
    if (this.bridgePoints) {
      this.bridgePoints.visible = s.show.bridge !== false;
      this.bridgeMat.uniforms.uSizeScale.value = s.sizeScale;
    }
    if (this.localGroupPoints) this.localGroupPoints.visible = s.show.localGroup;
    if (this.cmb) this.cmb.visible = s.show.cmb;
    this.rings.visible = true;
    this._recount();
  }

  _recount() {
    const s = this.state;
    let n = 0;
    for (const L of this.pointLayers) if (s.show[L.key]) {
      const zarr = L.data; let c = 0;
      for (let i = 0; i < L.count; i++) if (zarr[i * 4 + 3] <= s.zMax) c++;
      n += c;
    }
    if (s.show.localGroup) n += this.data.localGroup.length;
    if (s.show.bridge !== false && this.bridgeData) n += this.bridgeCount;
    if (s.show.procedural && this.procData) {
      const pd = this.procData; let c = 0;
      for (let i = 0; i < this._procCount; i++) if (pd[i * 4 + 3] <= s.zMax) c++;
      n += c;
    }
    this._visibleCount = n;
  }

  visibleCount() { return this._visibleCount ?? this.data.totalCount?.() ?? 0; }

  // ---- picking (nearest ray across galaxy/quasar/local-group layers) ----
  // The procedural "known-universe" layer can be ~650k points, so scanning it is
  // ~25ms — fine for a one-off click, too heavy for the 10Hz hover. Callers pass
  // includeProcedural:false on hover to keep it smooth; click/route pass true.
  pick(raycaster, { includeProcedural = true, includeBridge = true } = {}) {
    const ray = raycaster.ray, origin = ray.origin, dir = ray.direction;
    const fovY = (raycaster.camera?.fov || 60) * Math.PI / 180;
    const maxAng = 14 * (fovY / window.innerHeight);
    let best = null, bestAng = maxAng, bestT = Infinity;
    const p = new THREE.Vector3();
    const s = this.state;

    const consider = (px, py, pz, make) => {
      p.set(px, py, pz).sub(origin);
      const t = p.dot(dir);
      if (t <= 0) return;
      const ang = Math.sqrt(Math.max(0, p.lengthSq() - t * t)) / t;
      if (ang < bestAng || (ang < maxAng && t < bestT && Math.abs(ang - bestAng) < 1e-9)) {
        best = make(); bestAng = ang; bestT = t;
      }
    };

    for (const L of this.pointLayers) {
      if (!s.show[L.key]) continue;
      const wp = L.worldPos, zarr = L.data;
      for (let i = 0; i < L.count; i++) {
        if (zarr[i * 4 + 3] > s.zMax) continue;
        consider(wp[i * 3], wp[i * 3 + 1], wp[i * 3 + 2], () => ({ kind: L.kind, layer: L.key, i }));
      }
    }
    if (s.show.localGroup) {
      this.localGroupPos.forEach((v, i) =>
        consider(v.x, v.y, v.z, () => ({ kind: 'localgalaxy', i })));
    }
    if (includeBridge && s.show.bridge !== false && this.bridgeData) {
      const wp = this.bridgeWorld;
      for (let i = 0; i < this.bridgeCount; i++) consider(wp[i * 3], wp[i * 3 + 1], wp[i * 3 + 2], () => ({ kind: 'bridge', i }));
    }
    if (includeProcedural && s.show.procedural && this.procData) {
      const wp = this.procWorld, pd = this.procData;
      for (let i = 0; i < this._procCount; i++) {
        if (pd[i * 4 + 3] > s.zMax) continue;
        consider(wp[i * 3], wp[i * 3 + 1], wp[i * 3 + 2], () => ({ kind: 'procedural', i }));
      }
    }
    return best;
  }

  // ---- describe a picked object for the info panel ----
  describe(hit) {
    if (hit.kind === 'bridge') {
      const i = hit.i, bd = this.bridgeData;
      const dir = [bd[i * 4], bd[i * 4 + 1], bd[i * 4 + 2]], dpc = bd[i * 4 + 3];
      const v = new THREE.Vector3(this.bridgeWorld[i * 3], this.bridgeWorld[i * 3 + 1], this.bridgeWorld[i * 3 + 2]);
      const { ra, dec } = dirToRaDec(dir);
      return bridgeIdentity(i, this.bridgeKind[i], ra, dec, dpc, v, dir);
    }
    if (hit.kind === 'procedural') {
      const i = hit.i, pd = this.procData;
      const dir = [pd[i * 4], pd[i * 4 + 1], pd[i * 4 + 2]], z = pd[i * 4 + 3];
      const mpc = comovingMpc(z);
      const v = new THREE.Vector3(this.procWorld[i * 3], this.procWorld[i * 3 + 1], this.procWorld[i * 3 + 2]);
      const { ra, dec } = dirToRaDec(dir);
      return procIdentity(i, this.procType[i], ra, dec, z, mpc, v, dir);
    }
    if (hit.kind === 'localgalaxy') {
      const g = this.data.localGroup[hit.i];
      const v = this.localGroupPos[hit.i];
      const { ra, dec } = dirToRaDec(g.dir);
      return {
        kind: 'localgalaxy', name: g.name, designation: g.name, sub: g.type,
        worldPos: v.clone(), dir: g.dir,
        ra, dec, distMpc: g.distMpc, z: null, comovingMpc: g.distMpc, distLy: g.distLy,
        survey: 'Local Group', lookback: (g.distLy / 1e9),
      };
    }
    const L = this.pointLayers.find((x) => x.key === hit.layer);
    const i = hit.i;
    const dir = [L.data[i * 4], L.data[i * 4 + 1], L.data[i * 4 + 2]];
    const z = L.data[i * 4 + 3];
    const mpc = comovingMpc(z);
    const v = new THREE.Vector3(L.worldPos[i * 3], L.worldPos[i * 3 + 1], L.worldPos[i * 3 + 2]);
    const { ra, dec } = dirToRaDec(dir);
    const survey = hit.layer === 'twomrs' ? '2MASS Redshift Survey' : 'Sloan Digital Sky Survey';
    const prefix = hit.layer === 'twomrs' ? '2MASX' : 'SDSS';
    return {
      kind: hit.kind, // 'galaxy' | 'quasar'
      name: `${prefix} ${jCoord(ra, dec)}`,
      designation: `${prefix} ${jCoord(ra, dec)}`,
      sub: `${hit.kind === 'quasar' ? 'quasar' : 'galaxy'} · ${survey}`,
      worldPos: v, dir, ra, dec, z, comovingMpc: mpc, distLy: mpc * 3.2615638e6, survey,
    };
  }

  labelItems() {
    const lg = this.data.localGroup.map((g, i) => ({ pos: this.localGroupPos[i].clone(), text: g.name.replace(/\s*\(.*\)/, ''), prio: 10 }));
    return { rings: this.ringLabels, localGroup: lg };
  }

  defaultView() {
    // pulled back to see the cosmic web / most of the shell
    return { pos: new THREE.Vector3(11, 7, 15).setLength(26), target: new THREE.Vector3(0, 0, 0) };
  }
}

// ---- helpers ----
function smoothstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function constColor(n, rgb) {
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = rgb[0]; a[i * 3 + 1] = rgb[1]; a[i * 3 + 2] = rgb[2]; }
  return a;
}
function addCircle(group, r, mat, seg = 160) {
  const pts = [];
  for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); }
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
}
function dirToRaDec(d) {
  const dec = Math.asin(d[2]) * 180 / Math.PI;
  let ra = Math.atan2(d[1], d[0]) * 180 / Math.PI; if (ra < 0) ra += 360;
  return { ra: ra / 15, dec };
}
// IAU-style Jhhmmss.s±ddmmss designation from RA (hours) + Dec (deg).
function jCoord(raH, decD) {
  const p2 = (n) => String(Math.floor(n)).padStart(2, '0');
  const rh = Math.floor(raH), rm = Math.floor((raH - rh) * 60), rs = ((raH - rh) * 60 - rm) * 60;
  const sign = decD < 0 ? '−' : '+', ad = Math.abs(decD), dd = Math.floor(ad), dm = Math.floor((ad - dd) * 60), ds = ((ad - dd) * 60 - dm) * 60;
  return `J${p2(rh)}${p2(rm)}${rs.toFixed(1).padStart(4, '0')}${sign}${p2(dd)}${p2(dm)}${p2(Math.floor(ds))}`;
}
// short Jhhmm±ddmm designation
function jShort(raH, decD) {
  const p2 = (n) => String(Math.floor(n)).padStart(2, '0');
  const rh = Math.floor(raH), rm = Math.floor((raH - rh) * 60);
  const sign = decD < 0 ? '−' : '+', ad = Math.abs(decD), dd = Math.floor(ad), dm = Math.floor((ad - dd) * 60);
  return `J${p2(rh)}${p2(rm)}${sign}${p2(dd)}${p2(dm)}`;
}

// ---- imagined identity for a procedural object (deterministic per index) ----
const PROC_A = ['Ae', 'Vor', 'Xel', 'Cy', 'Nyx', 'Tha', 'Or', 'Zu', 'Ka', 'Lyr', 'Men', 'Qua', 'Ser', 'Ith', 'Ob', 'Rha', 'Vel', 'Un', 'Es', 'Wor', 'Ael', 'Sol', 'Bel', 'Cor', 'Dre', 'Eph', 'Fen', 'Gal', 'Hel', 'Ios', 'Jor', 'Kae'];
const PROC_B = ['ra', 'lex', 'mos', 'tha', 'na', 'vi', 'ric', 'dor', 'sa', 'pel', 'tia', 'xis', 'une', 'bar', 'gon', 'mir', 'wei', 'los', 'cha', 'dis', 'mun', 'ket', 'nul', 'pha', 'rae', 'tul'];
const PROC_C = ['', '', '', ' Prime', ' Major', ' Minor', ' A', ' B', ' Nexus', ' Reach', ' Veil'];
const GAL_TYPES = ['grand-design spiral', 'barred spiral', 'flocculent spiral', 'lenticular galaxy', 'elliptical galaxy', 'dwarf spheroidal', 'irregular galaxy', 'ring galaxy', 'starburst galaxy', 'interacting pair'];
const QSO_TYPES = ['radio-loud quasar', 'optically-bright QSO', 'blazar', 'type-II quasar', 'broad-line AGN'];
function procRng(i) { let a = (i * 2654435761 + 40503) >>> 0; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; }
function procIdentity(i, pType, ra, dec, z, mpc, worldPos, dir) {
  const rnd = procRng(i + 1);
  const isQ = pType === 1;
  const name = PROC_A[Math.floor(rnd() * PROC_A.length)] + PROC_B[Math.floor(rnd() * PROC_B.length)] + PROC_C[Math.floor(rnd() * PROC_C.length)];
  const desig = 'KUC ' + jShort(ra, dec);
  const type = (isQ ? QSO_TYPES : GAL_TYPES)[Math.floor(rnd() * (isQ ? QSO_TYPES : GAL_TYPES).length)];
  const distLy = mpc * 3.2615638e6;
  const distTxt = distLy >= 1e9 ? `${(distLy / 1e9).toFixed(2)} Gly` : `${(distLy / 1e6).toFixed(1)} Mly`;
  const facts = `Imagined ${isQ ? 'active galactic nucleus' : 'galaxy'} — a ${type} charted in the fully-mapped era, ${distTxt} out at redshift z=${z.toFixed(3)}. Catalogue ${desig}. Procedurally generated to complete the known universe (not an observed object).`;
  return {
    kind: 'procedural', pType: isQ ? 'quasar' : 'galaxy', imagined: true,
    name: `${name} · ${desig}`, designation: desig, sub: `imagined ${type}`,
    worldPos, dir, ra, dec, z, comovingMpc: mpc, distLy,
    survey: 'Known-Universe Catalogue · procedural', type, facts,
  };
}
// ---- identity for a galactic-bridge object (modelled, not an observed catalogue) ----
const BRIDGE_KIND = [
  { field: 'Galactic disk', type: 'disk star field', arm: true },
  { field: 'Galactic bar & bulge', type: 'bulge star field' },
  { field: 'Galactic halo', type: 'halo / globular-cluster field' },
  { field: 'Magellanic Clouds', type: 'satellite-galaxy field' },
  { field: 'Local Group', type: 'intragroup field' },
];
const MW_ARMS = ['Norma–Outer Arm', 'Scutum–Centaurus Arm', 'Sagittarius–Carina Arm', 'Perseus Arm'];
function bridgeIdentity(i, kind, ra, dec, distPc, worldPos, dir) {
  const rnd = procRng(i + 7);
  const meta = BRIDGE_KIND[kind] || BRIDGE_KIND[0];
  const distLy = distPc * 3.2615638;
  const distTxt = distPc >= 1e6 ? `${(distPc / 1e6).toFixed(2)} Mpc` : distPc >= 1e3 ? `${(distPc / 1e3).toFixed(1)} kpc` : `${distPc.toFixed(0)} pc`;
  const region = meta.arm ? MW_ARMS[Math.floor(rnd() * MW_ARMS.length)] : meta.field;
  const desig = 'MWB ' + jShort(ra, dec);
  const facts = `Modelled ${meta.type} in the ${meta.field} — part of the galactic bridge that spans the gap between the mapped solar neighbourhood (~1 kpc) and the Local Group. ${distTxt} away. Catalogue ${desig}. A procedural reconstruction of real galactic structure (not individually observed stars).`;
  return {
    kind: 'bridge', bridgeKind: kind, imagined: true,
    name: `${region} · ${desig}`, designation: desig, sub: `bridge · ${meta.type}`,
    worldPos, dir, ra, dec, z: null,
    comovingMpc: distPc / 1e6, distLy, distPc, region, type: meta.type, field: meta.field,
    survey: 'Galactic Bridge · modelled', facts,
  };
}
function makeRingTexture() {
  const s = 64, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - 6, 0, Math.PI * 2); ctx.stroke();
  const t = new THREE.CanvasTexture(cv); t.needsUpdate = true; return t;
}
// Procedural CMB-like mottled shell (a dim representation, not the real Planck map).
// Finer, lower-contrast multi-octave noise in a muted cool/warm palette so it reads
// as a faint boundary rather than a backdrop that competes with the galaxy data.
function makeCMBTexture() {
  const w = 1024, h = 512, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'); const img = ctx.createImageData(w, h);
  const n1 = valueNoise(96, 48, 11), n2 = valueNoise(220, 110, 71);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    const n = n1(u, v) * 0.7 + n2(u, v) * 0.3;
    const t = Math.min(1, Math.max(0, 0.5 + n * 1.1));
    // muted, dim cool→warm; kept dark so the additive galaxies stay legible
    const r = 26 + t * 96, g = 30 + Math.sin(t * Math.PI) * 40, b = 66 + (1 - t) * 70;
    const o = (y * w + x) * 4;
    img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.needsUpdate = true; return tex;
}
function valueNoise(gw, gh, seed0 = 1337) {
  const g = new Float32Array(gw * gh);
  let seed = seed0;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < g.length; i++) g[i] = rnd() * 2 - 1;
  const at = (x, y) => g[((y % gh) + gh) % gh * gw + ((x % gw) + gw) % gw];
  const sm = (t) => t * t * (3 - 2 * t);
  return (u, v) => {
    const x = u * gw, y = v * gh;
    const x0 = Math.floor(x), y0 = Math.floor(y), tx = sm(x - x0), ty = sm(y - y0);
    const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
}
