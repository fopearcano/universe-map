import * as THREE from 'three';

// ────────────────────────────────────────────────────────────────────────────
// The DEEPTIME scale — a far-future (~50 Gyr) universe, drawn from the QTR
// "Deep Time" canon: billions of galaxies condensed by gravity + dark matter
// into a cosmic web of filaments, threaded with LOCAL GROUPS of galaxies.
//
// It is a matrioska (nested) scale:
//     Deeptime  →  local group  →  galaxies  →  (systems, later)
// The overview shows the web + N local groups; entering a group generates and
// shows its member galaxies. Group metadata is generated up front (cheap); each
// group's galaxies are generated LAZILY on first entry — that per-group
// generator (`_genGalaxies`) is the seam where a live-data fetch can be slotted
// in later without touching the rest of the system. Only the overview OR a
// single entered group is ever drawn, so the cost stays flat regardless of N.
// ────────────────────────────────────────────────────────────────────────────

const R = 420;                 // world radius of the deeptime volume
const GTYPES = ['spiral', 'elliptical', 'lenticular', 'irregular', 'dwarf'];

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
const GNAME_A = ['Ossuary', 'Ember', 'Halo', 'Tide', 'Lantern', 'Ashen', 'Coral', 'Vellum', 'Sable', 'Cinder', 'Pale', 'Wraith', 'Iron', 'Amber', 'Nacre', 'Verdant', 'Silent', 'Hollow'];

function groupName(r) {
  const a = pick(r, SYL_A), b = pick(r, SYL_B);
  const tag = ['DG', 'FL', 'AR'][Math.floor(r() * 3)] + '-' + (100 + Math.floor(r() * 8900));
  return { name: `${a} ${b.charAt(0).toUpperCase() + b.slice(1)}`, tag };
}

export class Deeptime {
  constructor(scene, { seed = 0xDEE9714E, groupCount = 100 } = {}) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    this.seed = seed;
    this.groupCount = groupCount;
    this._galaxyCache = new Map();       // lazy per-group galaxy generation
    this.entered = null;                 // index of the entered local group, or null
    this._glow = this._glowTexture();

