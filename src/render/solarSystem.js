import * as THREE from 'three';
import { getSystem, bodyPhysics } from '../data/systems.js';

// The SYSTEMS scale — a general star-system renderer. It draws ANY system
// descriptor (the Solar System, a real exoplanet system, or a procedurally
// generated one): the star, orbits, planets, dwarf planets, moons, asteroid &
// Kuiper belts, Trojans, comets and a schematic Oort shell. Each class lives in
// its own toggleable layer. Orbits are real (AU) and auto-scaled to world units
// per system; bodies are size-exaggerated (cube-root law) so they stay visible.
const TARGET = 420;                    // world radius the outermost "core" orbit maps to
const OUTER_SECS = 42;                 // seconds for the outermost core planet to orbit at 1×
const clamp = (a, b, v) => Math.max(a, Math.min(b, v));
const bodyR = (km) => clamp(0.35, 3.2, 0.9 * Math.cbrt(km / 6371));
const moonR = (km) => clamp(0.12, 0.75, 0.7 * Math.cbrt(km / 6371));
const starR = (km) => clamp(1.8, 6.0, 3.0 * Math.cbrt((km || 696000) / 696000));
const col = (c) => new THREE.Color(c[0], c[1], c[2]);
const rnd = () => Math.random();

// layer groups the UI can toggle
export const SYS_LAYERS = ['planets', 'dwarfs', 'moons', 'asteroids', 'kuiper', 'comets', 'trojans', 'oort', 'orbits', 'labels'];

export class SystemView {
  constructor() {
    this.AU = 16;
    this.paused = false;
    this.timeScale = 1;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.nodes = [];                   // pickable bodies: { mesh, name, kind, group, body, moonOf, orbitEl }
    this.planets = [];                 // animation state
    this.belts = [];                   // { points, rateY }
    this.moonMeshes = [];              // for the moons layer toggle
    this._v = new THREE.Vector3();
    this._dot = makeDot();
    this._extent = TARGET;
    this.desc = null;
    this.layerOn = { planets: true, dwarfs: true, moons: true, asteroids: true, kuiper: true, comets: true, trojans: false, oort: false, orbits: true, labels: true };

    // one THREE.Group per layer, so a whole class toggles at once
    this.layers = {};
    for (const k of SYS_LAYERS) { if (k === 'labels') continue; const g = new THREE.Group(); this.layers[k] = g; this.group.add(g); }

    // lighting (lives in the group, so it only acts while SYSTEMS is shown)
    this.starLight = new THREE.PointLight(0xfff2d8, 3.0, 0, 0.0);
    this.group.add(this.starLight);
    this.group.add(new THREE.AmbientLight(0x223044, 1.4));

    // DOM label layer
    this.layer = document.createElement('div');
    this.layer.id = 'sys-labels';
    Object.assign(this.layer.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '4', overflow: 'hidden', display: 'none' });
    document.body.appendChild(this.layer);
    this.labels = [];

