// Loads the QTR "Immeasurable Spaces" universe database (a linked knowledge base
// + a 2D conceptual map). Indexes records by id and type and resolves link edges,
// so the Codex browser can navigate the graph.
const BASE = import.meta.env.BASE_URL || '/';
const url = (p) => `${BASE}data/${p}`.replace(/([^:])\/\/+/g, '$1/');

export class QtrData {
  constructor() { this.loaded = false; this.records = []; this.byId = new Map(); this.byType = new Map(); this.mapNodes = []; this.mapEdges = []; this.layers = []; this.meta = null; }

  async load() {
    let db;
    try { db = await fetch(url('qtr-universe-db.json')).then((r) => (r.ok ? r.json() : null)); } catch { db = null; }
    if (!db) { this.loaded = false; return this; }
    this.meta = db.meta || {};
    this.layers = db.layers || [];
    this.schema = db.schema || {};
    this.mapEdges = db.map_edges || [];
    // merge entities + events into one record set
    this.records = [...(db.entities || []), ...(db.events || [])];
    for (const r of this.records) {
      this.byId.set(r.id, r);
      if (!this.byType.has(r.type)) this.byType.set(r.type, []);
      this.byType.get(r.type).push(r);
    }
    this.mapNodes = this.records.filter((r) => r.type === 'map_node' && r.coords);
    this.loaded = true;
    return this;
  }

  get(id) { return this.byId.get(id); }
  types() { return [...this.byType.keys()].sort(); }
  ofType(t) { return this.byType.get(t) || []; }
  count() { return this.records.length; }

  // grouped, resolved links for a record: { rel: [{id, name, type}] }
  linksOf(rec) {
    const groups = {};
    for (const l of rec.links || []) {
      const t = this.get(l.target);
      (groups[l.rel] ||= []).push({ id: l.target, name: t ? t.name : l.target, type: t ? t.type : '?' });
    }
    return groups;
  }
}
