import * as THREE from 'three';
import { Scene } from './render/scene.js';
import { Starfield } from './render/starfield.js';
import { Picker } from './render/picking.js';
import { Labels } from './render/labels.js';
import { VoyageLayer } from './render/voyagePath.js';
import { CosmosWorld } from './render/cosmos.js';

// Central application state. Two modes share one renderer/camera/HUD chrome:
//   local  — the true-scale stellar neighbourhood (parsecs, Sol at origin)
//   cosmos — the whole observable universe on a logarithmic radial scale
export class App {
  constructor(canvas, catalog, cosmosData) {
    this.catalog = catalog;
    this.cosmosData = cosmosData;
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
    this._listeners = {};
    this._clock = new THREE.Clock();
    this._telAcc = 0;
    this._hover = { need: false, x: 0, y: 0, last: 0, key: '' };
    this._selmark = document.getElementById('selmark');
    this._v = new THREE.Vector3();
    this._ray = new THREE.Raycaster();

    this._applyLocalLabels();
    this._bindPointer(canvas);
  }

  on(evt, cb) { (this._listeners[evt] ||= []).push(cb); return this; }
  emit(evt, ...a) { (this._listeners[evt] || []).forEach((cb) => cb(...a)); }

  // ================= mode switching =================
  setMode(mode) {
    if (mode === this.mode) return;
    this.stopVoyage();
    this.clearSelection();
    this.mode = mode;
    if (mode === 'cosmos') {
      this.starfield.points.visible = false;
      this.scene.setReferenceVisible(false);
      this.voyageLayer.setVisible(false);
      this.cosmos.setVisible(true);
      this.cosmos.applyFilter({});
      this._applyCosmosLabels();
      const v = this.cosmos.defaultView();
      this.scene.setView(v.pos, v.target);
    } else {
      this.cosmos.setVisible(false);
      this.starfield.points.visible = true;
      this.scene.setReferenceVisible(true);
      this._applyLocalLabels();
      this.scene.setView(new THREE.Vector3(14, 9, 17), new THREE.Vector3(0, 0, 0));
    }
    this.emit('mode', mode);
  }

  _applyLocalLabels() {
    this.labels.setStatic(this.scene.reference.labels);
    this.labels.setStars(this.catalog.labels.map((l) => ({
      pos: new THREE.Vector3(this.catalog.x(l.i), this.catalog.y(l.i), this.catalog.z(l.i)),
      text: l.name, prio: -this.catalog.mag[l.i],
    })));
    this.labels.setVoyage([]);
  }

  _applyCosmosLabels() {
    const { rings, localGroup } = this.cosmos.labelItems();
    this.labels.setStatic(rings);
    this.labels.setStars(localGroup);
    this.labels.setVoyage([]);
  }

  // ================= selection =================
  selectStar(i, { fly = false } = {}) {
    if (i < 0) { this.clearSelection(); return; }
    const info = this.catalog.star(i);
    info.kind = 'star';
    this.selection = { kind: 'star', starIndex: i, worldPos: new THREE.Vector3(info.x, info.y, info.z), info };
    this.emit('select', info);
    if (fly) this.scene.flyTo(this.selection.worldPos);
  }

  selectObject(hit, { fly = false } = {}) {
    if (!hit) { this.clearSelection(); return; }
    const info = this.cosmos.describe(hit);
    this.selection = { kind: info.kind, worldPos: info.worldPos.clone(), info };
    this.emit('select', info);
    if (fly) this.scene.flyTo(this.selection.worldPos);
  }

  clearSelection() {
    this.selection = null;
    this._selmark.hidden = true;
    this.emit('select', null);
  }

  flyToPos(vec) { this.scene.flyTo(vec.clone()); }
  flyToStar(i) { this.scene.flyTo(new THREE.Vector3(this.catalog.x(i), this.catalog.y(i), this.catalog.z(i))); }

  home() {
    this.clearSelection();
    if (this.mode === 'cosmos') { const v = this.cosmos.defaultView(); this.scene.flyTo(v.target, { camPos: v.pos, dur: 1.2 }); }
    else this.scene.flyTo(new THREE.Vector3(0, 0, 0), { approach: 22, dur: 1.2 });
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
      if (this.mode === 'local') { const i = this.starPicker.pick(ndc(e)); return i >= 0 ? { star: i } : null; }
      this._ray.setFromCamera(ndc(e), this.scene.camera); this._ray.camera = this.scene.camera;
      return this.cosmos.pick(this._ray);
    };
    canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), btn: e.button }; });
    canvas.addEventListener('pointerup', (e) => {
      if (!down) return;
      const isClick = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5 && performance.now() - down.t < 400 && down.btn === 0;
      down = null;
      if (!isClick) return;
      const hit = pickAt(e);
      if (!hit) { this.clearSelection(); return; }
      if (hit.star != null) this.selectStar(hit.star); else this.selectObject(hit);
    });
    canvas.addEventListener('dblclick', (e) => {
      const hit = pickAt(e);
      if (!hit) return;
      if (hit.star != null) this.selectStar(hit.star, { fly: true }); else this.selectObject(hit, { fly: true });
    });
    canvas.addEventListener('pointermove', (e) => { this._hover.need = true; this._hover.x = e.clientX; this._hover.y = e.clientY; });
    canvas.addEventListener('pointerleave', () => { this.emit('hover', null); this._hover.key = ''; });
  }

  // ================= loop =================
  start() {
    const tick = () => {
      const dt = Math.min(0.05, this._clock.getDelta());
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

  _updateHover() {
    const now = performance.now();
    if (!this._hover.need || now - this._hover.last < 100) return;
    this._hover.last = now; this._hover.need = false;
    const ndc = { x: (this._hover.x / window.innerWidth) * 2 - 1, y: -(this._hover.y / window.innerHeight) * 2 + 1 };
    if (this.mode === 'local') {
      const i = this.starPicker.pick(ndc, 12);
      const key = 'star' + i;
      if (key !== this._hover.key) { this._hover.key = key; this.emit('hover', i >= 0 ? { text: hoverStar(this.catalog.star(i)), x: this._hover.x, y: this._hover.y } : null); }
    } else {
      this._ray.setFromCamera(ndc, this.scene.camera); this._ray.camera = this.scene.camera;
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
