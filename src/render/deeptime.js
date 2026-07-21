import * as THREE from 'three';
import { comovingMpc, displayRadiusFromMpc, distanceColor, fmtCosmoDist } from '../util/cosmology.js';
import { structureCloud, morphFromType } from './morphology.js';
import { GalaxyInterior } from './galaxyInterior.js';

// ────────────────────────────────────────────────────────────────────────────
// The DEEPTIME scale — a far-future (~50 Gyr) universe from the QTR "Deep Time"
// canon, built to the SAME depth and rules as COSMOS: a logarithmic-radial map
// (direction exact, radius log-compressed) on the same Planck-ΛCDM cosmology,
// but PROCEDURALLY GENERATED — in 50 billion years the real cosmos has changed,
// so this one is derived from the real cosmology's rules rather than its data.
//
// It is a MATRIOSKA (nested) scale, deeper than a point-cloud:
//     Deeptime universe  →  a galaxy's interior (its own star field)  →  (systems, later)
//
//   · Universe (level 0): a home supergalaxy at the origin (there is no Sun in
//     50 Gyr — the merged descendant of the Local Group anchors the map the way
//     Sol anchors Cosmos), a cosmic web of filaments, a dense field of galaxies
//     condensed onto that web that THINS toward the horizon (the "blend": real
//     accelerating-expansion isolation + the QTR condensed-web canon on one map),
//     and 100 named, navigable ANCHOR galaxies.
//   · Galaxy (level 1): enter any galaxy and fly inside its own star field — a
//     "local"-sized database (tens of thousands of stars) generated on demand.
//     That per-galaxy generator (`enterGalaxy`) is the seam where a live data
//     fetch/richer model slots in later without touching the rest of the system.
//
// Only the universe OR one entered galaxy is ever drawn, so cost stays flat.
// ────────────────────────────────────────────────────────────────────────────

const GTYPES = ['spiral', 'elliptical', 'lenticular', 'irregular', 'dwarf'];
const FIELD = 140000;         // background galaxies condensed on the web
const HUBS = 40;              // filament hubs across the log-radial volume
const DEEPTIME_TINT = new THREE.Color(0.62, 0.5, 0.86); // deep-time violet

// deterministic seeded RNG (mulberry32) so the whole universe is reproducible
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

// evocative far-future names, syllable-built + a catalogue tag
const SYL_A = ['Aeon', 'Vael', 'Sōr', 'Thren', 'Ixa', 'Orun', 'Kael', 'Nyx', 'Zeph', 'Umbra', 'Cael', 'Drav', 'Eryn', 'Mor', 'Ossa', 'Vyre', 'Halla', 'Tavu', 'Onei', 'Skarn'];
const SYL_B = ['reach', 'wold', 'mere', 'spire', 'fold', 'gyre', 'holt', 'run', 'drift', 'vault', 'shoal', 'coil', 'wane', 'span', 'loom', 'crest', 'hollow', 'weald'];

function galaxyName(r) {
  const a = pick(r, SYL_A), b = pick(r, SYL_B);
  const tag = ['DG', 'FL', 'AR'][Math.floor(r() * 3)] + '-' + (100 + Math.floor(r() * 8900));
  return { name: `${a} ${b.charAt(0).toUpperCase() + b.slice(1)}`, tag };
}

export class Deeptime {
  constructor(scene, cosmosData, { seed = 0xDEE9714E, anchorCount = 100 } = {}) {
    this.scene = scene;
    this.decadeUnit = cosmosData.meta.decadeUnit;
    this.cmbR = cosmosData.meta.cmb.displayR;          // horizon shell radius on the map
    this.R = this.cmbR * 0.96;                          // structure reaches most of the way out
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    this.seed = seed;
    this.anchorCount = anchorCount;
    this._glow = this._glowTexture();
    this._style = null;                                 // graphics-panel per-layer override

    // matrioska level-1 state (inside a galaxy)
    this.interior = null;
    this.enteredGalaxy = null;

    this._buildWeb();        // hubs + filament threads (display space)
    this._buildField();      // the dense galaxy web, thinning toward the horizon
    this._buildAnchors();    // 100 named, navigable galaxies (index 0 = home)
    this._buildRings();      // faint decade rings for scale context
  }

