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

  // ---- procedural fill: a synthetic, fully-catalogued universe.
  // A "known universe" for storytelling — every direction is brought UP TO the
  // peak surface density of the best-surveyed real regions, so the sky reads as
  // completely mapped. Catalogued voids stay empty. Each object is real enough to
  // use: it is placed with a true distance (from a sampled redshift), is
  // selectable, carries a generated (imagined) identity, and can be added to a
  // route exactly like a real galaxy. Clearly imagined — green by default. ----
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

    // void exclusion zones (angular + radial band around each catalogued void)
    const voidZ = voids.map((v) => ({ dir: v.dir, r: v.displayR }));
    const inVoid = (dir, r) => {
      for (const v of voidZ) {
        const dot = dir[0] * v.dir[0] + dir[1] * v.dir[1] + dir[2] * v.dir[2];
        if (dot > 0.945 && Math.abs(r - v.r) < 2.2) return true;
      }
      return false;
    };

    // 3) place points cell by cell
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
          // uniform direction within this lon/lat cell
          const lon = ((bi + rnd()) / NB) * 2 * Math.PI - Math.PI;
          const v = ((bj + rnd()) / MB) * 2 - 1;                  // uniform in sin(lat)
          const dec = Math.asin(v), cd = Math.cos(dec);
          const dir = [cd * Math.cos(lon), cd * Math.sin(lon), Math.sin(dec)];
          const z = sampleZ();
          const r = displayRadiusFromMpc(comovingMpc(z), this.decadeUnit);
          if (inVoid(dir, r)) continue;
          pos[k * 3] = dir[0] * r; pos[k * 3 + 1] = dir[1] * r; pos[k * 3 + 2] = dir[2] * r;
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
  pick(raycaster, { includeProcedural = true } = {}) {
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