    this._buildWeb();
    this._buildGroups();
    this._buildGalaxyLayer();
  }

  // ── procedural generation ────────────────────────────────────────────────
  _buildWeb() {
    const r = rng(this.seed);
    // filament hubs, roughly on a sphere shell + interior, then a sparse graph
    const HUBS = 26;
    this.hubs = [];
    for (let i = 0; i < HUBS; i++) {
      const u = r(), v = r(), rad = R * (0.35 + 0.62 * Math.cbrt(r()));
      const th = Math.acos(2 * u - 1), ph = 2 * Math.PI * v;
      this.hubs.push(new THREE.Vector3(rad * Math.sin(th) * Math.cos(ph), rad * Math.sin(th) * Math.sin(ph) * 0.7, rad * Math.cos(th)));
    }
    // connect each hub to its 2–3 nearest → filaments
    this.filaments = [];
    for (let i = 0; i < HUBS; i++) {
      const d = this.hubs.map((h, j) => [j, this.hubs[i].distanceTo(h)]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]);
      const n = 2 + (r() < 0.5 ? 1 : 0);
      for (let k = 0; k < n; k++) { const j = d[k][0]; if (j > i) this.filaments.push([i, j]); }
    }
    // draw filaments as faint dark-matter threads (poly-lines, jittered midpoints)
    const pos = [];
    for (const [i, j] of this.filaments) {
      const a = this.hubs[i], b = this.hubs[j];
      const seg = 6, mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3((r() - 0.5) * 60, (r() - 0.5) * 60, (r() - 0.5) * 60));
      let prev = a;
      for (let s = 1; s <= seg; s++) {
        const t = s / seg;
        // quadratic bend through the jittered midpoint
        const p = a.clone().multiplyScalar((1 - t) * (1 - t)).addScaledVector(mid, 2 * (1 - t) * t).addScaledVector(b, t * t);
        pos.push(prev.x, prev.y, prev.z, p.x, p.y, p.z); prev = p;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    this.web = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x5a4a8a, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.group.add(this.web);
  }

  _buildGroups() {
    const r = rng(this.seed ^ 0x9e3779b9);
    this.groups = [];
    for (let i = 0; i < this.groupCount; i++) {
      let p;
      if (r() < 0.7 && this.filaments.length) {
        // along a filament — where the web is densest
        const [a, b] = pick(r, this.filaments);
        p = this.hubs[a].clone().lerp(this.hubs[b], r());
        p.add(new THREE.Vector3((r() - 0.5) * 34, (r() - 0.5) * 34, (r() - 0.5) * 34));
      } else {
        // a hub node
        p = this.hubs[Math.floor(r() * this.hubs.length)].clone().add(new THREE.Vector3((r() - 0.5) * 22, (r() - 0.5) * 22, (r() - 0.5) * 22));
      }
      const galaxyCount = 8 + Math.floor(r() * 54);
      const { name, tag } = groupName(r);
      const hue = 0.5 + 0.22 * (r() - 0.5) + 0.5 * (p.length() / R) * 0.16; // teal→violet outward-ish
      this.groups.push({ i, id: `dg-${i}`, name, tag, pos: p, seed: (this.seed * 2654435761 + i * 40503) >>> 0, galaxyCount, radius: 6 + Math.sqrt(galaxyCount) * 1.6, hue });
    }
    // group points (glow sprites, one draw call)
    const n = this.groups.length;
    const gpos = new Float32Array(n * 3), gcol = new Float32Array(n * 3), gsz = new Float32Array(n);
    const c = new THREE.Color();
    this.groups.forEach((g, k) => {
      gpos[k * 3] = g.pos.x; gpos[k * 3 + 1] = g.pos.y; gpos[k * 3 + 2] = g.pos.z;
      c.setHSL(g.hue, 0.7, 0.62); gcol[k * 3] = c.r; gcol[k * 3 + 1] = c.g; gcol[k * 3 + 2] = c.b;
      gsz[k] = 10 + Math.sqrt(g.galaxyCount) * 3.4;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(gpos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(gcol, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(gsz, 1));
    this.groupWorld = gpos;
    this.groupPoints = new THREE.Points(geo, this._pointMat(1));
    this.groupPoints.frustumCulled = false;
    this.group.add(this.groupPoints);
  }

  _buildGalaxyLayer() {
    // a single reusable Points object; refilled when a group is entered
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(3), 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(1), 1));
    this.galaxyPoints = new THREE.Points(geo, this._pointMat(1.15));
    this.galaxyPoints.frustumCulled = false;
    this.galaxyPoints.visible = false;
    this.group.add(this.galaxyPoints);
  }

  // lazily generate (or fetch, later) the galaxies for a group
  _genGalaxies(i) {
    if (this._galaxyCache.has(i)) return this._galaxyCache.get(i);
    const g = this.groups[i];
    const r = rng(g.seed);
    const gal = [];
    for (let k = 0; k < g.galaxyCount; k++) {
      // cluster the members toward the group centre (a King-ish falloff)
      const rad = g.radius * Math.pow(r(), 0.55);
      const u = r(), v = r(), th = Math.acos(2 * u - 1), ph = 2 * Math.PI * v;
      const rel = new THREE.Vector3(rad * Math.sin(th) * Math.cos(ph), rad * Math.sin(th) * Math.sin(ph), rad * Math.cos(th) * 0.85);
      const type = pick(r, k === 0 ? ['elliptical'] : GTYPES);      // brightest cluster galaxy = giant elliptical
      const size = (type === 'elliptical' ? 3.4 : type === 'dwarf' ? 1.1 : 2.2) * (0.7 + r());
      gal.push({ k, name: `${g.tag}·G${k + 1}`, type, pos: g.pos.clone().add(rel), size, hue: g.hue + (r() - 0.5) * 0.06 });
    }
    this._galaxyCache.set(i, gal);
    return gal;
  }

  // ── matrioska navigation ─────────────────────────────────────────────────
  enterGroup(i) {
    if (i == null || i < 0 || i >= this.groups.length) return null;
    this.entered = i;
    const gal = this._genGalaxies(i);
    const n = gal.length;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), sz = new Float32Array(n);
    const c = new THREE.Color();
    gal.forEach((gx, k) => {
      pos[k * 3] = gx.pos.x; pos[k * 3 + 1] = gx.pos.y; pos[k * 3 + 2] = gx.pos.z;
      c.setHSL((gx.hue % 1 + 1) % 1, 0.68, gx.type === 'elliptical' ? 0.78 : 0.6);
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      sz[k] = 9 + gx.size * 6;
    });
    const geo = this.galaxyPoints.geometry;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    geo.attributes.position.needsUpdate = true;
    this._galaxyWorld = pos;
    this.galaxyPoints.visible = true;
    this.groupPoints.material.uniforms.uDim.value = 1;  // fade the overview groups
    return this.groups[i];
  }
  exitGroup() {
    this.entered = null;
    this.galaxyPoints.visible = false;
    this.groupPoints.material.uniforms.uDim.value = 0;
  }

  // camera view helpers
  defaultView() {
    return { pos: new THREE.Vector3(R * 1.15, R * 0.7, R * 1.35), target: new THREE.Vector3(0, 0, 0) };
  }
  groupView(i) {
    const g = this.groups[i]; if (!g) return this.defaultView();
    const dir = g.pos.clone().normalize().multiplyScalar(-1).add(new THREE.Vector3(0, 0.4, 0.2)).normalize();
    return { pos: g.pos.clone().addScaledVector(dir, g.radius * 3.4 + 12), target: g.pos.clone() };
  }

  // ── picking / describe / labels ──────────────────────────────────────────
  pick(raycaster) {
    const world = this.entered != null ? this._galaxyWorld : this.groupWorld;
    if (!world) return null;
    const list = this.entered != null ? this._galaxyCache.get(this.entered) : this.groups;
    const ray = raycaster.ray;
    let best = -1, bestScore = Infinity;
    const p = new THREE.Vector3();
    for (let k = 0; k < world.length / 3; k++) {
      p.set(world[k * 3], world[k * 3 + 1], world[k * 3 + 2]);
      const t = p.clone().sub(ray.origin).dot(ray.direction);
      if (t < 0) continue;
      const closest = ray.origin.clone().addScaledVector(ray.direction, t);
      const d = closest.distanceTo(p);
      const tol = 0.04 * t + (this.entered != null ? 4 : 12);
      if (d < tol && d < bestScore) { bestScore = d; best = k; }
    }
    if (best < 0) return null;
    return this.entered != null ? { kind: 'dt-galaxy', i: best, galaxy: list[best] } : { kind: 'dt-group', i: best, group: list[best] };
  }
  describe(hit) {
    if (!hit) return null;
    if (hit.kind === 'dt-group') {
      const g = hit.group;
      return { label: g.name, kind: 'dt-group', sub: `local group · ${g.tag}`, worldPos: g.pos.clone(),
        info: [['members', `${g.galaxyCount} galaxies`], ['tag', g.tag], ['scale', 'Deep-Time · ~50 Gyr']], dtIndex: g.i };
    }
    const gx = hit.galaxy;
    return { label: gx.name, kind: 'dt-galaxy', sub: `${gx.type} galaxy`, worldPos: gx.pos.clone(),
      info: [['type', gx.type], ['group', this.groups[this.entered].name]], dtGalaxy: gx };
  }
  labelItems() {
    if (this.entered != null) {
      const gal = this._galaxyCache.get(this.entered) || [];
      return gal.filter((gx) => gx.type === 'elliptical' || gx.size > 2.6).slice(0, 24).map((gx) => ({ pos: gx.pos, text: gx.name, cls: 'lbl-star', prio: gx.size }));
    }
    // label a subset of the largest groups so the overview isn't a wall of text
    return [...this.groups].sort((a, b) => b.galaxyCount - a.galaxyCount).slice(0, 30).map((g) => ({ pos: g.pos, text: g.name, cls: 'lbl-ref', prio: g.galaxyCount }));
  }
  groupList() { return this.groups.map((g) => ({ i: g.i, name: g.name, tag: g.tag, count: g.galaxyCount })); }

  // ── LOD / frame update ───────────────────────────────────────────────────
  update(camera) {
    if (!this.group.visible) return;
    const camDist = camera.position.length();
    // fade the web threads out as you dive into a group; back in on the overview
    const webOp = this.entered != null ? 0.06 : Math.max(0.08, Math.min(0.32, 0.32 - (600 - camDist) / 6000));
    this.web.material.opacity = webOp;
  }

  setVisible(v) { this.group.visible = v; if (!v) { /* keep entered state */ } }

  // ── materials ────────────────────────────────────────────────────────────
  _pointMat(scale) {
    return new THREE.ShaderMaterial({
      uniforms: { uTex: { value: this._glow }, uScale: { value: scale }, uDim: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute vec3 aColor; attribute float aSize; varying vec3 vC; uniform float uScale;
        void main(){ vC=aColor; vec4 mv=modelViewMatrix*vec4(position,1.0);
          gl_PointSize = aSize*uScale*(300.0/max(-mv.z,1.0)); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `
        varying vec3 vC; uniform sampler2D uTex; uniform float uDim;
        void main(){ vec4 t=texture2D(uTex, gl_PointCoord); gl_FragColor=vec4(vC, t.a*(1.0-0.72*uDim)); }`,
    });
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
