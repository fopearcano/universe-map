import * as THREE from 'three';
import { comovingMpc, displayRadius, displayRadiusFromMpc, distanceColor, MPC_TO_PC } from '../util/cosmology.js';

// The cosmological world: galaxies, quasars, the Local Group, our galaxy's stars,
// scale rings and the CMB shell, all placed on a logarithmic radial scale so the
// whole observable universe (~93 Gly across) fits one navigable scene centred on
// the Sun. Objects keep their true sky direction; only the radius is compressed.
export class CosmosWorld {
  constructor(scene, cosmosData, starCatalog) {
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
      show: { twomrs: true, sdssGal: true, sdssQso: true, localGroup: true, starCore: true, cmb: true },
    };

    this.pointLayers = []; // { key, kind, count, data, points, worldPos:Float32 }
    this.ringTex = makeRingTexture();

    this._buildStarCore();
    this._buildLayer('twomrs', 'galaxy', 2.4);
    this._buildLayer('sdssGal', 'galaxy', 2.1);
    this._buildLayer('sdssQso', 'quasar', 2.7);
    this._buildLocalGroup();
    this._buildRings();
    this._buildCMB();
  }

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
    for (let i = 0; i < N; i++) {
      const dx = src[i * 4], dy = src[i * 4 + 1], dz = src[i * 4 + 2], z = src[i * 4 + 3];
      const mpc = comovingMpc(z);
      const r = displayRadiusFromMpc(mpc, this.decadeUnit);
      pos[i * 3] = dx * r; pos[i * 3 + 1] = dy * r; pos[i * 3 + 2] = dz * r;
      const [cr, cg, cb] = distanceColor(r / this.cmbR);
      col[i * 3] = cr; col[i * 3 + 1] = cg; col[i * 3 + 2] = cb;
      zs[i] = z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aZ', new THREE.BufferAttribute(zs, 1));
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
      },
      vertexShader: /* glsl */`
        attribute vec3 aColor; attribute float aZ;
        uniform float uSize, uSizeScale, uPixelRatio, uZMax;
        varying vec3 vColor; varying float vHide;
        void main(){
          vColor = aColor;
          vHide = aZ > uZMax ? 1.0 : 0.0;
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = (vHide > 0.5 ? 0.0 : uSize * uSizeScale * uPixelRatio);
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
