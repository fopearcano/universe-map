import * as THREE from 'three';
import { comovingMpc, displayRadius, displayRadiusFromMpc, distanceColor, MPC_TO_PC } from '../util/cosmology.js';

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
      show: { twomrs: true, sdssGal: true, sdssQso: true, localGroup: true, starCore: true, cmb: true, procedural: false },
    };
    this.procMode = 'green'; // 'green' | 'match'

    this.pointLayers = []; // { key, kind, count, data, points, worldPos:Float32 }
    this.ringTex = makeRingTexture();

    this._buildStarCore();
    this._buildLayer('twomrs', 'galaxy', 2.4);
    this._buildLayer('sdssGal', 'galaxy', 2.1);
    this._buildLayer('sdssQso', 'quasar', 2.7);
    this._buildProcedural((extras.structures || []).filter((s) => s.type === 'void'));
    this._buildLocalGroup();
    this._buildRings();
    this._buildCMB();
  }

  // ---- procedural fill: a synthetic galaxy field that fills survey-incompleteness
  // gaps (the Zone of Avoidance behind the Milky Way + unsurveyed sky), thinned
  // where the real catalogues are already dense and kept OUT of catalogued voids.
  // Clearly synthetic — tinted green by default. Not counted as real objects and
  // not selectable. ----
  _buildProcedural(voids = []) {
    const N = 40000;
    let seed = 20240711;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

    // coarse angular coverage of the REAL catalogues, so the fill flows into gaps
    const cov = this._coverageGrid();
    // galactic north pole in equatorial cartesian (for the Zone of Avoidance)
    const gpRa = 192.859508 * Math.PI / 180, gpDec = 27.128336 * Math.PI / 180;
    const nGP = [Math.cos(gpDec) * Math.cos(gpRa), Math.cos(gpDec) * Math.sin(gpRa), Math.sin(gpDec)];
    // a few random 3-D waves → smooth web-like clumping (filaments, not static)
    const waves = [];
    for (let i = 0; i < 6; i++) waves.push({ kx: (rnd() - 0.5) * 2.2, ky: (rnd() - 0.5) * 2.2, kz: (rnd() - 0.5) * 2.2, ph: rnd() * 6.2832, a: 0.5 + rnd() * 0.6 });
    const web = (x, y, z) => { let s = 0, w = 0; for (const q of waves) { s += q.a * Math.sin(q.kx * x + q.ky * y + q.kz * z + q.ph); w += q.a; } return 0.5 + 0.5 * s / w; };
    // void exclusion zones (angular + radial band around each catalogued void)
    const voidZ = voids.map((v) => ({ dir: v.dir, r: v.displayR }));

    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), zs = new Float32Array(N), sz = new Float32Array(N);
    let k = 0, tries = 0;
    const maxTries = N * 12;
    while (k < N && tries < maxTries) {
      tries++;
      const u = rnd() * 2 - 1, ph = rnd() * Math.PI * 2, s = Math.sqrt(Math.max(0, 1 - u * u));
      const dir = [s * Math.cos(ph), s * Math.sin(ph), u];
      const z = 0.012 + Math.pow(rnd(), 1.5) * 1.35;
      const mpc = comovingMpc(z), r = displayRadiusFromMpc(mpc, this.decadeUnit);
      // 1) thin where the real surveys are dense (fill the gaps)
      const c = cov.lookup(dir);
      const covFactor = c > 45 ? 0.12 : c > 12 ? 0.4 : c > 2 ? 0.8 : 1.0;
      // 2) boost the Zone of Avoidance (|galactic b| < ~12°, blocked by the disc)
      const sinb = dir[0] * nGP[0] + dir[1] * nGP[1] + dir[2] * nGP[2];
      const zoa = Math.abs(sinb) < 0.21 ? 1.15 : 0.7;
      // 3) web clumping
      const n = web(dir[0] * r * 0.4, dir[1] * r * 0.4, dir[2] * r * 0.4);
      const p = covFactor * zoa * smoothstep(0.42, 0.8, n);
      if (rnd() > p) continue;
      // 4) never fill inside a catalogued void
      let inV = false;
      for (const v of voidZ) {
        const dot = dir[0] * v.dir[0] + dir[1] * v.dir[1] + dir[2] * v.dir[2];
        if (dot > 0.945 && Math.abs(r - v.r) < 2.2) { inV = true; break; }
      }
      if (inV) continue;

      pos[k * 3] = dir[0] * r; pos[k * 3 + 1] = dir[1] * r; pos[k * 3 + 2] = dir[2] * r;
      const [cr, cg, cb] = distanceColor(r / this.cmbR);
      col[k * 3] = cr; col[k * 3 + 1] = cg; col[k * 3 + 2] = cb;
      zs[k] = z; sz[k] = 0.85;
      k++;
    }
    this._procCount = k;
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

  // Low-res angular histogram of where the real galaxy catalogues actually have data.
  _coverageGrid() {
    const NB = 72, MB = 36;
    const grid = new Uint16Array(NB * MB);
    for (const key of ['twomrs', 'sdssGal']) {
      const L = this.data.layers[key]; if (!L) continue;
      const d = L.data;
      for (let i = 0; i < L.count; i++) {
        const x = d[i * 4], y = d[i * 4 + 1], z = d[i * 4 + 2];
        const lon = (Math.atan2(y, x) + Math.PI) / (2 * Math.PI);
        const lat = Math.asin(Math.max(-1, Math.min(1, z))) / Math.PI + 0.5;
        const bi = Math.min(NB - 1, Math.floor(lon * NB)), bj = Math.min(MB - 1, Math.floor(lat * MB));
        if (grid[bj * NB + bi] < 65535) grid[bj * NB + bi]++;
      }
    }
    return {
      lookup: (dir) => {
        const lon = (Math.atan2(dir[1], dir[0]) + Math.PI) / (2 * Math.PI);
        const lat = Math.asin(Math.max(-1, Math.min(1, dir[2]))) / Math.PI + 0.5;
        const bi = Math.min(NB - 1, Math.floor(lon * NB)), bj = Math.min(MB - 1, Math.floor(lat * MB));
        return grid[bj * NB + bi];
      },
    };
  }

  // Instant green ↔ distance-colour toggle for the procedural fill.
  setProceduralColor(mode) {
    this.procMode = mode;
    if (this.procMat) this.procMat.uniforms.uProc.value = mode === 'green' ? 1 : 0;
  }
  proceduralCount() { return this._procCount || 0; }

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
    this._visibleCount = n;
  }

  visibleCount() { return this._visibleCount ?? this.data.totalCount?.() ?? 0; }

  // ---- picking (nearest ray across galaxy/quasar/local-group layers) ----
  pick(raycaster) {
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
    return best;
  }

  // ---- describe a picked object for the info panel ----
  describe(hit) {
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
