import * as THREE from 'three';
import { SUN, PLANETS } from '../data/solarSystem.js';

// The SYSTEM scale: the Sun, planets, dwarf planets and major moons. Orbits are
// drawn to real scale (AU); bodies are size-exaggerated (cube-root law) so they
// stay visible. The Sun lights the scene; planets revolve, moons circle their
// planets. Owns its own DOM label layer, projected each frame like the map's.
const AU = 16;                         // world units per astronomical unit
const SEC_PER_YEAR = 10;               // Earth completes an orbit in ~10 s
const clamp = (a, b, v) => Math.max(a, Math.min(b, v));
const bodyR = (km) => clamp(0.35, 2.2, 0.9 * Math.cbrt(km / 6371));
const moonR = (km) => clamp(0.12, 0.7, 0.7 * Math.cbrt(km / 6371));
const col = (c) => new THREE.Color(c[0], c[1], c[2]);

export class SolarSystem {
  constructor() {
    this.AU = AU;                      // world units per AU (for telemetry)
    this.group = new THREE.Group();
    this.group.visible = false;
    this.nodes = [];                   // flat pickable list: { mesh, name, kind, facts, orbit, moonOf }
    this.planets = [];                 // per-planet animation state
    this._v = new THREE.Vector3();

    // lighting (lives in the group, so it only acts while SYSTEM is shown)
    this.group.add(new THREE.PointLight(0xfff2d8, 3.0, 0, 0.0));
    this.group.add(new THREE.AmbientLight(0x223044, 1.4));

    // ---- the Sun ----
    const sun = new THREE.Mesh(new THREE.SphereGeometry(3.0, 40, 24), new THREE.MeshBasicMaterial({ color: col(SUN.color) }));
    sun.userData.node = this.nodes.length;
    this.group.add(sun);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlow(), color: 0xffe6a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(20); this.group.add(glow);
    this.nodes.push({ mesh: sun, name: SUN.name, kind: 'star', facts: SUN.facts, orbit: null, moonOf: null });

    // ---- planets, orbits & moons ----
    for (const p of PLANETS) {
      const A = p.a * AU, B = A * Math.sqrt(1 - p.e * p.e), inc = p.inc * Math.PI / 180;
      const at = (E) => { const x = A * (Math.cos(E) - p.e), y = B * Math.sin(E); return this._v.set(x, y * Math.cos(inc), y * Math.sin(inc)); };

      // orbit ellipse (faint, in the planet's colour)
      const pts = [];
      for (let i = 0; i <= 160; i++) { const P = at((i / 160) * Math.PI * 2); pts.push(P.x, P.y, P.z); }
      const og = new THREE.BufferGeometry(); og.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
      const oc = col(p.color).multiplyScalar(0.6);
      const orbit = new THREE.LineLoop(og, new THREE.LineBasicMaterial({ color: oc, transparent: true, opacity: p.kind === 'dwarf' ? 0.28 : 0.42, depthWrite: false }));
      orbit.frustumCulled = false; this.group.add(orbit);

      // planet pivot rides the orbit; planet + rings + moons hang off it
      const pivot = new THREE.Group(); this.group.add(pivot);
      const pr = bodyR(p.r);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(pr, 32, 20), new THREE.MeshStandardMaterial({ color: col(p.color), roughness: 1, metalness: 0, emissive: col(p.color).multiplyScalar(0.05) }));
      mesh.userData.node = this.nodes.length; pivot.add(mesh);
      this.nodes.push({ mesh, name: p.name, kind: p.kind, facts: p.facts, orbit: p, moonOf: null });

      if (p.ring) {
        const ri = pr * (p.ring.inner / p.r), ro = pr * (p.ring.outer / p.r);
        const rg = new THREE.RingGeometry(ri, ro, 64);
        const ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: col(p.color), side: THREE.DoubleSide, transparent: true, opacity: 0.5, depthWrite: false }));
        ring.rotation.x = Math.PI / 2 - (p.tilt || 0) * Math.PI / 180; pivot.add(ring);
      }

      const moons = [];
      (p.moons || []).forEach((m, mi) => {
        const md = pr + 0.7 + mi * 0.55;                 // exaggerated, ordered moon distance
        const mr = moonR(m.r);
        const mm = new THREE.Mesh(new THREE.SphereGeometry(mr, 16, 12), new THREE.MeshStandardMaterial({ color: 0xcfd4dc, roughness: 1, metalness: 0 }));
        mm.userData.node = this.nodes.length; pivot.add(mm);
        this.nodes.push({ mesh: mm, name: m.name, kind: 'moon', facts: m.facts, orbit: null, moonOf: p.name });
        moons.push({ mesh: mm, d: md, E: mi * 1.7, rate: (Math.PI * 2) / (2.4 + mi * 1.3) });
      });

      this.planets.push({ p, pivot, mesh, at, E: Math.random() * Math.PI * 2, rate: (Math.PI * 2) / (Math.max(0.2, p.period) * SEC_PER_YEAR), moons });
    }

    // ---- label layer ----
    this.layer = document.createElement('div');
    this.layer.id = 'sys-labels';
    Object.assign(this.layer.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '4', overflow: 'hidden', display: 'none' });
    document.body.appendChild(this.layer);
    this.labels = this.nodes.map((n) => {
      const el = document.createElement('div');
      el.className = 'map-label ' + (n.kind === 'moon' ? 'sys-moon' : n.kind === 'star' ? 'sys-sun' : 'sys-planet');
      el.textContent = n.name; this.layer.appendChild(el);
      return { el, node: n };
    });

    // place everything at t=0 (Math.random for phase already varies the layout)
    this._advance(0);
  }

  setVisible(v) { this.group.visible = !!v; this.layer.style.display = v ? '' : 'none'; }

  _advance(dt) {
    for (const pl of this.planets) {
      pl.E += pl.rate * dt;
      pl.pivot.position.copy(pl.at(pl.E));
      pl.mesh.rotation.z += dt * 0.5;
      for (const m of pl.moons) { m.E += m.rate * dt; m.mesh.position.set(Math.cos(m.E) * m.d, Math.sin(m.E) * m.d, 0); }
    }
  }

  update(dt, camera) {
    if (!this.group.visible) return;
    this._advance(dt);
    // labels: planets & Sun always; moons only when the camera is near their planet
    const w = window.innerWidth, h = window.innerHeight;
    const camPos = camera.position;
    for (const L of this.labels) {
      const n = L.node;
      let show = true;
      if (n.kind === 'moon') { const pl = this.planets.find((x) => x.p.name === n.moonOf); show = pl ? camPos.distanceTo(pl.pivot.getWorldPosition(this._v)) < 34 : false; }
      if (!show) { L.el.style.display = 'none'; continue; }
      n.mesh.getWorldPosition(this._v).project(camera);
      if (this._v.z > 1) { L.el.style.display = 'none'; continue; }
      const x = (this._v.x * 0.5 + 0.5) * w, y = (-this._v.y * 0.5 + 0.5) * h;
      if (x < -60 || x > w + 60 || y < -20 || y > h + 20) { L.el.style.display = 'none'; continue; }
      L.el.style.display = ''; L.el.style.transform = `translate(${x}px, ${y}px)`;
    }
  }

  // Raycast the body meshes; returns a node index or -1.
  pick(ray) {
    const meshes = this.nodes.map((n) => n.mesh);
    const hits = ray.intersectObjects(meshes, false);
    return hits.length ? hits[0].object.userData.node : -1;
  }

  worldPos(i, out = new THREE.Vector3()) { return this.nodes[i] ? this.nodes[i].mesh.getWorldPosition(out) : out.set(0, 0, 0); }

  // Info for the panel: name, kind, facts + orbital / physical figures.
  info(i) {
    const n = this.nodes[i]; if (!n) return null;
    const out = { name: n.name, kind: n.kind, facts: n.facts, moonOf: n.moonOf };
    if (n.orbit) { out.a = n.orbit.a; out.e = n.orbit.e; out.inc = n.orbit.inc; out.period = n.orbit.period; out.radiusKm = n.orbit.r; out.moons = (n.orbit.moons || []).length; out.color = n.orbit.color; }
    if (n.kind === 'star') { out.radiusKm = SUN.r; out.color = SUN.color; }
    if (n.kind === 'moon') out.color = [0.81, 0.83, 0.86];
    return out;
  }

  // A framing that shows the planets out to roughly Neptune.
  defaultView() { return { pos: new THREE.Vector3(0, -30 * AU * 1.5, 30 * AU * 1.05), target: new THREE.Vector3(0, 0, 0) }; }

  dispose() { this.layer.remove(); }
}

// A soft radial glow sprite for the Sun.
function makeGlow() {
  const s = 128, c = document.createElement('canvas'); c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.25, 'rgba(255,220,150,0.6)');
  g.addColorStop(0.6, 'rgba(255,180,90,0.15)'); g.addColorStop(1, 'rgba(255,160,80,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