    this.setSystem(getSystem('sol'));
  }

  // ── build / rebuild for a descriptor ────────────────────────────────────────
  setSystem(desc) {
    if (typeof desc === 'string') desc = getSystem(desc);
    this._clear();
    this.desc = desc;
    const bodies = desc.bodies || [];
    // AU→world scale from the outermost "core" body (≤120 AU) so the system frames well
    const coreA = bodies.filter((b) => b.a != null && b.a <= 120).map((b) => b.a);
    const refA = coreA.length ? Math.max(...coreA) : Math.max(1, ...bodies.map((b) => b.a || 1));
    this.AU = TARGET / Math.max(0.02, refA);
    this._extent = TARGET;
    // time pacing: outermost core planet takes OUTER_SECS at 1×; inner ones faster (Kepler)
    const corePeriods = bodies.filter((b) => b.a != null && b.a <= 120 && b.group === 'planet').map((b) => b.period || 1);
    this.Pref = corePeriods.length ? Math.max(...corePeriods) : Math.max(1, ...bodies.map((b) => b.period || 1));

    this._buildStar(desc.star);
    for (const b of bodies) this._buildBody(b);
    if (desc.belts) for (const belt of desc.belts) this._buildBelt(belt);
    if (desc.trojans) this._buildTrojans(desc.trojans);
    if (desc.oort) this._buildOort(desc.oort);

    this._buildLabels();
    this._applyLayers();
    this._advance(0);
  }

  _clear() {
    // dispose meshes/lines/points and empty every layer group
    for (const k of Object.keys(this.layers)) {
      const g = this.layers[k];
      g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const m = o.material; (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose && x.dispose()); } });
      while (g.children.length) g.remove(g.children[0]);
    }
    if (this.starMesh) { this.starMesh.geometry.dispose(); this.starMesh.material.dispose(); this.group.remove(this.starMesh); this.starMesh = null; }
    if (this.starGlow) { this.group.remove(this.starGlow); this.starGlow = null; }
    this.nodes = []; this.planets = []; this.belts = []; this.moonMeshes = [];
    for (const L of this.labels) L.el.remove();
    this.labels = [];
  }

  _buildStar(s) {
    const R = starR(s?.r);
    const sun = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 24), new THREE.MeshBasicMaterial({ color: col(s?.color || [1, 0.86, 0.45]) }));
    sun.userData.node = this.nodes.length; this.group.add(sun); this.starMesh = sun;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlow(), color: col(s?.color || [1, 0.9, 0.6]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(R * 6.5); this.group.add(glow); this.starGlow = glow;
    this.starLight.color = col(s?.color || [1, 0.95, 0.85]);
    this.nodes.push({ mesh: sun, name: s?.name || 'Star', kind: 'star', group: 'star', body: s, moonOf: null });
  }

  _orbitPath(b) {
    const A = b.a * this.AU, B = A * Math.sqrt(1 - (b.e || 0) ** 2), inc = (b.inc || 0) * Math.PI / 180;
    const foc = A * (b.e || 0);   // put the star at the focus (offset the ellipse centre)
    const at = (E) => { const x = A * Math.cos(E) - foc, y = B * Math.sin(E); return this._v.set(x, y * Math.cos(inc), y * Math.sin(inc)); };
    return at;
  }

  _buildBody(b) {
    const layerKey = groupToLayer(b.group);
    const layer = this.layers[layerKey] || this.layers.planets;
    const at = this._orbitPath(b);

    // orbit ellipse (in the orbits layer, coloured to the body)
    const pts = [];
    for (let i = 0; i <= 180; i++) { const Pp = at((i / 180) * Math.PI * 2); pts.push(Pp.x, Pp.y, Pp.z); }
    const og = new THREE.BufferGeometry(); og.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    const oc = col(b.color || [0.7, 0.7, 0.8]).multiplyScalar(0.6);
    const opacity = b.group === 'planet' ? 0.42 : b.group === 'comet' ? 0.3 : 0.26;
    const orbit = new THREE.LineLoop(og, new THREE.LineBasicMaterial({ color: oc, transparent: true, opacity, depthWrite: false }));
    orbit.frustumCulled = false; this.layers.orbits.add(orbit);

    // pivot rides the orbit; body + rings + moons hang off it
    const pivot = new THREE.Group(); layer.add(pivot);
    const pr = bodyR(b.r || 3000);
    const emissive = /comet/.test(b.group) ? 0.0 : 0.05;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(pr, 28, 18), new THREE.MeshStandardMaterial({ color: col(b.color || [0.7, 0.7, 0.8]), roughness: 1, metalness: 0, emissive: col(b.color || [0.7, 0.7, 0.8]).multiplyScalar(emissive) }));
    mesh.userData.node = this.nodes.length; pivot.add(mesh);
    this.nodes.push({ mesh, name: b.name, kind: b.kind, group: b.group, body: b, moonOf: null, orbitEl: orbit });

    if (b.ring) {
      const ri = pr * (b.ring.inner / b.r), ro = pr * (b.ring.outer / b.r);
      const ring = new THREE.Mesh(new THREE.RingGeometry(Math.max(pr * 1.1, ri), Math.max(pr * 1.4, ro), 64), new THREE.MeshBasicMaterial({ color: col(b.color || [0.9, 0.85, 0.7]), side: THREE.DoubleSide, transparent: true, opacity: 0.5, depthWrite: false }));
      ring.rotation.x = Math.PI / 2 - (b.tilt2 || 0) * Math.PI / 180; pivot.add(ring);
    }

    // comet tail — a soft additive sprite that we point away from the star each frame
    let tail = null;
    if (b.group === 'comet') {
      tail = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlow(), color: 0xbfe8ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      tail.scale.set(pr * 3, pr * 10, 1); pivot.add(tail);
    }

    const moons = [];
    (b.moons || []).forEach((m, mi) => {
      const md = pr + 0.7 + mi * 0.55;
      const mm = new THREE.Mesh(new THREE.SphereGeometry(moonR(m.r), 14, 10), new THREE.MeshStandardMaterial({ color: 0xcfd4dc, roughness: 1, metalness: 0 }));
      mm.userData.node = this.nodes.length; pivot.add(mm); this.moonMeshes.push(mm);
      this.nodes.push({ mesh: mm, name: m.name, kind: 'moon', group: 'moon', body: m, moonOf: b.name });
      moons.push({ mesh: mm, d: md, E: mi * 1.7, rate: (Math.PI * 2) / (2.4 + mi * 1.3) });
    });

    // angular rate: Kepler-paced, clamped so nothing seizes
    const rate = clamp(0, 2.6, (Math.PI * 2) * (this.Pref / Math.max(1e-4, b.period || this.Pref)) / OUTER_SECS);
    this.planets.push({ b, pivot, mesh, tail, at, E: rnd() * Math.PI * 2, rate, moons });
  }

  _beltCloud(inner, outer, incMax, count, color, opacity = 0.7) {
    const N = count, pos = new Float32Array(N * 3), inc = (incMax || 10) * Math.PI / 180;
    for (let i = 0; i < N; i++) {
      const a = (inner + (outer - inner) * Math.sqrt(rnd())) * this.AU;   // area-weighted
      const th = rnd() * Math.PI * 2, zt = (rnd() - 0.5) * 2 * inc;
      pos[i * 3] = Math.cos(th) * a; pos[i * 3 + 1] = Math.sin(th) * a * Math.cos(zt); pos[i * 3 + 2] = Math.sin(th) * a * Math.sin(zt) + (rnd() - 0.5) * a * Math.sin(inc) * 0.4;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ map: this._dot, color: col(color), size: 3.0, sizeAttenuation: false, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  }

  _buildBelt(belt) {
    const layer = this.layers[groupToLayer(belt.group)] || this.layers.asteroids;
    const pts = this._beltCloud(belt.inner, belt.outer, belt.incMax, belt.count, belt.color, 0.6);
    pts.frustumCulled = false; pts.userData.beltFacts = belt.facts; pts.userData.beltName = belt.name;
    layer.add(pts); this.belts.push({ points: pts, rateY: 0.02 });
  }

  _buildTrojans(t) {
    const aW = t.a * this.AU, inc = (t.incMax || 20) * Math.PI / 180;
    for (const sign of [1, -1]) {
      const N = Math.floor((t.count || 800) / 2), pos = new Float32Array(N * 3), base = sign * Math.PI / 3;
      for (let i = 0; i < N; i++) {
        const th = base + (rnd() - 0.5) * (t.spread || 0.9), a = aW * (0.94 + rnd() * 0.12), zt = (rnd() - 0.5) * 2 * inc;
        pos[i * 3] = Math.cos(th) * a; pos[i * 3 + 1] = Math.sin(th) * a * Math.cos(zt); pos[i * 3 + 2] = Math.sin(th) * a * Math.sin(zt);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const p = new THREE.Points(g, new THREE.PointsMaterial({ map: this._dot, color: col(t.color), size: 2.6, sizeAttenuation: false, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
      p.frustumCulled = false; p.userData.beltFacts = t.facts; p.userData.beltName = 'Jupiter Trojans'; this.layers.trojans.add(p);
    }
  }

  _buildOort(o) {
    // schematic shell — compressed to just beyond the planets so it stays in frame
    const N = o.count || 2000, pos = new Float32Array(N * 3), R = this._extent * 2.4;
    for (let i = 0; i < N; i++) {
      const u = rnd() * 2 - 1, ph = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u), r = R * (0.86 + 0.14 * rnd());
      pos[i * 3] = r * s * Math.cos(ph); pos[i * 3 + 1] = r * s * Math.sin(ph); pos[i * 3 + 2] = r * u;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ map: this._dot, color: col(o.color), size: 2.0, sizeAttenuation: false, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
    p.frustumCulled = false; p.userData.beltFacts = o.facts; p.userData.beltName = 'Oort Cloud (schematic)'; this.layers.oort.add(p);
  }

  _buildLabels() {
    this.labels = this.nodes.map((n) => {
      const el = document.createElement('div');
      el.className = 'map-label ' + (n.kind === 'moon' ? 'sys-moon' : n.kind === 'star' ? 'sys-sun' : 'sys-planet');
      el.textContent = n.name; this.layer.appendChild(el);
      return { el, node: n };
    });
  }

  // ── layer toggles ────────────────────────────────────────────────────────────
  setLayerVisible(key, on) { if (key in this.layerOn) { this.layerOn[key] = !!on; this._applyLayers(); } }
  layerState() { return { ...this.layerOn }; }
  _applyLayers() {
    for (const k of Object.keys(this.layers)) this.layers[k].visible = this.layerOn[k] !== false;
    for (const mm of this.moonMeshes) mm.visible = this.layerOn.moons !== false;
    if (this.layerOn.labels === false) for (const L of this.labels) L.el.style.display = 'none';
  }

  // ── controls / API ───────────────────────────────────────────────────────────
  setVisible(v) { this.group.visible = !!v; this.layer.style.display = v ? '' : 'none'; }
  setPaused(v) { this.paused = !!v; }
  setTimeScale(v) { this.timeScale = Math.max(0, +v || 0); }
  extent() { return this._extent; }
  currentId() { return this.desc?.id; }
  currentName() { return this.desc?.name; }

  findByName(q) {
    const s = String(q || '').toLowerCase().trim(); if (!s) return -1;
    const norm = (n) => n.toLowerCase();
    let i = this.nodes.findIndex((n) => norm(n.name) === s);
    if (i < 0) i = this.nodes.findIndex((n) => norm(n.name).includes(s) || s.includes(norm(n.name)));
    return i;
  }
  names() { return this.nodes.map((n) => n.name); }
  bodyList() { return this.nodes.map((n, i) => ({ i, name: n.name, kind: n.kind, group: n.group, moonOf: n.moonOf })); }

  _advance(dt) {
    for (const pl of this.planets) {
      pl.E += pl.rate * dt;
      pl.pivot.position.copy(pl.at(pl.E));
      pl.mesh.rotation.z += dt * 0.4;
      if (pl.tail) { const away = pl.pivot.position.clone().normalize(); pl.tail.position.copy(away.multiplyScalar(pl.mesh.geometry.parameters.radius * 5)); }
      for (const m of pl.moons) { m.E += m.rate * dt; m.mesh.position.set(Math.cos(m.E) * m.d, Math.sin(m.E) * m.d, 0); }
    }
    for (const belt of this.belts) belt.points.rotation.y += belt.rateY * dt;
  }

  update(dt, camera) {
    if (!this.group.visible) return;
    this._advance(this.paused ? 0 : dt * this.timeScale);
    if (this.layerOn.labels === false) return;
    const w = window.innerWidth, h = window.innerHeight, camPos = camera.position, near = this._extent * 0.14;
    for (const L of this.labels) {
      const n = L.node;
      if (n.group === 'moon') { const pl = this.planets.find((x) => x.b.name === n.moonOf); const show = pl && this.layerOn.moons !== false && camPos.distanceTo(pl.pivot.getWorldPosition(this._v)) < near * 3; if (!show) { L.el.style.display = 'none'; continue; } }
      else if (this.layerOn[groupToLayer(n.group)] === false && n.kind !== 'star') { L.el.style.display = 'none'; continue; }
      n.mesh.getWorldPosition(this._v).project(camera);
      if (this._v.z > 1) { L.el.style.display = 'none'; continue; }
      const x = (this._v.x * 0.5 + 0.5) * w, y = (-this._v.y * 0.5 + 0.5) * h;
      if (x < -60 || x > w + 60 || y < -20 || y > h + 20) { L.el.style.display = 'none'; continue; }
      L.el.style.display = ''; L.el.style.transform = `translate(${x}px, ${y}px)`;
    }
  }

  pick(ray) {
    const meshes = this.nodes.map((n) => n.mesh);
    const hits = ray.intersectObjects(meshes, false);
    return hits.length ? hits[0].object.userData.node : -1;
  }

  worldPos(i, out = new THREE.Vector3()) { return this.nodes[i] ? this.nodes[i].mesh.getWorldPosition(out) : out.set(0, 0, 0); }

  // full info for the properties panel — every measured & derived quantity
  info(i) {
    const n = this.nodes[i]; if (!n) return null;
    const b = n.body || {};
    const out = { name: n.name, kind: n.kind, group: n.group, facts: b.facts, moonOf: n.moonOf, color: b.color || (n.kind === 'moon' ? [0.81, 0.83, 0.86] : [0.8, 0.82, 0.9]) };
    // orbit
    if (b.a != null) { out.a = b.a; out.e = b.e; out.inc = b.inc; out.period = b.period; }
    if (b.aKm != null) out.aKm = b.aKm;
    // physical
    out.radiusKm = b.r; out.massMe = b.massMe; out.tempK = b.tempK; out.tilt = b.tilt; out.rotation = b.rotation;
    out.albedo = b.albedo; out.atmosphere = b.atmosphere; out.composition = b.composition; out.discovered = b.discovered;
    out.type = b.type; out.spectral = b.spectral; out.lum = b.lum;
    if (b.moonsCount != null) out.moons = b.moonsCount; else if (b.moons) out.moons = b.moons.length;
    Object.assign(out, bodyPhysics(b));   // gravity / escape / density
    if (n.kind === 'star') { out.sub = b.spectral ? `${b.spectral} star` : 'star'; }
    return out;
  }

  // framing that shows the whole core system
  defaultView() { const d = this._extent * 1.5; return { pos: new THREE.Vector3(0, -d, d * 0.72), target: new THREE.Vector3(0, 0, 0) }; }

  dispose() { this._clear(); this.layer.remove(); }
}

// keep the old name importable
export { SystemView as SolarSystem };

function groupToLayer(group) {
  return group === 'dwarf' ? 'dwarfs' : group === 'moon' ? 'moons' : group === 'kuiper' || group === 'tno' ? 'kuiper'
    : group === 'asteroid' ? 'asteroids' : group === 'comet' ? 'comets' : group === 'trojan' ? 'trojans' : group === 'oort' ? 'oort' : 'planets';
}

// soft radial glow sprite (star + comet tails)
function makeGlow() {
  const s = 128, c = document.createElement('canvas'); c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.25, 'rgba(255,220,150,0.6)');
  g.addColorStop(0.6, 'rgba(255,180,90,0.15)'); g.addColorStop(1, 'rgba(255,160,80,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// small soft dot for belt / trojan / oort point clouds
function makeDot() {
  const s = 32, c = document.createElement('canvas'); c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
