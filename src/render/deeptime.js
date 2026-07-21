import * as THREE from 'three';
import { distanceColor, fmtCosmoDist } from '../util/cosmology.js';
import { structureCloud, morphFromType } from './morphology.js';
import { GalaxyInterior } from './galaxyInterior.js';

// ────────────────────────────────────────────────────────────────────────────
// The DEEPTIME scale — the far-future (~50 Gyr) universe, on the SAME
// logarithmic-radial map + Planck-ΛCDM rules as COSMOS, but procedurally
// re-grown and made richer than Cosmos: MORE EXTENDED (accelerating expansion —
// R = cosmos.cmbR × extension) and MORE STRUCTURED. It is DATA-DRIVEN: a built
// dataset (public/data/deeptime.json) supplies the cosmic web (hubs, filaments,
// walls), 120 navigable anchor galaxies with far-future metadata, and a full
// catalogue of QTR deep-time cosmic OBJECTS, hazard/frontier REGIONS and EVENTS
// — each cross-linked to its codex entry. Only the dense ~140k-galaxy background
// field is procedural at runtime. Still a MATRIOSKA scale: enter any galaxy to
// fly inside its own (now richer) star field.
// ────────────────────────────────────────────────────────────────────────────

const GTYPES = ['spiral', 'elliptical', 'lenticular', 'irregular', 'dwarf'];
const FIELD = 150000;
const TINT = new THREE.Color(0.62, 0.5, 0.86);

// per-class rendering: [texture, colour, scale, blend('add'|'norm'), alpha]
const OBJ_STYLE = {
  'seam-well':        ['well',  [1.0, 0.72, 0.32], 1.5,  'add', 1],
  'kindled-well':     ['well',  [0.55, 0.95, 1.0], 1.7,  'add', 1],
  'seam-pearl':       ['glow',  [0.82, 0.9, 1.0],  0.8,  'add', 1],
  'information-reef': ['reef',  [0.4, 0.96, 0.86], 1.25, 'add', 1],
  'beacon-core':      ['glow',  [0.7, 0.86, 1.0],  1.0,  'add', 1],
  'formless-mouth':   ['ring',  [0.55, 0.38, 0.78], 2.0, 'add', 0.7],
  'law-shard':        ['shard', [1.0, 0.3, 0.36],  1.35, 'add', 1],
  'amplitude-twin':   ['glow',  [0.95, 0.52, 1.0], 0.95, 'add', 1],
};
const OBJ_LABEL = {
  'seam-well': 'natural seam-well', 'kindled-well': 'kindled seam-well (Φ₄)', 'seam-pearl': 'seam-pearl',
  'information-reef': 'information reef', 'beacon-core': 'beacon core (pulsar)', 'formless-mouth': 'Formless mouth',
  'law-shard': 'law-shard', 'amplitude-twin': 'amplitude twin',
};
const REG_STYLE = {
  'dead-sea':     [[0.42, 0.54, 0.68], 0.13, 'the Dead-Sea · becalmed'],
  'squall':       [[0.62, 0.42, 0.82], 0.15, 'squall · violent vacuum'],
  'refusal-zone': [[0.92, 0.32, 0.32], 0.17, 'refusal zone · the Κ frontier'],
};
const EVT_STYLE = {
  'crossing':            [[0.5, 0.9, 1.0],  0.8, 'Idrenes-bridge crossing'],
  'seam-scar':           [[0.72, 0.52, 0.34], 0.7, 'seam-scar · a healed wake'],
  'failed-condensation': [[0.85, 0.85, 0.95], 0.85, 'failed condensation'],
  'aeonic-edge':         [[1.0, 0.85, 0.42], 1.0, 'aeonic edge · conformal crossover'],
};

// deterministic seeded RNG (mulberry32) for the runtime field + interiors
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

export class Deeptime {
  constructor(scene, cosmosData, data, { seed = 0xDEE9714E } = {}) {
    this.scene = scene;
    this.decadeUnit = cosmosData.meta.decadeUnit;
    this.cmbR = cosmosData.meta.cmb.displayR;
    this.data = data || null;
    this.extension = data?.meta?.extension || 1.62;
    this.R = this.cmbR * this.extension;           // extended past the cosmos horizon
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.seed = seed;
    this._tex = {};
    this._style = null;
    this._t = 0;
    this.interior = null;
    this.enteredGalaxy = null;

    // hubs + curved filaments as world Vector3s (dataset positions normalised to R)
    this.hubs = (data?.hubs || []).map((h) => V3(h.pos).multiplyScalar(this.R));
    this.filaments = data?.filaments || [];
    // one smooth Catmull-Rom curve per filament (drawn + sampled for the field)
    this._filCurves = this.filaments.map((f) => {
      const pts = (f.pts || []).map((p) => V3(p).multiplyScalar(this.R));
      return pts.length >= 2 ? new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5) : null;
    });

