import * as THREE from 'three';
import { Scene } from './render/scene.js';
import { Starfield } from './render/starfield.js';
import { Picker } from './render/picking.js';
import { Labels } from './render/labels.js';
import { VoyageLayer } from './render/voyagePath.js';
import { CosmosWorld } from './render/cosmos.js';
import { MarkerLayer, pickPositions, makeRingTexture, makeSparkleTexture } from './render/markers.js';
import { PC_TO_LY, cartesianToRaDec } from './util/astro.js';
import { UserStore } from './data/userStore.js';
import { RouteStore } from './data/routeStore.js';
import { resolveSimbad } from './data/remote.js';

// marker colours by type
const MARK_COLOR = {
  open: [0.6, 0.82, 1.0], globular: [1.0, 0.82, 0.42],
  cluster: [1.0, 0.45, 0.85], supercluster: [1.0, 0.62, 0.32], attractor: [1.0, 0.42, 0.42],
  wall: [0.55, 1.0, 0.66], void: [0.62, 0.66, 0.78],
};

// Central application state. Two modes share one renderer/camera/HUD chrome:
//   local  — the true-scale stellar neighbourhood (parsecs, Sol at origin)
//   cosmos — the whole observable universe on a logarithmic radial scale
export class App {
  constructor(canvas, catalog, cosmosData, extras = { clusters: [], structures: [] }) {
    this.catalog = catalog;
    this.cosmosData = cosmosData;
    this.extras = extras;
    this.scene = new Scene(canvas);
    this.mode = 'local';

    // local world
    this.starfield = new Starfield(catalog);
    this.scene.scene.add(this.starfield.points);
    this.starPicker = new Picker(catalog, this.starfield, this.scene.camera);
    this.voyageLayer = new VoyageLayer(this.scene.scene);

    // cosmos world
    this.cosmos = cosmosData ? new CosmosWorld(this.scene.scene, cosmosData, catalog) : null;

    this.labels = new Labels(document.body);
    this.selection = null;      // { kind, worldPos, starIndex?, info }
    this.voyage = null;         // { source, def, index }
    this.focus = null;          // { worldPos, truePos, label }
    this.route = [];            // [{ worldPos, truePos, label, kind }]
    this.cruiseSpeed = 0.1;     // cruise velocity as a fraction of c
    this.plotCourse = false;    // click-to-add-waypoint mode
    this.autopilot = null;      // active flythrough state
    this.routeStore = new RouteStore();
    this._listeners = {};
    this._clock = new THREE.Clock();
    this._telAcc = 0;
    this._hover = { need: false, x: 0, y: 0, last: 0, key: '' };
    this._selmark = document.getElementById('selmark');
    this._v = new THREE.Vector3();
    this._ray = new THREE.Raycaster();
    this._bloom = null;

    this.userStore = new UserStore();
    this._sparkle = makeSparkleTexture('#ffffff');
    this.showCustom = true;
    this.localCustom = null; this.cosmosCustom = null;

    this._buildMarkers();
    this._buildRouteLayer();
    this._rebuildCustom();
    this._applyLocalLabels();
    this._bindPointer(canvas);
  }

  // ---- user-contributed objects (imagined + live-discovered), persisted ----
  _customGeom(o) {
    const distPc = Math.max((o.distLy || 0) * (1 / PC_TO_LY), 0.001);
    const ra = o.ra * 15 * Math.PI / 180, dec = o.dec * Math.PI / 180, cd = Math.cos(dec);
    const dir = [cd * Math.cos(ra), cd * Math.sin(ra), Math.sin(dec)];
    const D = this.cosmos ? this.cosmos.decadeUnit : 3;
    return { dir, distPc, pos: [dir[0] * distPc, dir[1] * distPc, dir[2] * distPc], displayR: D * Math.log10(Math.max(distPc, 1)) };
  }

  _rebuildCustom() {
    for (const layer of [this.localCustom, this.cosmosCustom]) {
      if (layer) { (layer === this.localCustom ? this.scene.scene : this.cosmos.group).remove(layer.points); layer.points.geometry.dispose(); layer.points.material.dispose(); }
    }
    const objs = this.userStore.all();
    const localMax = this.catalog.meta.bounds.maxRadiusPc;
    const colorFor = (o) => o.kind === 'imagined' ? [1.0, 0.36, 0.94] : (this.atlasCategories[o.category]?.color || [0.5, 1.0, 0.62]);
    const localItems = [], cosmosItems = [];
    for (const o of objs) {
      const g = this._customGeom(o);
      const color = colorFor(o);
      cosmosItems.push({ pos: new THREE.Vector3(...g.dir).multiplyScalar(g.displayR), color, label: o.name, data: { id: o.id } });
      if (Math.hypot(g.pos[0], g.pos[1], g.pos[2]) <= localMax * 1.02)
        localItems.push({ pos: new THREE.Vector3(g.pos[0], g.pos[1], g.pos[2]), color, label: o.name, data: { id: o.id } });
    }
    this.localCustom = new MarkerLayer(localItems, { size: 14, ring: this._sparkle });
    this.cosmosCustom = new MarkerLayer(cosmosItems, { size: 14, ring: this._sparkle });
    this.scene.scene.add(this.localCustom.points);
    if (this.cosmos) this.cosmos.group.add(this.cosmosCustom.points);
    this.localCustom.setVisible(this.showCustom && this.mode === 'local');
    this.cosmosCustom.setVisible(this.showCustom && this.mode === 'cosmos');
  }

