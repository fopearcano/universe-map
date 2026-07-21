import * as THREE from 'three';

// Renders the "Ways of the Deep" as an organic, colour-coded line network — each
// route drawn in its trunk's hue so the whole overlay fans out from the home
// supergalaxy like a branching topology map. Routes are bucketed by ORDER (guild)
// so groups can be toggled; a single bright line highlights a selected way. The
// same class also draws the smaller intra-galaxy route network inside a galaxy.
export class DeeptimeRoutes {
  constructor(routes = []) {
    this.routes = routes;                 // [{ id, order, color:[r,g,b], positions:[[x,y,z]] }]
    this.group = new THREE.Group();
    this.group.visible = false;
    this.orderOn = {};                    // order key -> bool
    for (const r of routes) this.orderOn[r.order] = true;

    // normal (not additive) blending keeps each trunk's HUE pure where routes cross,
    // so the network reads as distinct colour-coded branches instead of washing white
    this.lines = new THREE.LineSegments(new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.62, depthWrite: false }));
    this.lines.frustumCulled = false;
    this.nodes = new THREE.Points(new THREE.BufferGeometry(),
      new THREE.PointsMaterial({ vertexColors: true, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.nodes.frustumCulled = false;
    this.group.add(this.lines); this.group.add(this.nodes);

    this.hi = new THREE.Line(new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }));
    this.hi.frustumCulled = false; this.hi.visible = false; this.hi.renderOrder = 4;
    this.group.add(this.hi);

    this._rebuild();
  }

  _rebuild() {
    const lp = [], lc = [], np = [], nc = [];
    for (const r of this.routes) {
      if (this.orderOn[r.order] === false) continue;
      const p = r.positions, c = r.color;
      for (let i = 0; i < p.length; i++) {
        np.push(p[i][0], p[i][1], p[i][2]); nc.push(c[0], c[1], c[2]);
        if (i < p.length - 1) {
          lp.push(p[i][0], p[i][1], p[i][2], p[i + 1][0], p[i + 1][1], p[i + 1][2]);
          lc.push(c[0], c[1], c[2], c[0], c[1], c[2]);
        }
      }
    }
    const lg = this.lines.geometry; lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); lg.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3));
    const ng = this.nodes.geometry; ng.setAttribute('position', new THREE.Float32BufferAttribute(np, 3)); ng.setAttribute('color', new THREE.Float32BufferAttribute(nc, 3));
    lg.attributes.position.needsUpdate = true;
  }

  setVisible(v) { this.group.visible = !!v; if (!v) this.hi.visible = false; }
  setOrderVisible(order, on) { if (order in this.orderOn) { this.orderOn[order] = !!on; this._rebuild(); } }
  orderState() { return { ...this.orderOn }; }

  highlight(id) {
    const r = this.routes.find((x) => x.id === id);
    this.hi.geometry.dispose();
    if (!r) { this.hi.visible = false; return; }
    this.hi.geometry = new THREE.BufferGeometry().setFromPoints(r.positions.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    this.hi.material.color.setRGB(Math.min(1, r.color[0] + 0.4), Math.min(1, r.color[1] + 0.4), Math.min(1, r.color[2] + 0.4));
    this.hi.visible = this.group.visible;
  }
  clearHighlight() { this.hi.visible = false; }

  dispose() {
    this.lines.geometry.dispose(); this.lines.material.dispose();
    this.nodes.geometry.dispose(); this.nodes.material.dispose();
    this.hi.geometry.dispose(); this.hi.material.dispose();
  }
}
