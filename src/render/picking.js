import * as THREE from 'three';

// Pick the visible star closest to the cursor ray. With 100k points a GPU id-buffer
// is overkill: a single linear scan projecting each point onto the ray and keeping
// the smallest angular offset runs in ~1-2 ms and is exact. We compare angular
// offset (perpendicular distance / depth) so near and far stars are judged fairly,
// and accept a hit only within a screen-pixel threshold of the cursor.
export class Picker {
  constructor(catalog, starfield, camera) {
    this.catalog = catalog;
    this.starfield = starfield;
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this._p = new THREE.Vector3();
    this._proj = new THREE.Vector3();
  }

  // ndc: {x, y} in [-1, 1]. Returns star index or -1.
  pick(ndc, thresholdPx = 14) {
    this.raycaster.setFromCamera(ndc, this.camera);
    const ray = this.raycaster.ray;
    const origin = ray.origin, dir = ray.direction;
    const c = this.catalog, pos = c.positions;
    const fovY = (this.camera.fov * Math.PI) / 180;
    const angPerPx = fovY / window.innerHeight;
    const maxAng = thresholdPx * angPerPx;

    let best = -1, bestAng = maxAng, bestDepth = Infinity;
    const p = this._p;
    for (let i = 0; i < c.count; i++) {
      if (!this.starfield.isVisible(i)) continue;
      p.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).sub(origin);
      const t = p.dot(dir);            // depth along ray
      if (t <= 0) continue;            // behind camera
      const perp = Math.sqrt(Math.max(0, p.lengthSq() - t * t));
      const ang = perp / t;
      if (ang < bestAng || (ang < maxAng && Math.abs(ang - bestAng) < 1e-6 && t < bestDepth)) {
        best = i; bestAng = ang; bestDepth = t;
      }
    }
    return best;
  }
}