  addCustomObject(obj) { const rec = this.userStore.add(obj); this._rebuildCustom(); this.emit('custom', this.userStore.all()); return rec; }
  updateCustomObject(id, patch) { const r = this.userStore.update(id, patch); this._rebuildCustom(); this.emit('custom', this.userStore.all()); if (this.selection?.customId === id) this.selectCustom(id); return r; }
  removeCustomObject(id) { this.userStore.remove(id); if (this.selection?.customId === id) this.clearSelection(); this._rebuildCustom(); this.emit('custom', this.userStore.all()); }
  clearCustom(kind) { this.userStore.clear(kind); this.clearSelection(); this._rebuildCustom(); this.emit('custom', this.userStore.all()); }
  exportCustom() { return this.userStore.export(); }
  importCustom(json, opts) { const r = this.userStore.import(json, opts); this._rebuildCustom(); this.emit('custom', this.userStore.all()); return r; }

  async resolveAndAdd(name) {
    const res = await resolveSimbad(name);
    if (!res.ok) return res;
    const o = res.object;
    const rec = this.addCustomObject({
      kind: 'discovered', source: 'SIMBAD', name: o.name, category: o.category,
      type: o.otype || 'object', ra: o.ra, dec: o.dec, distLy: o.distLy || 0,
      facts: `Resolved live from SIMBAD${o.spType ? ` · spectral type ${o.spType}` : ''}${o.distNote && o.distNote !== 'unknown' ? ` · distance from ${o.distNote}` : ' · distance unknown'}.`,
    });
    this.selectCustom(rec.id, { fly: true });
    return { ok: true, rec };
  }

  selectCustom(id, { fly = false } = {}) {
    const o = this.userStore.get(id); if (!o) return;
    const g = this._customGeom(o);
    const worldPos = this.mode === 'cosmos'
      ? new THREE.Vector3(...g.dir).multiplyScalar(g.displayR)
      : new THREE.Vector3(g.pos[0], g.pos[1], g.pos[2]);
    const cat = this.atlasCategories[o.category];
    const info = {
      kind: 'custom', customId: id, custKind: o.kind, name: o.name,
      categoryLabel: o.kind === 'imagined' ? 'imagined' : (cat ? cat.label : o.category),
      type: o.type, facts: o.facts, distLy: o.distLy, ra: o.ra, dec: o.dec, source: o.source,
      color: o.kind === 'imagined' ? [1, 0.36, 0.94] : (cat?.color || [0.5, 1, 0.62]),
    };
    const truePos = new THREE.Vector3(...g.dir).multiplyScalar(g.distPc);
    this._setSelection({ kind: 'custom', customId: id, worldPos: worldPos.clone(), truePos, info });
    if (fly) this.scene.flyTo(worldPos);
  }

  // ---- clusters & large-scale structures ----
  _buildMarkers() {
    const D = this.cosmos ? this.cosmos.decadeUnit : 3;
    const localMax = this.catalog.meta.bounds.maxRadiusPc;
    const ringOpen = makeRingTexture('#ffffff', true);
    const mk = (it, pos, color, prio) => ({ pos, color, label: it.name, prio, data: it });

    // LOCAL: clusters within the true-scale range, placed by real parsec position
    const localItems = this.extras.clusters.filter((c) => c.distPc <= localMax * 1.02)
      .map((c) => mk(c, new THREE.Vector3(c.pos[0], c.pos[1], c.pos[2]), MARK_COLOR[c.type] || [1, 1, 1], 8));
    this.localClusters = new MarkerLayer(localItems, { size: 12, ring: ringOpen });
    this.scene.scene.add(this.localClusters.points);
    this.localClusters.setVisible(true);

    // COSMOS: all clusters + structures, placed on the log-radial scale
    const cItems = this.extras.clusters.map((c) => mk(c, new THREE.Vector3(...c.dir).multiplyScalar(c.displayR), MARK_COLOR[c.type] || [1, 1, 1], 6));
    this.cosmosClusters = new MarkerLayer(cItems, { size: 11, ring: ringOpen });
    const sItems = this.extras.structures.map((s) => mk(s, new THREE.Vector3(...s.dir).multiplyScalar(s.displayR), MARK_COLOR[s.type] || [1, 1, 1], 9));
    this.cosmosStructures = new MarkerLayer(sItems, { size: 18, ring: makeRingTexture('#ffffff', false) });
    if (this.cosmos) { this.cosmos.group.add(this.cosmosClusters.points); this.cosmos.group.add(this.cosmosStructures.points); }
    this.showClusters = true; this.showStructures = true;

    // Cosmic Atlas — curated knowledge-base objects, coloured by category
    this.atlas = (this.extras.atlas && this.extras.atlas.objects) || [];
    this.atlasCategories = (this.extras.atlas && this.extras.atlas.categories) || {};
    const atlasRing = makeRingTexture('#ffffff', true);
    const localAtlasItems = [];
    this.atlas.forEach((o, i) => {
      if (Math.hypot(o.pos[0], o.pos[1], o.pos[2]) <= localMax * 1.02)
        localAtlasItems.push({ pos: new THREE.Vector3(o.pos[0], o.pos[1], o.pos[2]), color: o.color, label: o.name, prio: 7, data: { atlasIndex: i } });
    });
    this.localAtlas = new MarkerLayer(localAtlasItems, { size: 11, ring: atlasRing });
    this.scene.scene.add(this.localAtlas.points);
    const cosmosAtlasItems = this.atlas.map((o, i) => ({ pos: new THREE.Vector3(...o.dir).multiplyScalar(o.displayR), color: o.color, label: o.name, prio: 7, data: { atlasIndex: i } }));
    this.cosmosAtlas = new MarkerLayer(cosmosAtlasItems, { size: 11, ring: atlasRing });
    if (this.cosmos) this.cosmos.group.add(this.cosmosAtlas.points);
    this.showAtlas = true;
  }

  _buildRouteLayer() {
    this.routeGroup = new THREE.Group();
    this.scene.scene.add(this.routeGroup);
    this._routeRing = makeRingTexture('#7bf0a0', true);
  }

