import * as THREE from 'three';
import { Scene } from './render/scene.js';
import { Starfield } from './render/starfield.js';
import { Picker } from './render/picking.js';
import { Labels } from './render/labels.js';
import { VoyageLayer } from './render/voyagePath.js';

// Central application state + orchestration. HUD modules attach to this via on().
export class App {
  constructor(canvas, catalog) {
    this.catalog = catalog;
    this.scene = new Scene(canvas);
    this.starfield = new Starfield(catalog);
    this.scene.scene.add(this.starfield.points);
    this.picker = new Picker(catalog, this.starfield, this.scene.camera);
    this.labels = new Labels(document.body);
    this.voyageLayer = new VoyageLayer(this.scene.scene);

    this.selected = -1;
    this.voyage = null;       // active voyage object
    this.voyageIndex = 0;
    this._listeners = {};
    this._clock = new THREE.Clock();
    this._telAcc = 0;
    this._hover = { need: false, x: 0, y: 0, last: 0, idx: -1 };
    this._selmark = document.getElementById('selmark');
    this._v = new THREE.Vector3();

    this._setupLabels();
    this._bindPointer(canvas);
  }

  on(evt, cb) { (this._listeners[evt] ||= []).push(cb); return this; }
  emit(evt, ...a) { (this._listeners[evt] || []).forEach((cb) => cb(...a)); }

  _setupLabels() {
    // reference labels (rings / axes)
    this.labels.setStatic(this.scene.reference.labels);
    // bright star labels
    const items = this.catalog.labels.map((l) => ({
      pos: new THREE.Vector3(this.catalog.x(l.i), this.catalog.y(l.i), this.catalog.z(l.i)),
      text: l.name,
      prio: -this.catalog.mag[l.i], // brighter = higher priority
    }));
    this.labels.setStars(items);
  }

  // ---------- selection ----------
  select(i, { fly = false } = {}) {
    this.selected = i;
    if (i >= 0) {
      const star = this.catalog.star(i);
      this.emit('select', star);
      if (fly) this.flyTo(i);
    } else {
      this.emit('select', null);
      this._selmark.hidden = true;
    }
  }

  flyTo(i) {
    this._v.set(this.catalog.x(i), this.catalog.y(i), this.catalog.z(i));
    this.scene.flyTo(this._v);
  }

  home() {
    this.select(-1);
    this.scene.flyTo(new THREE.Vector3(0, 0, 0), { approach: 22, dur: 1.2 });
  }

  // ---------- filters ----------
  setFilter(partial) {
    const n = this.starfield.applyFilter(partial);
    // deselect if the selected star was filtered out
    if (this.selected >= 0 && !this.starfield.isVisible(this.selected)) this.select(-1);
    this.emit('filter', n);
    return n;
  }

  // ---------- voyages ----------
  startVoyage(id) {
    const v = this.catalog.voyages.find((x) => x.id === id);
    if (!v) return;
    this.voyage = v;
    this.voyageIndex = 0;
    this.voyageLayer.setVoyage(v);
    this.voyageLayer.setVisible(true);
    // keep every stop visible regardless of the current filters
    this.starfield.setPinned(v.waypoints.map((w) => w.i));
    this.setFilter({});
    this.labels.setVoyage(v.waypoints.map((w, k) => ({
      pos: new THREE.Vector3(w.pos[0], w.pos[1], w.pos[2]),
      text: `${k}· ${w.name}`,
    })));
    this.voyageGoto(0);
    this.emit('voyage', { voyage: v, index: 0 });
  }

  voyageGoto(idx) {
    if (!this.voyage) return;
    idx = Math.max(0, Math.min(this.voyage.waypoints.length - 1, idx));
    this.voyageIndex = idx;
    const w = this.voyage.waypoints[idx];
    this.voyageLayer.setActive(idx);
    this.select(w.i, { fly: true });
    this.emit('voyage', { voyage: this.voyage, index: idx });
  }

  voyageStep(delta) { this.voyageGoto(this.voyageIndex + delta); }

  stopVoyage() {
    this.voyage = null;
    this.voyageLayer.setVisible(false);
    this.voyageLayer.clear();
    this.labels.setVoyage([]);
    this.starfield.setPinned([]);
    this.setFilter({});
    this.emit('voyageEnd');
  }

  // ---------- pointer ----------
  _bindPointer(canvas) {
    let down = null;
    const ndc = (e) => ({ x: (e.clientX / window.innerWidth) * 2 - 1, y: -(e.clientY / window.innerHeight) * 2 + 1 });
    canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), btn: e.button }; });
    canvas.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const dt = performance.now() - down.t;
      const isClick = moved < 5 && dt < 400 && down.btn === 0;
      down = null;
      if (!isClick) return;
      const i = this.picker.pick(ndc(e));
      this.select(i, { fly: false });
    });
    canvas.addEventListener('dblclick', (e) => {
      const i = this.picker.pick(ndc(e));
      if (i >= 0) this.select(i, { fly: true });
    });
    canvas.addEventListener('pointermove', (e) => {
      this._hover.need = true; this._hover.x = e.clientX; this._hover.y = e.clientY;
    });
    canvas.addEventListener('pointerleave', () => { this.emit('hover', null); this._hover.idx = -1; });
  }

  // ---------- loop ----------
  start() {
    const tick = () => {
      const dt = Math.min(0.05, this._clock.getDelta());
      this.scene.update(dt);
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
    if (this.selected < 0) { this._selmark.hidden = true; return; }
    const i = this.selected;
    this._v.set(this.catalog.x(i), this.catalog.y(i), this.catalog.z(i)).project(this.scene.camera);
    if (this._v.z > 1) { this._selmark.hidden = true; return; }
    const x = (this._v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this._v.y * 0.5 + 0.5) * window.innerHeight;
    this._selmark.hidden = false;
    this._selmark.style.left = x + 'px';
    this._selmark.style.top = y + 'px';
  }

  _updateHover() {
    const now = performance.now();
    if (!this._hover.need || now - this._hover.last < 90) return;
    this._hover.last = now; this._hover.need = false;
    const ndc = { x: (this._hover.x / window.innerWidth) * 2 - 1, y: -(this._hover.y / window.innerHeight) * 2 + 1 };
    const i = this.picker.pick(ndc, 12);
    if (i !== this._hover.idx) {
      this._hover.idx = i;
      this.emit('hover', i >= 0 ? { star: this.catalog.star(i), x: this._hover.x, y: this._hover.y } : null);
    }
  }

  _updateTelemetry(dt) {
    this._telAcc += dt;
    if (this._telAcc < 0.15) return;
    this._telAcc = 0;
    const cam = this.scene.camera;
    const dist = cam.position.length();
    const dir = this.scene.controls.target.clone().sub(cam.position);
    this.emit('frame', { dist, dir, camPos: cam.position, fov: cam.fov, visible: this.starfield.visibleCount });
  }
}