  // true distance (pc) back out of a logarithmic display radius
  _distPc(displayR) { return Math.pow(10, displayR / this.decadeUnit); }
  // a cosmologically-spaced display radius from a sampled redshift (ties the
  // procedural layout to the same Planck-ΛCDM distance rules as Cosmos)
  _radiusFromZ(z) { return displayRadiusFromMpc(comovingMpc(z), this.decadeUnit); }
  // per-field deterministic seed (so a field galaxy's identity/interior is stable
  // without storing 140k objects) — the live-generation seam for the background web
  _fieldSeed(i) { return (Math.imul(this.seed ^ 0xF1E1D5, i + 1) ^ (i * 2654435761)) >>> 0; }

  // ── procedural generation ────────────────────────────────────────────────
  _buildWeb() {
    const r = rng(this.seed);
    // hubs on cosmologically-spaced shells, biased inward (blend: denser core),
    // random directions — the nodes the filaments will connect.
    this.hubs = [];
    for (let i = 0; i < HUBS; i++) {
      const z = 0.03 * Math.pow(6 / 0.03, Math.pow(r(), 1.5));  // inner-biased log-uniform z
      const rad = Math.min(this.R, this._radiusFromZ(z));
      const u = r(), v = r(), th = Math.acos(2 * u - 1), ph = 2 * Math.PI * v;
      this.hubs.push(new THREE.Vector3(rad * Math.sin(th) * Math.cos(ph), rad * Math.sin(th) * Math.sin(ph) * 0.82, rad * Math.cos(th)));
    }
    // connect each hub to its 2–3 nearest → filaments
    this.filaments = [];
    for (let i = 0; i < HUBS; i++) {
      const d = this.hubs.map((h, j) => [j, this.hubs[i].distanceTo(h)]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]);
      const n = 2 + (r() < 0.5 ? 1 : 0);
      for (let k = 0; k < n; k++) { const j = d[k][0]; if (j > i) this.filaments.push([i, j]); }
    }
    // draw filaments as faint dark-matter threads (jittered quadratic poly-lines)
    const pos = [];
    for (const [i, j] of this.filaments) {
      const a = this.hubs[i], b = this.hubs[j];
      const seg = 7, mid = a.clone().lerp(b, 0.5).addScaledVector(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5), this.R * 0.12);
      let prev = a;
      for (let s = 1; s <= seg; s++) {
        const t = s / seg;
        const p = a.clone().multiplyScalar((1 - t) * (1 - t)).addScaledVector(mid, 2 * (1 - t) * t).addScaledVector(b, t * t);
        pos.push(prev.x, prev.y, prev.z, p.x, p.y, p.z); prev = p;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    this.web = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x5a4a8a, transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.group.add(this.web);
  }

  // gaussian-ish offset via two uniforms
  _gauss(r, s) { return (r() + r() + r() - 1.5) * s; }