  on(evt, cb) { (this._listeners[evt] ||= []).push(cb); return this; }
  emit(evt, ...a) { (this._listeners[evt] || []).forEach((cb) => cb(...a)); }

  // ================= mode switching =================
  setMode(mode) {
    if (mode === this.mode) return;
    this.stopVoyage();
    this.clearSelection();
    this.clearRoute();
    this.clearFocus();
    this.mode = mode;
    if (mode === 'cosmos') {
      this.starfield.points.visible = false;
      this.scene.setReferenceVisible(false);
      this.voyageLayer.setVisible(false);
      this.localClusters.setVisible(false);
      this.localAtlas.setVisible(false);
      this.cosmos.setVisible(true);
      this.cosmos.applyFilter({});
      this.cosmosClusters.setVisible(this.showClusters);
      this.cosmosStructures.setVisible(this.showStructures);
      this.cosmosAtlas.setVisible(this.showAtlas);
      this.localCustom.setVisible(false);
      this.cosmosCustom.setVisible(this.showCustom);
      this._applyCosmosLabels();
      const v = this.cosmos.defaultView();
      this.scene.setView(v.pos, v.target);
    } else {
      this.cosmos.setVisible(false);
      this.starfield.points.visible = true;
      this.scene.setReferenceVisible(true);
      this.localClusters.setVisible(this.showClusters);
      this.localAtlas.setVisible(this.showAtlas);
      this.cosmosCustom.setVisible(false);
      this.localCustom.setVisible(this.showCustom);
      this._applyLocalLabels();
      this.scene.setView(new THREE.Vector3(14, 9, 17), new THREE.Vector3(0, 0, 0));
    }
    this.emit('mode', mode);
  }

  setLayerVisible(key, on) {
    if (key === 'clusters') {
      this.showClusters = on;
      (this.mode === 'cosmos' ? this.cosmosClusters : this.localClusters).setVisible(on);
      this._refreshMarkerLabels();
    } else if (key === 'structures') {
      this.showStructures = on;
      this.cosmosStructures.setVisible(on);
      this._refreshMarkerLabels();
    } else if (key === 'atlas') {
      this.showAtlas = on;
      (this.mode === 'cosmos' ? this.cosmosAtlas : this.localAtlas).setVisible(on);
    } else if (key === 'custom') {
      this.showCustom = on;
      (this.mode === 'cosmos' ? this.cosmosCustom : this.localCustom).setVisible(on);
    }
  }

  _refreshMarkerLabels() {
    const items = [];
    if (this.mode === 'cosmos') {
      if (this.showStructures) items.push(...this.cosmosStructures.labelItems().map((l) => ({ ...l, cls: 'lbl-structure' })));
      if (this.showClusters) items.push(...this.cosmosClusters.labelItems().map((l) => ({ ...l, cls: 'lbl-cluster' })));
    } else if (this.showClusters) {
      items.push(...this.localClusters.labelItems().map((l) => ({ ...l, cls: 'lbl-cluster' })));
    }
    this.labels.setMarkers(items);
  }

  _applyLocalLabels() {
    this.labels.setStatic(this.scene.reference.labels);
    this.labels.setStars(this.catalog.labels.map((l) => ({
      pos: new THREE.Vector3(this.catalog.x(l.i), this.catalog.y(l.i), this.catalog.z(l.i)),
      text: l.name, prio: -this.catalog.mag[l.i],
    })));
    this.labels.setVoyage([]);
    this._refreshMarkerLabels();
  }

  _applyCosmosLabels() {
    const { rings, localGroup } = this.cosmos.labelItems();
    this.labels.setStatic(rings);
    this.labels.setStars(localGroup);
    this.labels.setVoyage([]);
    this._refreshMarkerLabels();
  }

  // ================= selection =================
  // truePos = real position in PARSECS (universal metric unit for route distances)
  selectStar(i, { fly = false } = {}) {
    if (i < 0) { this.clearSelection(); return; }
    const info = this.catalog.star(i);
    info.kind = 'star';
    const worldPos = new THREE.Vector3(info.x, info.y, info.z);
    this._setSelection({ kind: 'star', starIndex: i, worldPos, truePos: worldPos.clone(), info });
    if (fly) this.scene.flyTo(worldPos);
  }

  selectObject(hit, { fly = false } = {}) {
    if (!hit) { this.clearSelection(); return; }
    const info = this.cosmos.describe(hit);
    const truePos = new THREE.Vector3(...info.dir).multiplyScalar(info.comovingMpc * 1e6);
    this._setSelection({ kind: info.kind, worldPos: info.worldPos.clone(), truePos, info });
    this._maybeBloom(info);
    if (fly) this.scene.flyTo(this.selection.worldPos);
  }

  selectExtra(kind, i, { fly = false } = {}) {
    if (kind === 'atlas') {
      const layer = this.mode === 'cosmos' ? this.cosmosAtlas : this.localAtlas;
      const it = layer.items[i]; if (!it) return;
      return this._selectAtlasObject(this.atlas[it.data.atlasIndex], it.pos.clone(), { fly });
    }
    if (kind === 'custom') {
      const layer = this.mode === 'cosmos' ? this.cosmosCustom : this.localCustom;
      const it = layer.items[i]; if (!it) return;
      return this.selectCustom(it.data.id, { fly });
    }
    const it = (kind === 'cluster'
      ? (this.mode === 'cosmos' ? this.cosmosClusters : this.localClusters)
      : this.cosmosStructures).items[i];
    if (!it) return;
    const d = it.data;
    const info = kind === 'cluster'
      ? { kind: 'cluster', name: d.name, sub: `${d.type} cluster`, distPc: d.distPc, distLy: d.distLy, dir: d.dir }
      : { kind: 'structure', name: d.name, sub: d.type, note: d.note, distMpc: d.distMpc, distGly: d.distGly, dir: d.dir };
    const truePos = new THREE.Vector3(...d.dir).multiplyScalar(kind === 'cluster' ? d.distPc : d.distMpc * 1e6);
    this._setSelection({ kind: info.kind, worldPos: it.pos.clone(), truePos, info });
    if (fly) this.scene.flyTo(it.pos);
  }

