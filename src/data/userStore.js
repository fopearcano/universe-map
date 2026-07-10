// Persistent store for user-contributed atlas objects, saved to localStorage so
// they survive a page reload (they do NOT reset on restart). Two kinds:
//   'imagined'   — hypothetical objects/events authored for story-crafting
//   'discovered' — real objects pulled in live from SIMBAD at runtime
// Supports export/import (JSON) so a library can be backed up, shared or provided.
const KEY = 'universe-map/custom-objects/v1';

export class UserStore {
  constructor() { this.objects = this._read(); }

  _read() {
    try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : []; }
    catch { return []; }
  }
  _write() {
    try { localStorage.setItem(KEY, JSON.stringify(this.objects)); } catch { /* quota / private mode */ }
  }

  all() { return this.objects; }
  get(id) { return this.objects.find((o) => o.id === id); }

  add(obj) {
    const id = obj.id || 'u' + Date.now().toString(36) + Math.floor(performance.now() % 1000);
    const rec = { id, createdAt: Date.now(), kind: 'imagined', source: 'user', ...obj };
    this.objects.push(rec);
    this._write();
    return rec;
  }
  update(id, patch) {
    const o = this.get(id); if (!o) return null;
    Object.assign(o, patch);
    this._write();
    return o;
  }
  remove(id) {
    const n = this.objects.length;
    this.objects = this.objects.filter((o) => o.id !== id);
    if (this.objects.length !== n) this._write();
  }
  clear(kind) {
    this.objects = kind ? this.objects.filter((o) => o.kind !== kind) : [];
    this._write();
  }

  export() { return JSON.stringify({ format: 'universe-map/custom', version: 1, objects: this.objects }, null, 2); }

  // Merge an imported library; returns the number of records added.
  import(json, { replace = false } = {}) {
    let data;
    try { data = typeof json === 'string' ? JSON.parse(json) : json; } catch { return { ok: false, note: 'invalid JSON' }; }
    const list = Array.isArray(data) ? data : (data.objects || []);
    if (!Array.isArray(list)) return { ok: false, note: 'no objects array found' };
    if (replace) this.objects = [];
    const existing = new Set(this.objects.map((o) => o.id));
    let added = 0;
    for (const raw of list) {
      if (typeof raw?.name !== 'string') continue;
      const rec = {
        id: raw.id && !existing.has(raw.id) ? raw.id : 'i' + Date.now().toString(36) + (added++),
        kind: raw.kind === 'discovered' ? 'discovered' : 'imagined',
        source: raw.source || 'import', createdAt: raw.createdAt || Date.now(),
        name: raw.name, category: raw.category || 'fictional', type: raw.type || '',
        ra: +raw.ra || 0, dec: +raw.dec || 0, distLy: +raw.distLy || 0, facts: raw.facts || '',
      };
      existing.add(rec.id);
      this.objects.push(rec);
    }
    this._write();
    return { ok: true, added: list.length };
  }
}