  _buildField() {
    const r = rng(this.seed ^ 0x1234abcd);
    const pos = new Float32Array(FIELD * 3), col = new Float32Array(FIELD * 3), sz = new Float32Array(FIELD);
    // favour inner filaments (blend: the web is dense near the home supergalaxy,
    // thinning toward the horizon where accelerating expansion has isolated things)
    const fW = this.filaments.map(([i, j]) => {
      const mr = (this.hubs[i].length() + this.hubs[j].length()) * 0.5;
      return Math.exp(-mr / (this.R * 0.42));
    });
    const wSum = fW.reduce((a, b) => a + b, 0);
    const c = new THREE.Color();
    let k = 0;
    while (k < FIELD) {
      let p;
      const roll = r();
      if (roll < 0.9 && this.filaments.length) {
        // condensed onto a filament thread
        let x = r() * wSum, fi = 0; while (fi < fW.length - 1 && (x -= fW[fi]) > 0) fi++;
        const [a, b] = this.filaments[fi];
        const t = r();
        const thick = this.R * (0.006 + 0.03 * Math.pow(r(), 2));
        p = this.hubs[a].clone().lerp(this.hubs[b], t)
          .add(new THREE.Vector3(this._gauss(r, thick), this._gauss(r, thick), this._gauss(r, thick)));
      } else {
        // a thin uniform halo in the shell for depth
        const rad = this.R * Math.cbrt(r());
        const u = r(), v = r(), th = Math.acos(2 * u - 1), ph = 2 * Math.PI * v;
        p = new THREE.Vector3(rad * Math.sin(th) * Math.cos(ph), rad * Math.sin(th) * Math.sin(ph), rad * Math.cos(th));
      }
      const rr = p.length();
      if (rr > this.R) continue;
      // radial thinning toward the horizon — accelerating-expansion isolation
      if (r() > Math.max(0.12, 1 - Math.pow(rr / this.R, 1.4))) continue;
      pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
      const dc = distanceColor(rr / this.cmbR);
      c.setRGB(dc[0], dc[1], dc[2]).lerp(DEEPTIME_TINT, 0.5).multiplyScalar(0.72);
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      sz[k] = 0.6 + r() * 1.1;
      k++;
    }
    this._fieldCount = k;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, k * 3), 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col.subarray(0, k * 3), 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sz.subarray(0, k), 1));
    this.fieldWorld = pos.subarray(0, k * 3);
    this.fieldPoints = new THREE.Points(geo, this._pointMat(0.5, { additive: false, alpha: 0.9 }));
    this.fieldPoints.frustumCulled = false;
    this.group.add(this.fieldPoints);
  }

  _buildAnchors() {
    const r = rng(this.seed ^ 0x9e3779b9);
    this.anchors = [];
    for (let i = 0; i < this.anchorCount; i++) {
      let p, type, name, tag, diameterKpc;
      if (i === 0) {
        // the home supergalaxy — merged descendant of the Local Group, at the origin
        p = new THREE.Vector3(0, 0, 0);
        type = 'elliptical'; name = 'Aeon Hearth'; tag = 'HOME'; diameterKpc = 210;
      } else {
        // seat anchors on the densest inner filaments so they read as web nodes
        const [a, b] = pick(r, this.filaments);
        p = this.hubs[a].clone().lerp(this.hubs[b], 0.15 + 0.7 * r())
          .add(new THREE.Vector3(this._gauss(r, this.R * 0.02), this._gauss(r, this.R * 0.02), this._gauss(r, this.R * 0.02)));
        type = pick(r, GTYPES);
        const nm = galaxyName(r); name = nm.name; tag = nm.tag;
        diameterKpc = 18 + Math.pow(r(), 1.5) * 120;
      }
      const displayR = p.length();
      this.anchors.push({
        i, id: `dt-g${i}`, name, tag, type, pos: p.clone(), displayR,
        distPc: this._distPc(displayR), diameterKpc,
        seed: (Math.imul(this.seed, 2654435761) + i * 40503) >>> 0,
        home: i === 0,
      });
    }
    // anchor glow points (bright, one draw call)
    const n = this.anchors.length;
    const gpos = new Float32Array(n * 3), gcol = new Float32Array(n * 3), gsz = new Float32Array(n);
    const c = new THREE.Color();
    this.anchors.forEach((g, k) => {
      gpos[k * 3] = g.pos.x; gpos[k * 3 + 1] = g.pos.y; gpos[k * 3 + 2] = g.pos.z;
      const dc = distanceColor(g.displayR / this.cmbR);
      c.setRGB(dc[0], dc[1], dc[2]).lerp(new THREE.Color(1, 1, 1), g.home ? 0.5 : 0.15);
      gcol[k * 3] = c.r; gcol[k * 3 + 1] = c.g; gcol[k * 3 + 2] = c.b;
      // sizes tuned for the log-radial scale (R≈30) so anchors read as distinct
      // glowing nodes, not overlapping blobs; the home supergalaxy is the largest
      gsz[k] = (g.home ? 3.6 : 1.4) + Math.sqrt(g.diameterKpc) * 0.06;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(gpos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(gcol, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(gsz, 1));
    this.anchorWorld = gpos;
    this.anchorPoints = new THREE.Points(geo, this._pointMat(1.0));
    this.anchorPoints.frustumCulled = false;
    this.group.add(this.anchorPoints);
  }

  _buildRings() {
    const rings = new THREE.Group();
    const mat = new THREE.LineBasicMaterial({ color: 0x4a3f6a, transparent: true, opacity: 0.32, depthWrite: false });
    for (let d = 1; d <= 5; d++) {
      const rad = (d / 5) * this.R;
      const pts = [];
      for (let s = 0; s <= 96; s++) { const a = (s / 96) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * rad, Math.sin(a) * rad, 0)); }
      rings.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    }
    this.rings = rings;
    this.group.add(rings);
  }

  // ── matrioska navigation: enter / exit a galaxy interior (level 1) ─────────
  // Build a navigable star field for a galaxy descriptor. `count` is the size of
  // that galaxy's "database" (local-sized: tens of thousands of stars). This is
  // the live-generation seam — swap structureCloud for retrieved data later.
  enterGalaxy(desc, { count = 60000 } = {}) {
    if (!desc) return null;
    if (this.interior) this.exitGalaxy();
    let morph = morphFromType(desc.type);
    if (morph === 'globular' || morph === 'open') morph = 'spiral';
    const R = 30;                                       // interior world radius (units)
    const cloud = structureCloud(morph, R, desc.seed % 100000, { count });
    cloud.count = cloud.count ?? cloud.positions.length / 3;
    const pcPerUnit = (desc.diameterKpc * 500) / R;     // (D/2 in pc) / R
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
    for (const o of [this.web, this.fieldPoints, this.anchorPoints, this.rings]) if (o) o.visible = v;
  }

  // resolve any pickable galaxy (anchor index, or a field index) to a descriptor
  anchorDesc(i) { const g = this.anchors[i]; return g && { name: g.name, tag: g.tag, type: g.type, seed: g.seed, diameterKpc: g.diameterKpc, pos: g.pos.clone(), i, anchor: true, home: g.home }; }
  fieldDesc(i) {
    const r = rng(this._fieldSeed(i)); const nm = galaxyName(r);
    const type = pick(r, GTYPES), diameterKpc = 15 + Math.pow(r(), 1.5) * 80;
    const pos = new THREE.Vector3(this.fieldWorld[i * 3], this.fieldWorld[i * 3 + 1], this.fieldWorld[i * 3 + 2]);
    return { name: nm.name, tag: nm.tag, type, seed: this._fieldSeed(i), diameterKpc, pos, i, anchor: false };
  }

  // ── camera views ───────────────────────────────────────────────────────────
  defaultView() {
    const d = this.R * 1.5;
    return { pos: new THREE.Vector3(d * 0.8, d * 0.5, d), target: new THREE.Vector3(0, 0, 0) };
  }
  galaxyView(desc) {
    const p = desc.pos || (this.anchors[desc.i]?.pos) || new THREE.Vector3();
    const off = Math.max(this.R * 0.06, 14) + desc.diameterKpc * 0.02;
    const dir = p.length() < 1e-3 ? new THREE.Vector3(0.6, 0.4, 0.8) : p.clone().normalize().multiplyScalar(-0.8).add(new THREE.Vector3(0, 0.35, 0.2));
    return { pos: p.clone().addScaledVector(dir.normalize(), off + 20), target: p.clone() };
  }
  interiorView() {
    const R = this.interior ? this.interior.extent() : 30;
    return { pos: new THREE.Vector3(R * 0.9, R * 0.45, R * 1.15), target: new THREE.Vector3(0, 0, 0) };
  }

  // ── picking / describe / labels ────────────────────────────────────────────
  pick(raycaster, camera) {
    if (this.interior) {
      const i = this.interior.pick(raycaster, camera);
      return i < 0 ? null : { kind: 'dt-star', i };
    }
    const ray = raycaster.ray, o = ray.origin, dir = ray.direction;
    const p = new THREE.Vector3();
    // anchors first (bright, generous tolerance)
    let best = -1, bestScore = Infinity;
    for (let k = 0; k < this.anchorWorld.length / 3; k++) {
      p.set(this.anchorWorld[k * 3], this.anchorWorld[k * 3 + 1], this.anchorWorld[k * 3 + 2]);
      const t = p.clone().sub(o).dot(dir); if (t < 0) continue;
      const d = o.clone().addScaledVector(dir, t).distanceTo(p);
      const tol = 0.03 * t + this.R * 0.02;
      if (d < tol && d < bestScore) { bestScore = d; best = k; }
    }
    if (best >= 0) return { kind: 'dt-galaxy', i: best };
    // then the field web
    let fb = -1, fScore = Infinity;
    for (let k = 0; k < this._fieldCount; k++) {
      p.set(this.fieldWorld[k * 3], this.fieldWorld[k * 3 + 1], this.fieldWorld[k * 3 + 2]);
      const t = p.clone().sub(o).dot(dir); if (t < 0) continue;
      const d = o.clone().addScaledVector(dir, t).distanceTo(p);
      const tol = 0.012 * t + this.R * 0.004;
      if (d < tol && d < fScore) { fScore = d; fb = k; }
    }
    return fb >= 0 ? { kind: 'dt-field', i: fb } : null;
  }

  describe(hit) {
    if (!hit) return null;
    if (hit.kind === 'dt-star') {
      const i = hit.i, wp = this.interior.starWorld(i);
      const distPc = this.interior.starDistPc(i);
      const name = `${this.interior.name.replace(/\s*\(.*\)/, '')}·S${(i % 99999).toString().padStart(5, '0')}`;
      // truePos = galaxy-core-relative parsecs (same convention as a Cosmos interior star)
      return { label: name, kind: 'dt-star', sub: `star · ${this.enteredGalaxy?.name || 'galaxy'}`,
        worldPos: wp.clone(), truePos: wp.clone().multiplyScalar(this.interior.pcPerUnit),
        info: [['galaxy', this.enteredGalaxy?.name || '—'], ['from core', `${(distPc / 1000).toFixed(2)} kpc`], ['scale', 'Deep-Time · interior']] };
    }
    const desc = hit.kind === 'dt-galaxy' ? this.anchorDesc(hit.i) : this.fieldDesc(hit.i);
    const displayR = desc.pos.length();
    const distPc = this._distPc(displayR);
    // truePos = origin-relative parsecs; direction is exact, so invert the log radius
    const truePos = displayR < 1e-9 ? new THREE.Vector3() : desc.pos.clone().normalize().multiplyScalar(distPc);
    const kindLabel = desc.home ? 'home supergalaxy' : (desc.anchor ? 'anchor galaxy · navigable' : 'galaxy · navigable');
    const rows = [
      ['type', desc.type], ['distance', fmtCosmoDist(distPc / 1e6)],
      ['diameter', `${Math.round(desc.diameterKpc)} kpc`], ['scale', 'Deep-Time · ~50 Gyr'],
    ];
    if (desc.anchor && !desc.home) rows.splice(1, 0, ['catalogue', desc.tag]);
    return { label: desc.name, kind: 'dt-galaxy', sub: kindLabel, worldPos: desc.pos.clone(), truePos, info: rows, dtDesc: desc };
  }

  labelItems() {
    if (this.interior) return [];   // interior stars aren't labelled (too many)
    // the home + the largest / nearest anchors, so the overview isn't a text wall
    return [...this.anchors]
      .sort((a, b) => (b.home - a.home) || (a.displayR - b.displayR))
      .slice(0, 30)
      .map((g) => ({ pos: g.pos, text: g.name, cls: g.home ? 'lbl-ref' : 'lbl-star', prio: g.home ? 999 : g.diameterKpc }));
  }
  // for the dropdown navigator — the named anchor galaxies
  galaxyList() { return this.anchors.map((g) => ({ i: g.i, name: g.name, tag: g.tag, type: g.type, home: g.home })); }

  // ── LOD / frame update ─────────────────────────────────────────────────────
  update(camera) {
    if (!this.group.visible) return;
    if (this.interior) return;
    const camDist = camera.position.length();
    // web threads fade in as you pull back to see the whole cosmic web
    this.web.material.opacity = Math.max(0.08, Math.min(0.3, camDist / (this.R * 6)));
  }

  setVisible(v) { this.group.visible = v; }

  // ── materials / graphics-panel style ───────────────────────────────────────
  // additive:true → bright glowing sprites (anchors / home, meant to bloom).
  // additive:false → normal-blended soft points (the dense field), so thousands
  // stacking on a filament read as a coloured web instead of saturating to white.
  _pointMat(scale, { additive = true, alpha = 1 } = {}) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: this._glow }, uScale: { value: scale }, uDim: { value: 0 }, uAlpha: { value: alpha },
        uSizeUser: { value: 1 }, uGain: { value: 1 },
        uTint: { value: new THREE.Color(1, 1, 1) }, uTintAmt: { value: 0 },
      },
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `
        attribute vec3 aColor; attribute float aSize; varying vec3 vC;
        uniform float uScale, uSizeUser, uTintAmt; uniform vec3 uTint;
        void main(){ vC=mix(aColor, uTint, uTintAmt); vec4 mv=modelViewMatrix*vec4(position,1.0);
          gl_PointSize = aSize*uScale*uSizeUser*(300.0/max(-mv.z,1.0)); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `
        varying vec3 vC; uniform sampler2D uTex; uniform float uDim, uGain, uAlpha;
        void main(){ vec4 t=texture2D(uTex, gl_PointCoord); gl_FragColor=vec4(vC*uGain, t.a*uAlpha*(1.0-0.72*uDim)); }`,
    });
  }
  // Per-layer visuals from the graphics panel, applied to the universe clouds
  // (and the interior, when inside): { size, gain, tint:[r,g,b], tintAmt }.
  setStyle(st = {}) {
    this._style = { ...(this._style || {}), ...st };
    const targets = [this.fieldPoints, this.anchorPoints, this.interior?.points];
    for (const p of targets) {
      const u = p?.material?.uniforms; if (!u) continue;
      if (st.size != null && u.uSizeUser) u.uSizeUser.value = st.size;
      if (st.gain != null && u.uGain) u.uGain.value = st.gain;
      if (Array.isArray(st.tint) && u.uTint) u.uTint.value.setRGB(st.tint[0], st.tint[1], st.tint[2]);
      if (st.tintAmt != null && u.uTintAmt) u.uTintAmt.value = st.tintAmt;
    }
    if (st.size != null && this.interior) this.interior.setSizeScale(st.size);
  }
  _glowTexture() {
    const s = 64, cv = document.createElement('canvas'); cv.width = cv.height = s;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.65)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.15)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    const t = new THREE.CanvasTexture(cv); t.needsUpdate = true; return t;
  }
}