  // select an atlas object by its global index (used by the atlas browser & search);
  // hops to COSMOS if the object is too far for the true-scale LOCAL view.
  selectAtlas(atlasIndex, { fly = true } = {}) {
    const o = this.atlas[atlasIndex]; if (!o) return;
    const fitsLocal = Math.hypot(o.pos[0], o.pos[1], o.pos[2]) <= this.catalog.meta.bounds.maxRadiusPc * 1.02;
    if (this.mode === 'local' && !fitsLocal) this.setMode('cosmos');
    const worldPos = this.mode === 'cosmos'
      ? new THREE.Vector3(...o.dir).multiplyScalar(o.displayR)
      : new THREE.Vector3(o.pos[0], o.pos[1], o.pos[2]);
    this._selectAtlasObject(o, worldPos, { fly });
  }

  _selectAtlasObject(o, worldPos, { fly = false } = {}) {
    const cat = this.atlasCategories[o.category];
    const info = {
      kind: 'atlas', name: o.name, category: o.category, categoryLabel: cat ? cat.label : o.category,
      type: o.type, facts: o.facts, distLy: o.distLy, ra: o.ra, dec: o.dec, color: o.color,
    };
    const truePos = new THREE.Vector3(...o.dir).multiplyScalar(o.distLy / 3.2615638);
    this._setSelection({ kind: 'atlas', worldPos: worldPos.clone(), truePos, info });
    if (fly) this.scene.flyTo(worldPos);
  }

  _setSelection(sel) {
    this.selection = sel;
    this.emit('select', sel.info);
  }

  clearSelection() {
    this.selection = null;
    this._selmark.hidden = true;
    this._clearBloom();
    this.emit('select', null);
  }

  flyToPos(vec) { this.scene.flyTo(vec.clone()); }
  flyToStar(i) { this.scene.flyTo(new THREE.Vector3(this.catalog.x(i), this.catalog.y(i), this.catalog.z(i))); }

  home() {
    this.clearSelection();
    this.clearFocus();
    if (this.mode === 'cosmos') { const v = this.cosmos.defaultView(); this.scene.flyTo(v.target, { camPos: v.pos, dur: 1.2 }); }
    else this.scene.flyTo(new THREE.Vector3(0, 0, 0), { approach: 22, dur: 1.2 });
  }

  // ================= focus (re-centre the pivot, nautical-chart style) =================
  setFocus() {
    if (!this.selection) return;
    const s = this.selection;
    this.focus = { worldPos: s.worldPos.clone(), truePos: s.truePos.clone(), label: s.info.name || s.info.designation || 'object' };
    this.scene.flyTo(s.worldPos.clone(), { dur: 1.0 });
    this.emit('focus', this.focus);
  }
  clearFocus() {
    if (!this.focus) return;
    this.focus = null;
    this.emit('focus', null);
  }

  // ================= navigation: route plotting =================
  addRouteWaypoint() {
    if (!this.selection) return;
    const s = this.selection;
    this._addRoute({ worldPos: s.worldPos.clone(), truePos: s.truePos.clone(), label: s.info.name || s.info.designation || `waypoint ${this.route.length + 1}`, kind: s.kind });
  }

  // Free-space waypoint at the point you're looking at (crosshair × focal depth).
  addViewPoint() {
    const cam = this.scene.camera, tgt = this.scene.controls.target;
    const dist = Math.max(0.01, cam.position.distanceTo(tgt));
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    const worldPos = cam.position.clone().add(dir.multiplyScalar(dist));
    this._addRoute({ worldPos, truePos: this._worldToTrue(worldPos), label: `nav point ${this.route.length + 1}`, kind: 'free' });
  }

  _addRoute(wp) { this.route.push(wp); this._redrawRoute(); this.emit('route', this._routeSummary()); }

  // Map a display-space point back to a true position in parsecs (mode-aware).
  _worldToTrue(worldPos) {
    if (this.mode !== 'cosmos') return worldPos.clone();
    const D = this.cosmos.decadeUnit, r = worldPos.length();
    return worldPos.clone().normalize().multiplyScalar(Math.pow(10, r / D));
  }

  removeRouteWaypoint(idx) {
    if (idx == null) this.route.pop(); else this.route.splice(idx, 1);
    this._redrawRoute(); this.emit('route', this._routeSummary());
  }
  moveRouteWaypoint(idx, dir) {
    const j = idx + dir;
    if (j < 0 || j >= this.route.length) return;
    [this.route[idx], this.route[j]] = [this.route[j], this.route[idx]];
    this._redrawRoute(); this.emit('route', this._routeSummary());
  }
  reverseRoute() { this.route.reverse(); this._redrawRoute(); this.emit('route', this._routeSummary()); }
  clearRoute() {
    if (this.autopilot) this.stopRoute();
    if (!this.route.length && !this.routeGroup.children.length) return;
    this.route = [];
    this._redrawRoute(); this.emit('route', this._routeSummary());
  }
  setCruiseSpeed(fracC) { this.cruiseSpeed = Math.max(1e-7, Math.min(1, fracC)); this.emit('route', this._routeSummary()); }
  setPlotCourse(on) { this.plotCourse = !!on; this.emit('plot', this.plotCourse); }

  // distance -> travel time. Light travels 1 ly/yr, so coordinate years = ly / (v/c).
  // Ship (proper) time is dilated by the Lorentz factor.
  _legTimes(ly) {
    const beta = this.cruiseSpeed;
    const years = ly / beta;
    const shipYears = years * Math.sqrt(Math.max(0, 1 - beta * beta));
    return { years, shipYears };
  }

