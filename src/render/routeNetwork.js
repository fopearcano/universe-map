import * as THREE from 'three';

// The "Ledger of Ways" overlay: charted commercial & military routes drawn as a
// colour-coded line network in cosmos display space. All routes of a category merge
// into one LineSegments draw call (amber = commercial, crimson = military); small
// nodes mark the waypoints; a single bright line highlights a selected route.
const CAT_COLOR = { commercial: 0xffb454, military: 0xff6b6b };

export class RouteNetwork {
  constructor(routes) {
    this.routes = routes;               // [{ id, category, positions:[Vector3], ... }]
    this.group = new THREE.Group();
    this.group.visible = false;
    this.filter = { commercial: true, military: true };

    this.byCat = {};
    for (const cat of ['commercial', 'military']) {
      const verts = [], nodes = [];
      for (const r of routes) {
        if (r.category !== cat) continue;
        const p = r.positions;
        for (let i = 0; i < p.length; i++) { nodes.push(p[i].x, p[i].y, p[i].z); if (i < p.length - 1) verts.push(p[i].x, p[i].y, p[i].z, p[i + 1].x, p[i + 1].y, p[i + 1].z); }
      }
      const lgeo = new THREE.BufferGeometry(); lgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
      const lmat = new THREE.LineBasicMaterial({ color: CAT_COLOR[cat], transparent: true, opacity: 0.16, depthWrite: false });
      const seg = new THREE.LineSegments(lgeo, lmat); seg.frustumCulled = false;
      const ngeo = new THREE.BufferGeometry(); ngeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nodes), 3));
      const nmat = new THREE.PointsMaterial({ color: CAT_COLOR[cat], size: 3, sizeAttenuation: false, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending });
      const pts = new THREE.Points(ngeo, nmat); pts.frustumCulled = false;
      this.byCat[cat] = { seg, pts };
      this.group.add(seg); this.group.add(pts);
    }

    // bright highlight for one selected route (rebuilt on demand)
    this.hi = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }));
    this.hi.frustumCulled = false; this.hi.visible = false; this.hi.renderOrder = 3;
    this.group.add(this.hi);
  }

  setVisible(v) { this.group.visible = !!v; this._apply(); }
  setFilter(cat, on) { if (cat in this.filter) { this.filter[cat] = !!on; this._apply(); } }
  _apply() {
    for (const cat in this.byCat) { const on = this.group.visible && this.filter[cat]; this.byCat[cat].seg.visible = on; this.byCat[cat].pts.visible = on; }
    if (!this.group.visible) this.hi.visible = false;
  }

  highlight(id) {
    const r = this.routes.find((x) => x.id === id);
    this.hi.geometry.dispose();
    if (!r) { this.hi.visible = false; return; }
    this.hi.geometry = new THREE.BufferGeometry().setFromPoints(r.positions);
    this.hi.material.color.setHex(CAT_COLOR[r.category] || 0xffffff);
    this.hi.visible = this.group.visible;
  }
  clearHighlight() { this.hi.visible = false; }
}
