// Persistent store for named navigation routes (localStorage). A route is stored
// portably as a list of waypoints in sky coordinates (ra hours, dec deg, distance
// ly) plus a label/kind, so it can be reconstructed in either display mode.
const KEY = 'universe-map/routes/v1';

export class RouteStore {
  constructor() { this.routes = this._read(); }
  _read() { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : []; } catch { return []; } }
  _write() { try { localStorage.setItem(KEY, JSON.stringify(this.routes)); } catch { /* ignore */ } }

  all() { return this.routes; }
  get(id) { return this.routes.find((r) => r.id === id); }

  save(name, waypoints, cruiseC) {
    const id = 'r' + Date.now().toString(36) + Math.floor(performance.now() % 1000);
    const rec = { id, name: name || 'route', createdAt: Date.now(), cruiseC: cruiseC || 0.1, waypoints };
    this.routes.push(rec); this._write();
    return rec;
  }
  remove(id) { this.routes = this.routes.filter((r) => r.id !== id); this._write(); }

  export() { return JSON.stringify({ format: 'universe-map/routes', version: 1, routes: this.routes }, null, 2); }
  import(json) {
    let data; try { data = typeof json === 'string' ? JSON.parse(json) : json; } catch { return { ok: false, note: 'invalid JSON' }; }
    const list = Array.isArray(data) ? data : (data.routes || []);
    if (!Array.isArray(list)) return { ok: false, note: 'no routes array' };
    let added = 0;
    for (const r of list) {
      if (!Array.isArray(r?.waypoints)) continue;
      this.routes.push({ id: 'i' + Date.now().toString(36) + (added++), name: r.name || 'route', createdAt: r.createdAt || Date.now(), cruiseC: r.cruiseC || 0.1, waypoints: r.waypoints });
    }
    this._write();
    return { ok: true, added };
  }
}