  _routeSummary() {
    const legs = [];
    let total = 0, years = 0, shipYears = 0;
    for (let i = 1; i < this.route.length; i++) {
      const d = new THREE.Vector3().subVectors(this.route[i].truePos, this.route[i - 1].truePos);
      const ly = d.length() * PC_TO_LY;
      const { ra, dec } = cartesianToRaDec(d.x, d.y, d.z);
      const t = this._legTimes(ly);
      total += ly; years += t.years; shipYears += t.shipYears;
      legs.push({ from: this.route[i - 1].label, to: this.route[i].label, ly, ra, dec, years: t.years, shipYears: t.shipYears });
    }
    return {
      points: this.route.map((r) => ({ label: r.label, kind: r.kind })),
      legs, totalLy: total, cruiseC: this.cruiseSpeed, years, shipYears,
    };
  }

  // ================= navigation: autopilot flythrough =================
  engageRoute() {
    if (this.route.length < 2) return;
    this.clearSelection();
    this.autopilot = { seg: 0, t: 0, paused: false, speed: 0.11 };
    this.scene.controls.enabled = false;
    this.emit('nav', this._navReadout());
  }
  pauseRoute() { if (this.autopilot) { this.autopilot.paused = !this.autopilot.paused; this.emit('nav', this._navReadout()); } }
  navStep(d) {
    if (!this.autopilot) return;
    this.autopilot.seg = Math.max(0, Math.min(this.route.length - 2, this.autopilot.seg + d));
    this.autopilot.t = 0; this.emit('nav', this._navReadout());
  }
  stopRoute() {
    if (!this.autopilot) return;
    this.autopilot = null;
    this.scene.controls.enabled = true;
    this.scene.controls.update();
    this.emit('nav', null);
  }
  navSetSpeed(v) { if (this.autopilot) this.autopilot.speed = v; }

  _updateAutopilot(dt) {
    const ap = this.autopilot; if (!ap) return;
    const pts = this.route.map((r) => r.worldPos);
    if (!ap.paused) {
      let remaining = ap.speed * dt * this._routeSpan();
      while (remaining > 0 && ap.seg < pts.length - 1) {
        const segLen = Math.max(1e-6, pts[ap.seg].distanceTo(pts[ap.seg + 1]));
        const along = segLen * ap.t + remaining;
        if (along >= segLen) { remaining = along - segLen; ap.seg++; ap.t = 0; }
        else { ap.t = along / segLen; remaining = 0; }
      }
      if (ap.seg >= pts.length - 1) { this._navReadoutFinal(); this.stopRoute(); return; }
    }
    const a = pts[ap.seg], b = pts[ap.seg + 1];
    const cur = a.clone().lerp(b, ap.t);
    const fwd = b.clone().sub(a); const segLen = fwd.length() || 1; fwd.normalize();
    const up = new THREE.Vector3(0, 0, 1);
    const back = Math.max(0.4, segLen * 0.22);
    const camPos = cur.clone().addScaledVector(fwd, -back).addScaledVector(up, back * 0.4);
    this.scene.camera.position.copy(camPos);
    this.scene.camera.lookAt(cur.clone().addScaledVector(fwd, back));
    this.scene.controls.target.copy(cur);
  }

  _routeSpan() {
    let s = 0;
    for (let i = 1; i < this.route.length; i++) s += this.route[i].worldPos.distanceTo(this.route[i - 1].worldPos);
    return Math.max(1, s) * 0.12;
  }

  _navReadout() {
    const ap = this.autopilot; if (!ap) return null;
    const i = ap.seg;
    const dTrue = new THREE.Vector3().subVectors(this.route[i + 1].truePos, this.route[i].truePos);
    const legLy = dTrue.length() * PC_TO_LY;
    const { ra, dec } = cartesianToRaDec(dTrue.x, dTrue.y, dTrue.z);
    const rangeLy = legLy * (1 - ap.t);
    let remLy = rangeLy;
    for (let k = i + 1; k < this.route.length - 1; k++) remLy += new THREE.Vector3().subVectors(this.route[k + 1].truePos, this.route[k].truePos).length() * PC_TO_LY;
    return {
      active: true, paused: ap.paused, seg: i + 1, total: this.route.length - 1,
      toLabel: this.route[i + 1].label, ra, dec, rangeLy, rangeLyTotal: remLy, cruiseC: this.cruiseSpeed,
      etaNext: this._legTimes(rangeLy), etaTotal: this._legTimes(remLy),
    };
  }
  _navReadoutFinal() { this.emit('nav', { arrived: true, at: this.route[this.route.length - 1].label }); }

  // ================= navigation: saved routes =================
  _wpToPortable(r) {
    const { ra, dec, r: rr } = cartesianToRaDec(r.truePos.x, r.truePos.y, r.truePos.z);
    return { label: r.label, kind: r.kind, ra, dec, distLy: rr * PC_TO_LY };
  }
  saveRoute(name) {
    if (this.route.length < 1) return null;
    const rec = this.routeStore.save(name, this.route.map((r) => this._wpToPortable(r)), this.cruiseSpeed);
    this.emit('routes', this.routeStore.all());
    return rec;
  }
  loadRoute(id) {
    const rec = this.routeStore.get(id); if (!rec) return;
    if (this.autopilot) this.stopRoute();
    this.cruiseSpeed = rec.cruiseC || 0.1;
    const D = this.cosmos ? this.cosmos.decadeUnit : 3;
    this.route = rec.waypoints.map((w, i) => {
      const distPc = Math.max((w.distLy || 0) / PC_TO_LY, 0);
      const ra = w.ra * 15 * Math.PI / 180, dec = w.dec * Math.PI / 180, cd = Math.cos(dec);
      const dir = new THREE.Vector3(cd * Math.cos(ra), cd * Math.sin(ra), Math.sin(dec));
      const truePos = dir.clone().multiplyScalar(distPc);
      const worldPos = this.mode === 'cosmos' ? dir.clone().multiplyScalar(D * Math.log10(Math.max(distPc, 1))) : truePos.clone();
      return { worldPos, truePos, label: w.label || `waypoint ${i + 1}`, kind: w.kind || 'free' };
    });
    this._redrawRoute(); this.emit('route', this._routeSummary());
  }
  deleteRoute(id) { this.routeStore.remove(id); this.emit('routes', this.routeStore.all()); }
  exportRoutes() { return this.routeStore.export(); }
  importRoutes(json) { const r = this.routeStore.import(json); this.emit('routes', this.routeStore.all()); return r; }