    this._buildWeb();
    this._buildField();
    this._buildAnchors();
    this._buildObjects();
    this._buildRegions();
    this._buildEvents();
    this._buildHorizon();
    this._buildRings();
  }

  _distPc(displayR) { return Math.pow(10, displayR / this.decadeUnit); }
  _truePos(worldPos) { const r = worldPos.length(); return r < 1e-9 ? new THREE.Vector3() : worldPos.clone().normalize().multiplyScalar(this._distPc(r)); }
  _fieldSeed(i) { return (Math.imul(this.seed ^ 0xF1E1D5, i + 1) ^ (i * 2654435761)) >>> 0; }

  // ── cosmic web — smooth curved filaments (Catmull-Rom), walls fainter ───────
  _buildweb_segs(curve, kind) {
    const n = kind === 'wall' ? 14 : 22;                 // tessellation of each filament
    const pts = curve.getPoints(n), out = [];
    for (let s = 0; s < pts.length - 1; s++) { const a = pts[s], b = pts[s + 1]; out.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    return out;
  }
  _buildWeb() {
    const pos = [];
    this._filCurves.forEach((curve, idx) => { if (curve) pos.push(...this._buildweb_segs(curve, this.filaments[idx].kind)); });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    this.web = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x5a4a8a, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.group.add(this.web);
  }

  _gauss(r, s) { return (r() + r() + r() - 1.5) * s; }
  _buildField() {
    const r = rng(this.seed ^ 0x1234abcd);
    const pos = new Float32Array(FIELD * 3), col = new Float32Array(FIELD * 3), sz = new Float32Array(FIELD);
    // favour inner filaments (denser web toward the core), skip any without a curve
    const fW = this._filCurves.map((cv) => cv ? Math.exp(-cv.getPoint(0.5).length() / (this.R * 0.42)) : 0);
    const wSum = fW.reduce((a, b) => a + b, 0) || 1;
    const tmp = new THREE.Vector3(), c = new THREE.Color();
    let k = 0, guard = 0;
    while (k < FIELD && guard++ < FIELD * 6) {
      let p;
      if (r() < 0.92 && wSum > 0) {
        let x = r() * wSum, fi = 0; while (fi < fW.length - 1 && (x -= fW[fi]) > 0) fi++;
        const cv = this._filCurves[fi]; if (!cv) continue;
        // sample ALONG the curved filament, denser near the nodes; thin thread
        let t = r(); t = t < 0.5 ? 0.5 * Math.pow(2 * t, 1.4) : 1 - 0.5 * Math.pow(2 - 2 * t, 1.4);
        cv.getPoint(t, tmp);
        const thick = this.R * (0.005 + 0.028 * Math.pow(r(), 2));
        p = tmp.clone().add(new THREE.Vector3(this._gauss(r, thick), this._gauss(r, thick), this._gauss(r, thick)));
      } else {
        const rad = this.R * Math.cbrt(r()), u = r(), v = r(), th = Math.acos(2 * u - 1), ph = 2 * Math.PI * v;
        p = new THREE.Vector3(rad * Math.sin(th) * Math.cos(ph), rad * Math.sin(th) * Math.sin(ph), rad * Math.cos(th));
      }
      const rr = p.length(); if (rr > this.R) continue;
      if (r() > Math.max(0.12, 1 - Math.pow(rr / this.R, 1.4))) continue;
      pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
      const dc = distanceColor(rr / this.cmbR); c.setRGB(dc[0], dc[1], dc[2]).lerp(TINT, 0.5).multiplyScalar(0.72);
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; sz[k] = 0.6 + r() * 1.1; k++;
    }
    this._fieldCount = k;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, k * 3), 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col.subarray(0, k * 3), 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sz.subarray(0, k), 1));
    this.fieldWorld = pos.subarray(0, k * 3);
    this.fieldPoints = new THREE.Points(geo, this._pointMat(0.5, { tex: 'glow', additive: false, alpha: 0.9 }));
    this.fieldPoints.frustumCulled = false;
    this.group.add(this.fieldPoints);
  }

  _buildAnchors() {
    this.anchors = (this.data?.anchors || []).map((a) => ({ ...a, pos: V3(a.pos).multiplyScalar(this.R) }));
    const n = this.anchors.length;
    const gpos = new Float32Array(n * 3), gcol = new Float32Array(n * 3), gsz = new Float32Array(n);
    const c = new THREE.Color();
    this.anchors.forEach((g, k) => {
      gpos[k * 3] = g.pos.x; gpos[k * 3 + 1] = g.pos.y; gpos[k * 3 + 2] = g.pos.z;
      const dc = distanceColor(g.pos.length() / this.cmbR); c.setRGB(dc[0], dc[1], dc[2]).lerp(new THREE.Color(1, 1, 1), g.home ? 0.5 : 0.15);
      gcol[k * 3] = c.r; gcol[k * 3 + 1] = c.g; gcol[k * 3 + 2] = c.b;
      gsz[k] = (g.home ? 3.6 : 1.4) + Math.sqrt(g.diameterKpc) * 0.06;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(gpos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(gcol, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(gsz, 1));
    this.anchorWorld = gpos;
    this.anchorPoints = new THREE.Points(geo, this._pointMat(1.0, { tex: 'glow' }));
    this.anchorPoints.frustumCulled = false;
    this.group.add(this.anchorPoints);
  }

  // ── the deep-time object catalogue — one Points layer per class ────────────
  _buildObjects() {
    this.objectLayers = {};      // cls → { points, world:Float32, recs:[obj], pulse }
    this._twinLines = null;
    const byCls = {};
    for (const o of (this.data?.objects || [])) (byCls[o.cls] ||= []).push(o);
    const twinLinePts = [];
    for (const [cls, recs] of Object.entries(byCls)) {
      const [tex, rgb, scale, blend, alpha] = OBJ_STYLE[cls] || ['glow', [1, 1, 1], 1, 'add', 1];
      const n = recs.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), sz = new Float32Array(n);
      recs.forEach((o, k) => {
        const p = V3(o.pos).multiplyScalar(this.R);
        o._w = p;
        pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
        col[k * 3] = rgb[0]; col[k * 3 + 1] = rgb[1]; col[k * 3 + 2] = rgb[2];
        sz[k] = 4 + o.size * 3.2;
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
      const points = new THREE.Points(geo, this._pointMat(scale, { tex, additive: blend === 'add', alpha }));
      points.frustumCulled = false;
      this.group.add(points);
      this.objectLayers[cls] = { points, world: pos, recs, pulse: cls === 'beacon-core' };
    }
    // faint links between entangled amplitude twins
    const tw = byCls['amplitude-twin'] || []; const pairs = {};
    for (const o of tw) (pairs[o.twin] ||= []).push(o._w);
    for (const arr of Object.values(pairs)) if (arr.length === 2) twinLinePts.push(arr[0].x, arr[0].y, arr[0].z, arr[1].x, arr[1].y, arr[1].z);
    if (twinLinePts.length) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(twinLinePts), 3));
      this._twinLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xd07aff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.group.add(this._twinLines);
    }
  }

  // ── hazard/frontier regions — large soft translucent volumes ───────────────
  _buildRegions() {
    this.regions = (this.data?.regions || []).map((r) => ({ ...r, _w: V3(r.pos).multiplyScalar(this.R) }));
    const n = this.regions.length; if (!n) { this.regionPoints = null; return; }
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), sz = new Float32Array(n);
    this.regions.forEach((rg, k) => {
      pos[k * 3] = rg._w.x; pos[k * 3 + 1] = rg._w.y; pos[k * 3 + 2] = rg._w.z;
      const [rgb, alpha] = REG_STYLE[rg.cls] || [[0.5, 0.5, 0.6], 0.12];
      col[k * 3] = rgb[0] * alpha * 6; col[k * 3 + 1] = rgb[1] * alpha * 6; col[k * 3 + 2] = rgb[2] * alpha * 6;
      sz[k] = rg.radius * this.R * 2.4;   // large soft volume
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    this.regionWorld = pos;
    // world-space sized soft blobs (attenuate with distance so they read as volumes)
    this.regionPoints = new THREE.Points(geo, this._pointMat(1, { tex: 'cloud', additive: true, alpha: 0.5, worldScale: true }));
    this.regionPoints.frustumCulled = false;
    this.group.add(this.regionPoints);
  }

  // ── event markers ──────────────────────────────────────────────────────────
  _buildEvents() {
    this.events = (this.data?.events || []).map((e) => ({ ...e, _w: V3(e.pos).multiplyScalar(this.R) }));
    const n = this.events.length; if (!n) { this.eventPoints = null; return; }
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), sz = new Float32Array(n);
    this.events.forEach((e, k) => {
      pos[k * 3] = e._w.x; pos[k * 3 + 1] = e._w.y; pos[k * 3 + 2] = e._w.z;
      const [rgb, scale] = EVT_STYLE[e.cls] || [[0.7, 0.8, 1.0], 0.7];
      col[k * 3] = rgb[0]; col[k * 3 + 1] = rgb[1]; col[k * 3 + 2] = rgb[2];
      sz[k] = 3 + scale * 3;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    this.eventWorld = pos;
    this.eventPoints = new THREE.Points(geo, this._pointMat(0.8, { tex: 'spark' }));
    this.eventPoints.frustumCulled = false;
    this.group.add(this.eventPoints);
  }

  // faint shell at the extended horizon (the aeonic edge)
  _buildHorizon() {
    const geo = new THREE.IcosahedronGeometry(this.R * 0.995, 3);
    const wire = new THREE.WireframeGeometry(geo);
    this.horizon = new THREE.LineSegments(wire, new THREE.LineBasicMaterial({ color: 0x4a3f6a, transparent: true, opacity: 0.05, depthWrite: false }));
    this.group.add(this.horizon);
  }

  _buildRings() {
    const rings = new THREE.Group();
    const mat = new THREE.LineBasicMaterial({ color: 0x4a3f6a, transparent: true, opacity: 0.28, depthWrite: false });
    for (let d = 1; d <= 6; d++) {
      const rad = (d / 6) * this.R, pts = [];
      for (let s = 0; s <= 96; s++) { const a = (s / 96) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * rad, Math.sin(a) * rad, 0)); }
      rings.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    }
    this.rings = rings; this.group.add(rings);
  }

  // ── matrioska navigation ────────────────────────────────────────────────────
  enterGalaxy(desc, { count = 60000 } = {}) {
    if (!desc) return null;
    if (this.interior) this.exitGalaxy();
    let morph = morphFromType(desc.type); if (morph === 'globular' || morph === 'open') morph = 'spiral';
    const R = 30;
    const cloud = structureCloud(morph, R, desc.seed % 100000, { count });
    cloud.count = cloud.count ?? cloud.positions.length / 3;
    const pcPerUnit = (desc.diameterKpc * 500) / R;
    this.interior = new GalaxyInterior(cloud, { pcPerUnit, name: desc.name, imageDerived: false });
    this.enteredGalaxy = desc;
    this._setUniverseVisible(false);
    this.group.add(this.interior.group);
    return this.interior;
  }
  exitGalaxy() {
    if (this.interior) { this.group.remove(this.interior.group); this.interior.dispose(); this.interior = null; }
    this.enteredGalaxy = null;
    this._setUniverseVisible(true);
  }
  _setUniverseVisible(v) {
    const layers = [this.web, this.fieldPoints, this.anchorPoints, this.rings, this.horizon, this._twinLines, this.regionPoints, this.eventPoints, ...Object.values(this.objectLayers || {}).map((l) => l.points)];
    for (const o of layers) if (o) o.visible = v;
  }

  anchorDesc(i) { const g = this.anchors[i]; return g && { name: g.name, tag: g.tag, type: g.type, seed: g.seed, diameterKpc: g.diameterKpc, pos: g.pos.clone(), i, anchor: true, home: g.home, era: g.era, species: g.species, driveClass: g.driveClass, massMsun: g.massMsun }; }
  fieldDesc(i) {
    const r = rng(this._fieldSeed(i)); const a = SYL_A[Math.floor(r() * SYL_A.length)], b = SYL_B[Math.floor(r() * SYL_B.length)];
    const name = `${a} ${b.charAt(0).toUpperCase() + b.slice(1)}`, type = GTYPES[Math.floor(r() * GTYPES.length)], diameterKpc = 15 + Math.pow(r(), 1.5) * 80;
    const pos = new THREE.Vector3(this.fieldWorld[i * 3], this.fieldWorld[i * 3 + 1], this.fieldWorld[i * 3 + 2]);
    return { name, tag: 'FG-' + (i % 99999), type, seed: this._fieldSeed(i), diameterKpc, pos, i, anchor: false };
  }

  // ── camera views ─────────────────────────────────────────────────────────────
  defaultView() { const d = this.R * 1.5; return { pos: new THREE.Vector3(d * 0.8, d * 0.5, d), target: new THREE.Vector3(0, 0, 0) }; }
  galaxyView(desc) {
    const p = desc.pos || this.anchors[desc.i]?.pos || new THREE.Vector3();
    const off = Math.max(this.R * 0.06, 14) + (desc.diameterKpc || 40) * 0.02;
    const dir = p.length() < 1e-3 ? new THREE.Vector3(0.6, 0.4, 0.8) : p.clone().normalize().multiplyScalar(-0.8).add(new THREE.Vector3(0, 0.35, 0.2));
    return { pos: p.clone().addScaledVector(dir.normalize(), off + 20), target: p.clone() };
  }
  objectView(p) { const off = Math.max(this.R * 0.04, 10); const dir = p.length() < 1e-3 ? new THREE.Vector3(0.6, 0.4, 0.8) : p.clone().normalize().multiplyScalar(-0.8).add(new THREE.Vector3(0, 0.3, 0.2)); return { pos: p.clone().addScaledVector(dir.normalize(), off), target: p.clone() }; }
  interiorView() { const R = this.interior ? this.interior.extent() : 30; return { pos: new THREE.Vector3(R * 1.35, R * 0.85, R * 1.6), target: new THREE.Vector3(0, 0, 0) }; }

  // ── picking ─────────────────────────────────────────────────────────────────
  pick(raycaster, camera) {
    if (this.interior) { const i = this.interior.pick(raycaster, camera); return i < 0 ? null : { kind: 'dt-star', i }; }
    const ray = raycaster.ray, o = ray.origin, dir = ray.direction, p = new THREE.Vector3();
    const scan = (world, count, tolC, tolA) => { let best = -1, bs = Infinity; for (let k = 0; k < count; k++) { p.set(world[k * 3], world[k * 3 + 1], world[k * 3 + 2]); const t = p.clone().sub(o).dot(dir); if (t < 0) continue; const d = o.clone().addScaledVector(dir, t).distanceTo(p); const tol = tolC * t + tolA; if (d < tol && d < bs) { bs = d; best = k; } } return { best, bs }; };
    // anchors → objects (all classes) → events → field
    const A = scan(this.anchorWorld, this.anchorWorld.length / 3, 0.03, this.R * 0.02);
    let bestKind = A.best >= 0 ? { kind: 'dt-galaxy', i: A.best, d: A.bs } : null;
    for (const [cls, layer] of Object.entries(this.objectLayers || {})) { const s = scan(layer.world, layer.world.length / 3, 0.028, this.R * 0.014); if (s.best >= 0 && (!bestKind || s.bs < bestKind.d)) bestKind = { kind: 'dt-object', cls, i: s.best, d: s.bs }; }
    if (this.eventWorld) { const s = scan(this.eventWorld, this.eventWorld.length / 3, 0.02, this.R * 0.01); if (s.best >= 0 && (!bestKind || s.bs < bestKind.d)) bestKind = { kind: 'dt-event', i: s.best, d: s.bs }; }
    if (bestKind) { delete bestKind.d; return bestKind; }
    const F = scan(this.fieldWorld, this._fieldCount, 0.012, this.R * 0.004);
    return F.best >= 0 ? { kind: 'dt-field', i: F.best } : null;
  }

  // ── describe ────────────────────────────────────────────────────────────────
  describe(hit) {
    if (!hit) return null;
    if (hit.kind === 'dt-star') {
      const i = hit.i, wp = this.interior.starWorld(i), distPc = this.interior.starDistPc(i);
      const name = `${this.interior.name.replace(/\s*\(.*\)/, '')}·S${(i % 99999).toString().padStart(5, '0')}`;
      return { label: name, kind: 'dt-star', sub: `star · ${this.enteredGalaxy?.name || 'galaxy'}`, worldPos: wp.clone(), truePos: wp.clone().multiplyScalar(this.interior.pcPerUnit), info: [['galaxy', this.enteredGalaxy?.name || '—'], ['from core', `${(distPc / 1000).toFixed(2)} kpc`], ['scale', 'Deep-Time · interior']] };
    }
    if (hit.kind === 'dt-object') {
      const rec = this.objectLayers[hit.cls].recs[hit.i], wp = rec._w;
      const distPc = this._distPc(wp.length());
      return { label: rec.name, kind: 'dt-object', sub: OBJ_LABEL[hit.cls] || hit.cls, worldPos: wp.clone(), truePos: this._truePos(wp),
        info: [['class', OBJ_LABEL[hit.cls] || hit.cls], ['distance', fmtCosmoDist(distPc / 1e6)], ['scale', 'Deep-Time · ~50 Gyr']], qtr: rec.qtr, note: rec.note };
    }
    if (hit.kind === 'dt-event') {
      const rec = this.events[hit.i], wp = rec._w, [, , sub] = EVT_STYLE[rec.cls] || [];
      return { label: rec.name, kind: 'dt-event', sub: sub || rec.cls, worldPos: wp.clone(), truePos: this._truePos(wp),
        info: [['event', sub || rec.cls], ['distance', fmtCosmoDist(this._distPc(wp.length()) / 1e6)], ['scale', 'Deep-Time · ~50 Gyr']], qtr: rec.qtr, note: rec.note };
    }
    // galaxy (anchor or field)
    const desc = hit.kind === 'dt-galaxy' ? this.anchorDesc(hit.i) : this.fieldDesc(hit.i);
    const displayR = desc.pos.length(), distPc = this._distPc(displayR);
    const truePos = displayR < 1e-9 ? new THREE.Vector3() : desc.pos.clone().normalize().multiplyScalar(distPc);
    const kindLabel = desc.home ? 'home supergalaxy' : (desc.anchor ? 'anchor galaxy · navigable' : 'galaxy · navigable');
    const rows = [['type', desc.type], ['distance', fmtCosmoDist(distPc / 1e6)], ['diameter', `${Math.round(desc.diameterKpc)} kpc`]];
    if (desc.anchor && !desc.home) rows.splice(1, 0, ['catalogue', desc.tag]);
    if (desc.era) rows.push(['era', `${desc.era} · Φ`], ['inhabitants', desc.species || '—'], ['reach drive', `Class ${desc.driveClass}`]);
    rows.push(['scale', 'Deep-Time · ~50 Gyr']);
    return { label: desc.name, kind: 'dt-galaxy', sub: kindLabel, worldPos: desc.pos.clone(), truePos, info: rows, dtDesc: desc };
  }

  labelItems() {
    if (this.interior) return [];
    const out = [...this.anchors].sort((a, b) => (b.home - a.home) || (a.pos.length() - b.pos.length())).slice(0, 26).map((g) => ({ pos: g.pos, text: g.name, cls: g.home ? 'lbl-ref' : 'lbl-star', prio: g.home ? 999 : g.diameterKpc }));
    // a few of the most striking objects, labelled faintly
    for (const cls of ['seam-well', 'formless-mouth', 'kindled-well']) for (const rec of (this.objectLayers?.[cls]?.recs || []).slice(0, 4)) out.push({ pos: rec._w, text: rec.name, cls: 'lbl-ref', prio: 5 });
    return out;
  }
  galaxyList() { return this.anchors.map((g) => ({ i: g.i, name: g.name, tag: g.tag, type: g.type, home: g.home })); }

  // ── LOD / frame update ────────────────────────────────────────────────────
  update(camera) {
    if (!this.group.visible || this.interior) return;
    this._t += 0.016;
    const camDist = camera.position.length();
    this.web.material.opacity = Math.max(0.08, Math.min(0.28, camDist / (this.R * 6)));
    // pulse the beacon cores
    const bl = this.objectLayers?.['beacon-core'];
    if (bl) bl.points.material.uniforms.uPulse.value = 0.75 + 0.4 * Math.sin(this._t * 2.2);
  }

  setVisible(v) { this.group.visible = v; }

  // ── materials / textures ────────────────────────────────────────────────────
  _pointMat(scale, { tex = 'glow', additive = true, alpha = 1, worldScale = false } = {}) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: this._texture(tex) }, uScale: { value: scale }, uDim: { value: 0 }, uAlpha: { value: alpha }, uPulse: { value: 1 },
        uSizeUser: { value: 1 }, uGain: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) }, uTintAmt: { value: 0 },
        uWorld: { value: worldScale ? 1 : 0 }, uPix: { value: Math.min(window.devicePixelRatio, 2) }, uVpH: { value: window.innerHeight },
        uProj: { value: 1 },
      },
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `
        attribute vec3 aColor; attribute float aSize; varying vec3 vC;
        uniform float uScale, uSizeUser, uTintAmt, uPulse, uWorld, uPix, uVpH; uniform vec3 uTint;
        void main(){ vC=mix(aColor, uTint, uTintAmt); vec4 mv=modelViewMatrix*vec4(position,1.0);
          float ps = uWorld > 0.5
            ? aSize * uScale * uSizeUser * uPulse * (uVpH / max(-mv.z,1.0)) * 0.5   // world-sized (regions)
            : aSize * uScale * uSizeUser * uPulse * (300.0/max(-mv.z,1.0));          // screen-ish (points)
          gl_PointSize = ps; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `
        varying vec3 vC; uniform sampler2D uTex; uniform float uDim, uGain, uAlpha;
        void main(){ vec4 t=texture2D(uTex, gl_PointCoord); gl_FragColor=vec4(vC*uGain, t.a*uAlpha*(1.0-0.72*uDim)); }`,
    });
  }
  setStyle(st = {}) {
    this._style = { ...(this._style || {}), ...st };
    const targets = [this.fieldPoints, this.anchorPoints, this.interior?.points, ...Object.values(this.objectLayers || {}).map((l) => l.points)];
    for (const p of targets) { const u = p?.material?.uniforms; if (!u) continue;
      if (st.size != null && u.uSizeUser) u.uSizeUser.value = st.size;
      if (st.gain != null && u.uGain) u.uGain.value = st.gain;
      if (Array.isArray(st.tint) && u.uTint) u.uTint.value.setRGB(st.tint[0], st.tint[1], st.tint[2]);
      if (st.tintAmt != null && u.uTintAmt) u.uTintAmt.value = st.tintAmt;
    }
    if (st.size != null && this.interior) this.interior.setSizeScale(st.size);
  }

  // canvas textures per shape, cached
  _texture(kind) {
    if (this._tex[kind]) return this._tex[kind];
    const s = 64, cv = document.createElement('canvas'); cv.width = cv.height = s; const ctx = cv.getContext('2d'); const c = s / 2;
    if (kind === 'glow' || kind === 'cloud') {
      const g = ctx.createRadialGradient(c, c, 0, c, c, c);
      if (kind === 'cloud') { g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.5, 'rgba(255,255,255,0.16)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
      else { g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.65)'); g.addColorStop(0.7, 'rgba(255,255,255,0.15)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    } else if (kind === 'well') {                     // dark core + bright accretion ring
      const g = ctx.createRadialGradient(c, c, 0, c, c, c);
      g.addColorStop(0, 'rgba(255,255,255,0.05)'); g.addColorStop(0.28, 'rgba(255,255,255,0.05)');
      g.addColorStop(0.44, 'rgba(255,255,255,1)'); g.addColorStop(0.6, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    } else if (kind === 'ring') {                     // thin bright ring (a mouth)
      ctx.strokeStyle = 'rgba(255,255,255,1)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(c, c, c * 0.62, 0, Math.PI * 2); ctx.stroke();
      const g = ctx.createRadialGradient(c, c, c * 0.5, c, c, c * 0.78); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    } else if (kind === 'shard') {                    // 4-point angular star (law-shard)
      ctx.translate(c, c); ctx.fillStyle = 'rgba(255,255,255,1)';
      for (let a = 0; a < 4; a++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(3, -c * 0.9); ctx.lineTo(-3, -c * 0.9); ctx.closePath(); ctx.fill(); }
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, c * 0.3); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, c * 0.3, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 'spark' || kind === 'reef') { // small cross (events) / mottled (reefs) → soft glow + core
      const g = ctx.createRadialGradient(c, c, 0, c, c, c); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
      if (kind === 'spark') { ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(c, 6); ctx.lineTo(c, s - 6); ctx.moveTo(6, c); ctx.lineTo(s - 6, c); ctx.stroke(); }
    }
    const t = new THREE.CanvasTexture(cv); t.needsUpdate = true; this._tex[kind] = t; return t;
  }
}
