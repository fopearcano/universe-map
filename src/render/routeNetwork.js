import * as THREE from 'three';

// The "Ledger of Ways" overlay: charted commercial & military routes drawn as a
// colour-coded line network in cosmos display space. Routes are bucketed by
// category+group ("commercial:trade", "military:war", …) so each thematic group
// can be toggled independently (amber = commercial, crimson = military). Small
// nodes mark the waypoints; a single bright line highlights a selected route.
const CAT_COLOR = { commercial: 0xffb454, military: 0xff6b6b };

export class RouteNetwork {
  constructor(routes) {
    this.routes = routes;               // [{ id, category, group, positions:[Vector3], ... }]
    this.group = new THREE.Group();
    this.group.visible = false;
    this.buckets = {};                  // "cat:group" -> { seg, pts, cat }
    this.filter = {};                   // "cat:group" -> bool

    const byKey = {};
    for (const r of routes) (byKey[`${r.category}:${r.group || 'other'}`] ||= []).push(r);
    for (const key in byKey) {
      const cat = key.slice(0, key.indexOf(':'));
      const verts = [], nodes = [];
      for (const r of byKey[key]) {
        const p = r.positions;
        for (let i = 0; i < p.length; i++) { nodes.push(p[i].x, p[i].y, p[i].z); if (i < p.length - 1) verts.push(p[i].x, p[i].y, p[i].z, p[i + 1].x, p[i + 1].y, p[i + 1].z); }
      }
      const lgeo = new THREE.BufferGeometry(); lgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
      const seg = new THREE.LineSegments(lgeo, new THREE.LineBasicMaterial({ color: CAT_COLOR[cat] || 0xffffff, transparent: true, opacity: 0.16, depthWrite: false })); seg.frustumCulled = false;
      const ngeo = new THREE.BufferGeometry(); ngeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nodes), 3));
      const pts = new THREE.Points(ngeo, new THREE.PointsMaterial({ color: CAT_COLOR[cat] || 0xffffff, size: 3, sizeAttenuation: false, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending })); pts.frustumCulled = false;
      this.buckets[key] = { seg, pts, cat };
      this.filter[key] = true;
      this.group.add(seg); this.group.add(pts);
    }

    // bright highlight for one selected route (rebuilt on demand)
    this.hi = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }));
    this.hi.frustumCulled = false; this.hi.visible = false; this.hi.renderOrder = 3;
    this.group.add(this.hi);
  }

  setVisible(v) { this.group.visible = !!v; this._apply(); }
  // Toggle one group ("cat:group") or a whole category (pass the bare category).
  setGroupVisible(key, on) {
    if (key in this.filter) this.filter[key] = !!on;
    else for (const k in this.filter) { if (k.slice(0, k.indexOf(':')) === key) this.filter[k] = !!on; } // category-wide
    this._apply();
  }
  setCategoryVisible(cat, on) { for (const k in this.filter) if (k.slice(0, k.indexOf(':')) === cat) this.filter[k] = !!on; this._apply(); }
  _apply() {
    for (const key in this.buckets) { const on = this.group.visible && this.filter[key]; this.buckets[key].seg.visible = on; this.buckets[key].pts.visible = on; }
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
