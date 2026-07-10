// A uniform 3-D grid for fast nearest-ray picking over very large point sets
// (million-star galaxy interiors). Points are bucketed into cells (CSR layout);
// a pick marches the ray through the grid's cells and only tests points in the
// thin tube of cells around the ray line, instead of scanning every point.
export class SpatialGrid {
  constructor(positions, count, { cells = 48 } = {}) {
    this.positions = positions;
    this.count = count;
    let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
    for (let i = 0; i < count; i++) {
      const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
      if (x < minx) minx = x; if (y < miny) miny = y; if (z < minz) minz = z;
      if (x > maxx) maxx = x; if (y > maxy) maxy = y; if (z > maxz) maxz = z;
    }
    const pad = Math.max(1e-3, (maxx - minx + maxy - miny + maxz - minz) * 1e-4);
    this.min = [minx - pad, miny - pad, minz - pad];
    this.size = [maxx - minx + 2 * pad, maxy - miny + 2 * pad, maxz - minz + 2 * pad];
    this.nx = cells; this.ny = cells; this.nz = cells;
    this.cell = [this.size[0] / this.nx || 1, this.size[1] / this.ny || 1, this.size[2] / this.nz || 1];
    const NC = this.nx * this.ny * this.nz;

    // counting sort of point indices into cells (CSR: start[] + items[])
    const cellIdx = new Int32Array(count);
    const start = new Uint32Array(NC + 1);
    for (let i = 0; i < count; i++) { const ci = this._cellOfPoint(i); cellIdx[i] = ci; start[ci + 1]++; }
    for (let c = 0; c < NC; c++) start[c + 1] += start[c];
    const items = new Uint32Array(count);
    const cursor = start.slice(0, NC);
    for (let i = 0; i < count; i++) { const ci = cellIdx[i]; items[cursor[ci]++] = i; }
    this.start = start; this.items = items;
    this._gen = new Int32Array(NC); this._g = 0; // visited stamps (avoid per-pick clear)
  }

  _clampCell(cx, cy, cz) {
    cx = cx < 0 ? 0 : cx >= this.nx ? this.nx - 1 : cx;
    cy = cy < 0 ? 0 : cy >= this.ny ? this.ny - 1 : cy;
    cz = cz < 0 ? 0 : cz >= this.nz ? this.nz - 1 : cz;
    return [cx, cy, cz];
  }
  _cellOfPoint(i) {
    const [cx, cy, cz] = this._clampCell(
      ((this.positions[i * 3] - this.min[0]) / this.cell[0]) | 0,
      ((this.positions[i * 3 + 1] - this.min[1]) / this.cell[1]) | 0,
      ((this.positions[i * 3 + 2] - this.min[2]) / this.cell[2]) | 0);
    return (cz * this.ny + cy) * this.nx + cx;
  }
  _rayBox(o, d) {
    let tmin = -Infinity, tmax = Infinity;
    const oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
    for (let a = 0; a < 3; a++) {
      const mn = this.min[a], mx = this.min[a] + this.size[a];
      if (Math.abs(dd[a]) < 1e-9) { if (oo[a] < mn || oo[a] > mx) return null; }
      else {
        let t1 = (mn - oo[a]) / dd[a], t2 = (mx - oo[a]) / dd[a];
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return null;
      }
    }
    return { tmin, tmax };
  }

  // nearest-ray pick; returns point index or -1
  pick(raycaster, camera, thresholdPx = 14) {
    const o = raycaster.ray.origin, d = raycaster.ray.direction;
    const maxAng = thresholdPx * ((camera.fov * Math.PI / 180) / window.innerHeight);
    const tr = this._rayBox(o, d);
    if (!tr) return -1;
    const pos = this.positions;
    let best = -1, bestAng = maxAng;
    const g = ++this._g;
    const testCell = (ci) => {
      if (this._gen[ci] === g) return; this._gen[ci] = g;
      for (let k = this.start[ci]; k < this.start[ci + 1]; k++) {
        const i = this.items[k];
        const px = pos[i * 3] - o.x, py = pos[i * 3 + 1] - o.y, pz = pos[i * 3 + 2] - o.z;
        const t = px * d.x + py * d.y + pz * d.z; if (t <= 0) continue;
        const ang = Math.sqrt(Math.max(0, (px * px + py * py + pz * pz) - t * t)) / t;
        if (ang < bestAng) { best = i; bestAng = ang; }
      }
    };
    const step = Math.min(this.cell[0], this.cell[1], this.cell[2]) * 0.75;
    let t = Math.max(0, tr.tmin);
    const tmax = tr.tmax + step;
    while (t <= tmax) {
      const [cx, cy, cz] = this._clampCell(
        ((o.x + d.x * t - this.min[0]) / this.cell[0]) | 0,
        ((o.y + d.y * t - this.min[1]) / this.cell[1]) | 0,
        ((o.z + d.z * t - this.min[2]) / this.cell[2]) | 0);
      for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const ax = cx + dx, ay = cy + dy, az = cz + dz;
        if (ax < 0 || ay < 0 || az < 0 || ax >= this.nx || ay >= this.ny || az >= this.nz) continue;
        testCell((az * this.ny + ay) * this.nx + ax);
      }
      t += step;
    }
    return best;
  }
}
