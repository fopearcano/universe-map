import * as THREE from 'three';

// Projects world-space anchor points to screen and positions HTML labels over them.
// Handles three layers: static reference labels (rings/axes), bright-star name
// labels (overlap-culled by priority), and voyage waypoint labels.
export class Labels {
  constructor(container) {
    this.layer = document.createElement('div');
    this.layer.id = 'labels';
    Object.assign(this.layer.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '4', overflow: 'hidden' });
    container.appendChild(this.layer);
    this.groups = { static: [], stars: [], voyage: [] };
    this._v = new THREE.Vector3();
    this.showStars = true;
  }

  _make(cls, text) {
    const el = document.createElement('div');
    el.className = 'map-label ' + cls;
    el.textContent = text;
    this.layer.appendChild(el);
    return el;
  }

  setStatic(items) {
    this._clear('static');
    this.groups.static = items.map((it) => ({ pos: it.pos.clone(), el: this._make(it.cls || 'lbl-ref', it.text), prio: 100 }));
  }

  // items: [{ pos: Vector3, text, prio }]
  setStars(items) {
    this._clear('stars');
    this.groups.stars = items.map((it) => ({ pos: it.pos.clone(), el: this._make('lbl-star', it.text), prio: it.prio ?? 0 }));
  }

  setVoyage(items) {
    this._clear('voyage');
    this.groups.voyage = (items || []).map((it) => ({ pos: it.pos.clone(), el: this._make('lbl-voyage', it.text), prio: 50 }));
  }

  _clear(key) {
    for (const l of this.groups[key]) l.el.remove();
    this.groups[key] = [];
  }

  setStarsVisible(v) {
    this.showStars = v;
    for (const l of this.groups.stars) l.el.style.display = v ? '' : 'none';
  }

  update(camera) {
    const w = window.innerWidth, h = window.innerHeight;
    const placed = []; // for overlap culling of star labels
    const project = (l) => {
      this._v.copy(l.pos).project(camera);
      if (this._v.z > 1) return null;
      const x = (this._v.x * 0.5 + 0.5) * w;
      const y = (-this._v.y * 0.5 + 0.5) * h;
      if (x < -80 || x > w + 80 || y < -30 || y > h + 30) return null;
      return { x, y };
    };

    for (const l of [...this.groups.static, ...this.groups.voyage]) {
      const s = project(l);
      if (!s) { l.el.style.display = 'none'; continue; }
      l.el.style.display = '';
      l.el.style.transform = `translate(${s.x}px, ${s.y}px)`;
    }

    if (this.showStars) {
      const items = this.groups.stars
        .map((l) => ({ l, s: project(l) }))
        .filter((o) => o.s)
        .sort((a, b) => b.l.prio - a.l.prio);
      for (const { l, s } of items) {
        let ok = true;
        for (const p of placed) {
          if (Math.abs(p.x - s.x) < 78 && Math.abs(p.y - s.y) < 15) { ok = false; break; }
        }
        if (!ok) { l.el.style.display = 'none'; continue; }
        placed.push(s);
        l.el.style.display = '';
        l.el.style.transform = `translate(${s.x}px, ${s.y}px)`;
      }
    }
  }
}