  _redrawRoute() {
    for (const o of [...this.routeGroup.children]) { this.routeGroup.remove(o); o.geometry?.dispose?.(); o.material?.dispose?.(); }
    if (this.route.length < 1) return;
    if (this.route.length >= 2) {
      const g = new THREE.BufferGeometry().setFromPoints(this.route.map((r) => r.worldPos));
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x7bf0a0, transparent: true, opacity: 0.85 }));
      line.frustumCulled = false; this.routeGroup.add(line);
    }
    const arr = new Float32Array(this.route.length * 3);
    this.route.forEach((r, i) => { arr[i * 3] = r.worldPos.x; arr[i * 3 + 1] = r.worldPos.y; arr[i * 3 + 2] = r.worldPos.z; });
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mk = new THREE.Points(mg, new THREE.PointsMaterial({ size: 15, map: this._routeRing, sizeAttenuation: false, transparent: true, color: 0x7bf0a0, depthWrite: false, blending: THREE.AdditiveBlending }));
    mk.frustumCulled = false; this.routeGroup.add(mk);
  }

  // ================= galaxy LOD "bloom" (illustrative) =================
  // Resolve a picked galaxy into a procedural star cloud so the "universe of
  // galaxies" reads as explorable. Morphology (spiral / elliptical / irregular)
  // is chosen deterministically from the object's own coordinates — illustrative,
  // NOT catalogue data (only the Milky Way has real per-star data).
  _maybeBloom(info) {
    this._clearBloom();
    if (info.kind !== 'galaxy' && info.kind !== 'localgalaxy') return;
    const center = info.worldPos, N = 3600;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    let seed = Math.floor(Math.abs(center.x * 733.1 + center.y * 977.7 + center.z * 613.3)) % 2147483647 || 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const morph = Math.floor(rnd() * 3); // 0 spiral, 1 elliptical, 2 irregular
    const R = 0.34, arms = 2 + Math.floor(rnd() * 3), tilt = rnd() * Math.PI, roll = rnd() * Math.PI * 2;
    const disk = [0.65, 0.78, 1.0], bulge = [1.0, 0.86, 0.62];
    for (let i = 0; i < N; i++) {
      const isBulge = rnd() < (morph === 1 ? 0.75 : 0.28);
      let r, a, z;
      if (morph === 1) { // elliptical: smooth ellipsoid, redder
        r = Math.pow(rnd(), 0.5) * R; a = rnd() * Math.PI * 2; z = (rnd() - 0.5) * R * 0.7 * (1 - r / R);
      } else if (morph === 2) { // irregular: clumpy disc
        r = Math.pow(rnd(), 0.5) * R; a = rnd() * Math.PI * 2 + Math.sin(r * 20 + seed) * 0.6; z = (rnd() - 0.5) * R * 0.12;
      } else { // spiral: logarithmic arms + bulge
        r = isBulge ? Math.pow(rnd(), 2) * R * 0.35 : Math.pow(rnd(), 0.6) * R;
        const arm = Math.floor(rnd() * arms) * (Math.PI * 2 / arms);
        a = arm + r * 7 + (rnd() - 0.5) * 0.5; z = (rnd() - 0.5) * (isBulge ? R * 0.28 : R * 0.05);
      }
      let x = Math.cos(a) * r, y = Math.sin(a) * r;
      // roll in-plane then tilt
      const xr = x * Math.cos(roll) - y * Math.sin(roll); y = x * Math.sin(roll) + y * Math.cos(roll); x = xr;
      const yt = y * Math.cos(tilt) - z * Math.sin(tilt); z = y * Math.sin(tilt) + z * Math.cos(tilt); y = yt;
      pos[i * 3] = center.x + x; pos[i * 3 + 1] = center.y + y; pos[i * 3 + 2] = center.z + z;
      const c = isBulge || morph === 1 ? bulge : disk;
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending });
    this._bloom = new THREE.Points(g, m); this._bloom.frustumCulled = false;
    this.scene.scene.add(this._bloom);
  }
  _clearBloom() {
    if (!this._bloom) return;
    this.scene.scene.remove(this._bloom); this._bloom.geometry.dispose(); this._bloom.material.dispose();
    this._bloom = null;
  }

  // ================= filters =================
  setFilter(partial) {
    const n = this.starfield.applyFilter(partial);
    if (this.selection?.kind === 'star' && !this.starfield.isVisible(this.selection.starIndex)) this.clearSelection();
    this.emit('filter', n);
    return n;
  }

  setCosmosFilter(partial) {
    this.cosmos.applyFilter(partial);
    this.emit('cosmosFilter', this.cosmos.visibleCount());
  }

  // ================= voyages (unified) =================
  startVoyageLocal(id) {
    const v = this.catalog.voyages.find((x) => x.id === id);
    if (!v) return;
    this.voyage = { source: 'local', def: v, index: 0 };
    this.voyageLayer.setVoyage(v);
    this.voyageLayer.setVisible(true);
    this.starfield.setPinned(v.waypoints.map((w) => w.i));
    this.setFilter({});
    this.labels.setVoyage(v.waypoints.map((w, k) => ({ pos: new THREE.Vector3(w.pos[0], w.pos[1], w.pos[2]), text: `${k}· ${w.name}` })));
    this.voyageGoto(0);
  }

  startVoyageCosmos(id) {
    const v = this.cosmosData.voyages.find((x) => x.id === id);
    if (!v) return;
    this.voyage = { source: 'cosmos', def: v, index: 0 };
    this.voyageGoto(0);
  }

  voyageGoto(idx) {
    if (!this.voyage) return;
    const { source, def } = this.voyage;
    const stops = source === 'local' ? def.waypoints : def.stops;
    idx = Math.max(0, Math.min(stops.length - 1, idx));
    this.voyage.index = idx;

    if (source === 'local') {
      const w = stops[idx];
      this.voyageLayer.setActive(idx);
      this.selectStar(w.i, { fly: true });
      this.emit('voyage', normalizeLocal(def, idx));
    } else {
      const s = stops[idx];
      // frame this scale's shell, and progressively reveal objects out to its redshift
      const r = Math.min(this.cosmos.cmbR * 1.06, Math.max(2.5, s.displayR + 3));
      const dir = new THREE.Vector3(0.62, 0.4, 0.75).normalize();
      this.scene.flyTo(new THREE.Vector3(0, 0, 0), { camPos: dir.multiplyScalar(r), dur: 1.6 });
      if (s.zMax != null) this.setCosmosFilter({ zMax: s.zMax });
      this.emit('voyage', normalizeCosmos(def, idx));
    }
  }

  voyageStep(d) { if (this.voyage) this.voyageGoto(this.voyage.index + d); }

  stopVoyage() {
    if (!this.voyage) return;
    if (this.voyage.source === 'local') {
      this.voyageLayer.setVisible(false); this.voyageLayer.clear();
      this.starfield.setPinned([]); this.setFilter({});
      this.labels.setVoyage([]);
    } else {
      this.cosmos.applyFilter({ zMax: 6 }); // restore full redshift range
    }
    this.voyage = null;
    this.emit('voyageEnd');
  }

  get voyageIndex() { return this.voyage ? this.voyage.index : 0; }

  // ================= pointer =================
  _bindPointer(canvas) {
    let down = null;
    const ndc = (e) => ({ x: (e.clientX / window.innerWidth) * 2 - 1, y: -(e.clientY / window.innerHeight) * 2 + 1 });
    const pickAt = (e) => {
      this._ray.setFromCamera(ndc(e), this.scene.camera); this._ray.camera = this.scene.camera;
      // labelled markers (clusters/structures) take priority when the cursor is on them
      const ex = this._pickExtra();
      if (ex) return ex;
      if (this.mode === 'local') { const i = this.starPicker.pick(ndc(e)); return i >= 0 ? { star: i } : null; }
      return this.cosmos.pick(this._ray);
    };
    const dispatch = (hit, fly) => {
      if (!hit) { if (!fly) this.clearSelection(); return; }
      if (hit.star != null) this.selectStar(hit.star, { fly });
      else if (hit.extra) this.selectExtra(hit.extra.kind, hit.extra.i, { fly });
      else this.selectObject(hit, { fly });
    };
    // In plot-course mode a click drops a waypoint: snap to an object under the
    // cursor, otherwise a free-space point at the focal depth along the click ray.
    const plotAt = (e) => {
      const hit = pickAt(e);
      if (hit) { dispatch(hit, false); if (this.selection) this.addRouteWaypoint(); return; }
      this._ray.setFromCamera(ndc(e), this.scene.camera);
      const dist = this.scene.camera.position.distanceTo(this.scene.controls.target);
      const wp = this._ray.ray.origin.clone().addScaledVector(this._ray.ray.direction, dist);
      this._addRoute({ worldPos: wp, truePos: this._worldToTrue(wp), label: `nav point ${this.route.length + 1}`, kind: 'free' });
    };
    canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), btn: e.button }; });
    canvas.addEventListener('pointerup', (e) => {
      if (!down) return;
      const isClick = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5 && performance.now() - down.t < 400 && down.btn === 0;
      down = null;
      if (!isClick || this.autopilot) return;
      if (this.plotCourse) plotAt(e); else dispatch(pickAt(e), false);
    });
    canvas.addEventListener('dblclick', (e) => dispatch(pickAt(e), true));
    canvas.addEventListener('pointermove', (e) => { this._hover.need = true; this._hover.x = e.clientX; this._hover.y = e.clientY; });
    canvas.addEventListener('pointerleave', () => { this.emit('hover', null); this._hover.key = ''; });
  }

  // ================= loop =================
  start() {
    const tick = () => {
      const dt = Math.min(0.05, this._clock.getDelta());
      if (this.autopilot) { this._updateAutopilot(dt); this._navAcc = (this._navAcc || 0) + dt; if (this._navAcc > 0.2) { this._navAcc = 0; if (this.autopilot) this.emit('nav', this._navReadout()); } }
      this.scene.update(dt);
      if (this.mode === 'cosmos') this.cosmos.update(this.scene.camera);
      this.labels.update(this.scene.camera);
      this._updateSelMark();
      this._updateHover();
      this._updateTelemetry(dt);
      this.scene.render();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  _updateSelMark() {
    if (!this.selection) { this._selmark.hidden = true; return; }
    this._v.copy(this.selection.worldPos).project(this.scene.camera);
    if (this._v.z > 1) { this._selmark.hidden = true; return; }
    this._selmark.hidden = false;
    this._selmark.style.left = (this._v.x * 0.5 + 0.5) * window.innerWidth + 'px';
    this._selmark.style.top = (-this._v.y * 0.5 + 0.5) * window.innerHeight + 'px';
  }

  _pickExtra() {
    const cam = this.scene.camera;
    let best = null, bestAng = Infinity;
    const check = (layer, kind, show) => {
      if (!show || !layer.positions.length) return;
      const r = pickPositions(this._ray, layer.positions, cam, 13);
      if (r && r.ang < bestAng) { best = { extra: { kind, i: r.i } }; bestAng = r.ang; }
    };
    if (this.mode === 'cosmos') {
      check(this.cosmosStructures, 'structure', this.showStructures);
      check(this.cosmosClusters, 'cluster', this.showClusters);
      check(this.cosmosAtlas, 'atlas', this.showAtlas);
      check(this.cosmosCustom, 'custom', this.showCustom);
    } else {
      check(this.localClusters, 'cluster', this.showClusters);
      check(this.localAtlas, 'atlas', this.showAtlas);
      check(this.localCustom, 'custom', this.showCustom);
    }
    return best;
  }

  _updateHover() {
    const now = performance.now();
    if (!this._hover.need || now - this._hover.last < 100) return;
    this._hover.last = now; this._hover.need = false;
    const ndc = { x: (this._hover.x / window.innerWidth) * 2 - 1, y: -(this._hover.y / window.innerHeight) * 2 + 1 };
    this._ray.setFromCamera(ndc, this.scene.camera); this._ray.camera = this.scene.camera;
    const ex = this._pickExtra();
    if (ex) {
      const key = `${ex.extra.kind}${ex.extra.i}`;
      if (key !== this._hover.key) {
        this._hover.key = key;
        let text;
        if (ex.extra.kind === 'atlas') {
          const layer = this.mode === 'cosmos' ? this.cosmosAtlas : this.localAtlas;
          const o = this.atlas[layer.items[ex.extra.i].data.atlasIndex];
          text = `${esc(o.name)} · ${esc(o.type)}`;
        } else if (ex.extra.kind === 'custom') {
          const layer = this.mode === 'cosmos' ? this.cosmosCustom : this.localCustom;
          const o = this.userStore.get(layer.items[ex.extra.i].data.id);
          text = o ? `${o.kind === 'imagined' ? '✦ ' : ''}${esc(o.name)} · ${esc(o.type || o.kind)}` : '';
        } else {
          const layer = ex.extra.kind === 'cluster' ? (this.mode === 'cosmos' ? this.cosmosClusters : this.localClusters) : this.cosmosStructures;
          const d = layer.items[ex.extra.i].data;
          text = ex.extra.kind === 'cluster' ? `${esc(d.name)} · ${esc(d.type)} cluster` : `${esc(d.name)} · ${esc(d.type)}`;
        }
        this.emit('hover', { text, x: this._hover.x, y: this._hover.y });
      }
      return;
    }
    if (this.mode === 'local') {
      const i = this.starPicker.pick(ndc, 12);
      const key = 'star' + i;
      if (key !== this._hover.key) { this._hover.key = key; this.emit('hover', i >= 0 ? { text: hoverStar(this.catalog.star(i)), x: this._hover.x, y: this._hover.y } : null); }
    } else {
      const hit = this.cosmos.pick(this._ray);
      const key = hit ? `${hit.kind}${hit.layer || ''}${hit.i}` : '';
      if (key !== this._hover.key) {
        this._hover.key = key;
        this.emit('hover', hit ? { text: hoverCosmos(this.cosmos.describe(hit)), x: this._hover.x, y: this._hover.y } : null);
      }
    }
  }

  _updateTelemetry(dt) {
    this._telAcc += dt;
    if (this._telAcc < 0.15) return;
    this._telAcc = 0;
    const cam = this.scene.camera;
    const dir = this.scene.controls.target.clone().sub(cam.position);
    this.emit('frame', {
      mode: this.mode, camPos: cam.position, camRadius: cam.position.length(), dir, fov: cam.fov,
      visible: this.mode === 'local' ? this.starfield.visibleCount : this.cosmos.visibleCount(),
      decadeUnit: this.cosmos?.decadeUnit || 3, cmbR: this.cosmos?.cmbR || 30,
      focus: this.focus ? this.focus.label : null,
    });
  }
}

function normalizeLocal(def, idx) {
  const w = def.waypoints[idx];
  return {
    title: def.title, kind: def.kind, index: idx, total: def.waypoints.length,
    card: {
      name: w.name, narrative: w.narrative,
      meta: [
        w.i === 0 ? null : ['dist', w.distanceLy ? w.distanceLy + ' ly' : '—'],
        w.spect ? ['type', w.spect] : null,
        w.catalogDistLy ? ['catalogue', w.catalogDistLy + ' ly'] : null,
      ].filter(Boolean),
    },
  };
}
function normalizeCosmos(def, idx) {
  const s = def.stops[idx];
  return {
    title: def.title, kind: def.kind, index: idx, total: def.stops.length,
    card: {
      name: s.label, narrative: s.narrative,
      meta: [s.distLy > 0 ? ['scale', fmtLy(s.distLy)] : ['scale', 'the Sun']],
    },
  };
}
function fmtLy(ly) {
  if (ly >= 1e9) return `${(ly / 1e9).toFixed(1)} Gly`;
  if (ly >= 1e6) return `${(ly / 1e6).toFixed(0)} Mly`;
  if (ly >= 1e3) return `${(ly / 1e3).toFixed(0)} kly`;
  return `${ly.toFixed(0)} ly`;
}
function hoverStar(s) { return `${esc(s.name)} · ${esc(s.spect)} · ${s.distLy.toFixed(1)} ly`; }
function hoverCosmos(o) {
  if (o.kind === 'localgalaxy') return `${esc(o.name)} · ${(o.distLy / 1e6).toFixed(1)} Mly`;
  return `${o.kind === 'quasar' ? 'Quasar' : 'Galaxy'} · z=${o.z.toFixed(3)} · ${(o.comovingMpc * 3.2615638e6 / 1e9).toFixed(2)} Gly`;
}
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
