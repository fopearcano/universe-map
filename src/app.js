import * as THREE from 'three';
import { Scene } from './render/scene.js';
import { Starfield } from './render/starfield.js';
import { Picker } from './render/picking.js';
import { Labels } from './render/labels.js';
import { VoyageLayer } from './render/voyagePath.js';
import { CosmosWorld } from './render/cosmos.js';
import { MarkerLayer, pickPositions, makeRingTexture, makeSparkleTexture, makeGlyphAtlas, GLYPH, GLYPH_SCALE } from './render/markers.js';
import { StructureShapes } from './render/structures.js';
import { morphFromType, seedFromVec, structureCloud } from './render/morphology.js';
import { GalaxyInterior } from './render/galaxyInterior.js';
import { loadImageData, imageToCloud, diameterKpcFor, fovForGalaxy, pickSurveyImage } from './render/galaxyImage.js';
import { GalaxyBillboards } from './render/galaxyBillboards.js';
import { PC_TO_LY, cartesianToRaDec } from './util/astro.js';
import { UserStore } from './data/userStore.js';
import { RouteStore } from './data/routeStore.js';
import { resolveSimbad, growFromCatalogue, fetchAngularSize } from './data/remote.js';

// marker colours by type
const MARK_COLOR = {
  open: [0.6, 0.82, 1.0], globular: [1.0, 0.82, 0.42],
  cluster: [1.0, 0.45, 0.85], supercluster: [1.0, 0.62, 0.32], attractor: [1.0, 0.42, 0.42],
  wall: [0.55, 1.0, 0.66], void: [0.62, 0.66, 0.78],
};

// Icon glyph per class. Atlas categories, cluster types and structure types each
// map to a distinct glyph so the map reads like an annotated chart.
const CAT_GLYPH = {
  smbh: 'blackhole', sbh: 'blackhole', pulsar: 'pulsar', supernova: 'supernova',
  nebula: 'nebula', exoplanet: 'exoplanet', galaxy: 'galaxy', quasar: 'quasar',
  transient: 'transient', hyperstar: 'hyperstar',
};
const STRUCT_GLYPH = { cluster: 'supercluster', supercluster: 'supercluster', attractor: 'attractor', wall: 'wall', void: 'void' };
// Resolve a glyph name to { glyph index, scale } for a marker item.
const glyphSpec = (name) => ({ glyph: GLYPH[name] ?? GLYPH.ring, scale: GLYPH_SCALE[name] ?? 1 });

// Central application state. Two modes share one renderer/camera/HUD chrome:
//   local  — the true-scale stellar neighbourhood (parsecs, Sol at origin)
//   cosmos — the whole observable universe on a logarithmic radial scale
export class App {
  constructor(canvas, catalog, cosmosData, extras = { clusters: [], structures: [] }) {
    this.catalog = catalog;
    this.cosmosData = cosmosData;
    this.extras = extras;
    this.expeditions = (extras.expeditions && extras.expeditions.expeditions) || [];
    this.scene = new Scene(canvas);
    this.mode = 'local';

    // local world
    this.starfield = new Starfield(catalog);
    this.scene.scene.add(this.starfield.points);
    this.starPicker = new Picker(catalog, this.starfield, this.scene.camera);
    this.voyageLayer = new VoyageLayer(this.scene.scene);

    // cosmos world
    this.cosmos = cosmosData ? new CosmosWorld(this.scene.scene, cosmosData, catalog, extras) : null;

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
    this._glyphAtlas = makeGlyphAtlas(); // shared icon atlas for every marker layer
    this.showCustom = true;
    this.localCustom = null; this.cosmosCustom = null;

    this._buildMarkers();
    this._buildStructureShapes();
    this._buildGalaxyBillboards();
    this._buildRouteLayer();
    this._buildSectorGrid();
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
    // imagined objects keep the sparkle; live-discovered ones get their class icon.
    const glyphFor = (o) => o.kind === 'imagined' ? glyphSpec('sparkle') : glyphSpec(CAT_GLYPH[o.category] || 'star');
    const atlas = this._glyphAtlas;
    const localItems = [], cosmosItems = [];
    for (const o of objs) {
      const g = this._customGeom(o);
      const color = colorFor(o), gs = glyphFor(o);
      cosmosItems.push({ pos: new THREE.Vector3(...g.dir).multiplyScalar(g.displayR), color, label: o.name, data: { id: o.id }, ...gs });
      if (Math.hypot(g.pos[0], g.pos[1], g.pos[2]) <= localMax * 1.02)
        localItems.push({ pos: new THREE.Vector3(g.pos[0], g.pos[1], g.pos[2]), color, label: o.name, data: { id: o.id }, ...gs });
    }
    this.localCustom = new MarkerLayer(localItems, { size: 15, atlas });
    this.cosmosCustom = new MarkerLayer(cosmosItems, { size: 15, atlas });
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

  // Bulk-add real objects (from a live catalogue) as discovered records, deduping
  // by name against the existing library. Rebuilds/persists once.
  bulkAddDiscovered(objects) {
    const seen = new Set(this.userStore.all().map((o) => o.name.toLowerCase()));
    let added = 0;
    for (const o of objects) {
      if (!o.name || seen.has(o.name.toLowerCase())) continue;
      seen.add(o.name.toLowerCase());
      const cat = this.atlasCategories[o.category];
      this.userStore.add({
        kind: 'discovered', source: o.source || 'catalogue', name: o.name,
        category: o.category, type: o.type || 'object', ra: o.ra, dec: o.dec, distLy: o.distLy || 0,
        facts: `Imported live from ${o.source || 'a catalogue'}${cat ? ` · ${cat.label}` : ''}.`,
      });
      added++;
    }
    this._rebuildCustom();
    this.emit('custom', this.userStore.all());
    return added;
  }

  async growCatalogue(preset, opts = {}) {
    let ra = 0, dec = 0;
    if (preset === 'nearby') {
      const d = new THREE.Vector3(); this.scene.camera.getWorldDirection(d);
      const c = cartesianToRaDec(d.x, d.y, d.z); ra = c.ra; dec = c.dec;
    }
    const res = await growFromCatalogue(preset, { ...opts, ra, dec });
    if (!res.ok) return res;
    const added = this.bulkAddDiscovered(res.objects.map((o) => ({ ...o, source: res.source })));
    return { ok: true, source: res.source, found: res.objects.length, added };
  }

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

  // Real ↔ fiction bridge: reveal the real Cosmic Atlas objects of a category
  // (e.g. a fictional "black hole" class -> the real black holes on the 3-D map).
  revealAtlasCategory(catKey) {
    const matches = this.atlas.map((o, i) => ({ o, i })).filter(({ o }) => o.category === catKey);
    if (!matches.length) return { ok: false, count: 0 };
    // setMode emits 'mode' synchronously, which rebuilds the atlas browser and
    // consumes _atlasInitialCat — so set the pre-filter *after* the mode switch.
    if (this.mode !== 'cosmos') this.setMode('cosmos');
    this.showAtlas = true; this.cosmosAtlas.setVisible(true);
    this.selectAtlas(matches[0].i, { fly: true });
    this._atlasInitialCat = catKey;
    this.emit('revealCategory', catKey);
    return { ok: true, count: matches.length };
  }
  atlasCategoryCount(catKey) { return this.atlas.filter((o) => o.category === catKey).length; }

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
    const localMax = this.catalog.meta.bounds.maxRadiusPc;
    const atlas = this._glyphAtlas;
    const mk = (it, pos, color, prio, glyphName) => ({ pos, color, label: it.name, prio, data: it, ...glyphSpec(glyphName) });

    // LOCAL: clusters within the true-scale range, placed by real parsec position
    const localItems = this.extras.clusters.filter((c) => c.distPc <= localMax * 1.02)
      .map((c) => mk(c, new THREE.Vector3(c.pos[0], c.pos[1], c.pos[2]), MARK_COLOR[c.type] || [1, 1, 1], 8, c.type));
    this.localClusters = new MarkerLayer(localItems, { size: 13, atlas });
    this.scene.scene.add(this.localClusters.points);
    this.localClusters.setVisible(true);

    // COSMOS: all clusters + structures, placed on the log-radial scale
    const cItems = this.extras.clusters.map((c) => mk(c, new THREE.Vector3(...c.dir).multiplyScalar(c.displayR), MARK_COLOR[c.type] || [1, 1, 1], 6, c.type));
    this.cosmosClusters = new MarkerLayer(cItems, { size: 12, atlas });
    const sItems = this.extras.structures.map((s) => mk(s, new THREE.Vector3(...s.dir).multiplyScalar(s.displayR), MARK_COLOR[s.type] || [1, 1, 1], 9, STRUCT_GLYPH[s.type]));
    this.cosmosStructures = new MarkerLayer(sItems, { size: 15, atlas });
    if (this.cosmos) { this.cosmos.group.add(this.cosmosClusters.points); this.cosmos.group.add(this.cosmosStructures.points); }
    this.showClusters = true; this.showStructures = true;

    // Cosmic Atlas — curated knowledge-base objects, coloured & iconed by category
    this.atlas = (this.extras.atlas && this.extras.atlas.objects) || [];
    this.atlasCategories = (this.extras.atlas && this.extras.atlas.categories) || {};
    const localAtlasItems = [];
    this.atlas.forEach((o, i) => {
      if (Math.hypot(o.pos[0], o.pos[1], o.pos[2]) <= localMax * 1.02)
        localAtlasItems.push({ pos: new THREE.Vector3(o.pos[0], o.pos[1], o.pos[2]), color: o.color, label: o.name, prio: 7, data: { atlasIndex: i }, ...glyphSpec(CAT_GLYPH[o.category]) });
    });
    this.localAtlas = new MarkerLayer(localAtlasItems, { size: 13, atlas });
    this.scene.scene.add(this.localAtlas.points);
    const cosmosAtlasItems = this.atlas.map((o, i) => ({ pos: new THREE.Vector3(...o.dir).multiplyScalar(o.displayR), color: o.color, label: o.name, prio: 7, data: { atlasIndex: i }, ...glyphSpec(CAT_GLYPH[o.category]) }));
    this.cosmosAtlas = new MarkerLayer(cosmosAtlasItems, { size: 13, atlas });
    if (this.cosmos) this.cosmos.group.add(this.cosmosAtlas.points);
    this.showAtlas = true;
  }

  // Resolve structures: a level-of-detail overlay that blooms clusters, Local
  // Group galaxies and notable atlas galaxies into their illustrative shapes as
  // the camera approaches (spiral/elliptical/irregular from the type string;
  // globular = dense sphere, open = loose scatter). Cosmos-mode only.
  _buildStructureShapes() {
    this.resolveStructures = false;
    if (!this.cosmos) { this.structureShapes = null; return; }
    const V = (dir, r) => new THREE.Vector3(dir[0] * r, dir[1] * r, dir[2] * r);
    const targets = [];
    for (const c of this.extras.clusters || []) {
      const center = V(c.dir, c.displayR);
      targets.push({ center, morph: morphFromType(c.type), R: c.type === 'globular' ? 0.22 : 0.3, seed: seedFromVec(center) });
    }
    for (const g of this.cosmosData.localGroup || []) {
      const center = V(g.dir, g.displayR);
      targets.push({ center, morph: morphFromType(g.type), R: 0.36, seed: seedFromVec(center) });
    }
    for (const o of this.atlas) {
      if (o.category !== 'galaxy') continue;
      const center = V(o.dir, o.displayR);
      targets.push({ center, morph: morphFromType(o.type), R: 0.34, seed: seedFromVec(center) });
    }
    this.structureShapes = new StructureShapes(targets, { near: 1.2, far: 4.5, size: 2.4 });
    this.cosmos.group.add(this.structureShapes.points);
  }

  setResolveStructures(on) {
    this.resolveStructures = !!on;
    if (this.structureShapes) this.structureShapes.setVisible(this.resolveStructures);
  }

  // Flat image billboards (real sky cutouts) for notable galaxies in cosmos view.
  _buildGalaxyBillboards() {
    this.showGalaxyImagery = false;
    if (!this.cosmos) { this.galaxyBillboards = null; return; }
    const sizeFor = (kpc) => Math.max(0.8, Math.min(2.8, 0.9 + (kpc || 25) / 22));
    const items = [];
    for (const o of this.atlas) {
      if (o.category !== 'galaxy') continue;
      const kpc = diameterKpcFor(o);
      items.push({ pos: new THREE.Vector3(...o.dir).multiplyScalar(o.displayR), raDeg: o.ra * 15, dec: o.dec, distMpc: (o.distLy || 0) / 3.2615638e6, diameterKpc: kpc, size: sizeFor(kpc) });
    }
    for (const g of this.cosmosData.localGroup || []) {
      const kpc = diameterKpcFor(g);
      items.push({ pos: new THREE.Vector3(...g.dir).multiplyScalar(g.displayR), raDeg: g.ra, dec: g.dec, distMpc: g.distMpc, diameterKpc: kpc, size: sizeFor(kpc) });
    }
    const surveys = this._gxSurvey ? [this._gxSurvey, 'CDS/P/DSS2/color'] : undefined; // SDSS→DSS2 auto
    const loadTexture = async (it) => {
      if (this._gxImageOverride) { const d = await loadImageData(this._gxImageOverride); return new THREE.CanvasTexture(d.canvas); }
      const r = await pickSurveyImage(it.raDeg, it.dec, fovForGalaxy(it.distMpc, it.diameterKpc), { surveys, size: 256 });
      return new THREE.CanvasTexture(r.imgData.canvas);
    };
    this.galaxyBillboards = new GalaxyBillboards(this.cosmos.group, items, { loadTexture });
  }

  setGalaxyImagery(on) {
    this.showGalaxyImagery = !!on;
    if (this.galaxyBillboards) this.galaxyBillboards.setVisible(this.showGalaxyImagery);
  }

  // ===== galaxy interior: fly inside a galaxy, explore & route among its stars =====
  qualityStarCount() { return this._interiorQuality || 120000; }
  setInteriorQuality(n) { this._interiorQuality = Math.max(10000, Math.min(3000000, n | 0)); }

  // Build a navigable interior for a selected galaxy. Tries a live sky cutout so
  // the star field mirrors the real image; falls back to procedural morphology.
  async enterGalaxy(info, { keepRoute = false } = {}) {
    info = info || this.selection?.info; if (!info) return { ok: false };
    this._lastGalaxyInfo = info;
    if (this._inGalaxy) this.exitGalaxy({ keepRoute });
    const name = info.name || 'galaxy';
    this.emit('galaxy', { name, loading: true, inside: true });
    const R = 30;                                  // interior world radius (units)
    const count = this.qualityStarCount();
    const ra = info.ra, dec = info.dec;             // ra is in HOURS
    const raDeg = ra != null ? ra * 15 : null;      // hips2fits / SIMBAD want degrees
    const distMpc = info.distMpc || info.comovingMpc || (info.distLy ? info.distLy / 3.2615638e6 : null);
    const seed = seedFromVec(info.worldPos || new THREE.Vector3(3, 5, 7)) % 100000;

    // real physical size: curated default, refined by a live SIMBAD angular size
    let diameterKpc = diameterKpcFor(info), fovDeg = fovForGalaxy(distMpc, diameterKpc);
    if (this._gxSizeLookup !== false && raDeg != null && dec != null && distMpc) {
      try {
        const sz = await fetchAngularSize(raDeg, dec);
        if (sz.ok && sz.majAxisArcmin > 0) {
          fovDeg = Math.max(0.02, Math.min(3.0, (sz.majAxisArcmin / 60) * 1.5));
          const physKpc = (sz.majAxisArcmin / 60) * (Math.PI / 180) * distMpc * 1000;
          if (physKpc > 0.5 && physKpc < 200) diameterKpc = physKpc;
        }
      } catch (e) { /* keep curated size */ }
    }
    const pcPerUnit = (diameterKpc * 500) / R;      // (D/2 in pc) / R

    const surveys = this._gxSurvey ? [this._gxSurvey, 'CDS/P/DSS2/color'] : undefined; // undefined → SDSS→DSS2 auto
    let cloud = null, imageDerived = false, survey = null;
    if (this._gxImageOverride || (raDeg != null && dec != null)) {
      try {
        let imgData;
        if (this._gxImageOverride) { imgData = await loadImageData(this._gxImageOverride); survey = 'custom'; }
        else { const r = await pickSurveyImage(raDeg, dec, fovDeg, { surveys, size: 512 }); imgData = r.imgData; survey = surveyLabel(r.survey); }
        const c = imageToCloud(imgData, { count, R, thickness: 0.05, seed });
        if (c.count > count * 0.4) { cloud = c; imageDerived = true; }
      } catch (e) { /* offline / CORS blocked → procedural fallback */ }
    }
    if (!cloud) {
      let morph = morphFromType(info.type || info.sub || '');
      if (morph === 'globular' || morph === 'open') morph = 'spiral';
      cloud = structureCloud(morph, R, seed, { count });
    }
    this.interior = new GalaxyInterior(cloud, { pcPerUnit, name, imageDerived });
    this.scene.scene.add(this.interior.group);
    this._galaxyReturn = { camPos: this.scene.camera.position.clone(), target: this.scene.controls.target.clone() };
    this._inGalaxy = true;
    this._hideForInterior();
    this.clearSelection();
    if (!keepRoute) { this.clearRoute(); this.clearFocus(); }
    this.scene.setView(new THREE.Vector3(R * 0.9, R * 0.45, R * 1.15), new THREE.Vector3(0, 0, 0));
    this.emit('galaxy', { name, inside: true, imageDerived, count: cloud.count, diameterKpc, survey });
    return { ok: true, imageDerived, count: cloud.count, diameterKpc, survey };
  }

  exitGalaxy({ keepRoute = false } = {}) {
    if (!this._inGalaxy) return;
    this.clearSelection();
    if (!keepRoute) this.clearRoute();
    this.scene.scene.remove(this.interior.group); this.interior.dispose(); this.interior = null;
    this._inGalaxy = false;
    this._restoreFromInterior();
    const r = this._galaxyReturn;
    if (r) this.scene.setView(r.camPos, r.target);
    this.emit('galaxy', { inside: false });
  }

  _hideForInterior() {
    this.starfield.points.visible = false;
    this.scene.setReferenceVisible(false);
    this.voyageLayer.setVisible(false);
    this.cosmos.setVisible(false);
    for (const l of [this.localClusters, this.cosmosClusters, this.cosmosStructures, this.localAtlas, this.cosmosAtlas, this.localCustom, this.cosmosCustom]) l && l.setVisible(false);
    if (this.structureShapes) this.structureShapes.setVisible(false);
    if (this.routeGroup) this.routeGroup.visible = false;      // hide the cosmos-scale route line
    if (this.sectorGridGroup) this.sectorGridGroup.visible = false;
    this.labels.setStatic([]); this.labels.setStars([]); this.labels.setMarkers([]); this.labels.setVoyage([]);
  }
  _restoreFromInterior() {
    if (this.routeGroup) this.routeGroup.visible = true;
    if (this.sectorGridGroup) this.sectorGridGroup.visible = this.showSectorGrid;
    if (this.mode === 'cosmos') {
      this.cosmos.setVisible(true); this.cosmos.applyFilter({});
      this.cosmosClusters.setVisible(this.showClusters); this.cosmosStructures.setVisible(this.showStructures);
      this.cosmosAtlas.setVisible(this.showAtlas); this.cosmosCustom.setVisible(this.showCustom);
      if (this.structureShapes) this.structureShapes.setVisible(this.resolveStructures);
      this._applyCosmosLabels();
    } else {
      this.starfield.points.visible = true; this.scene.setReferenceVisible(true);
      this.localClusters.setVisible(this.showClusters); this.localAtlas.setVisible(this.showAtlas);
      this.localCustom.setVisible(this.showCustom);
      this._applyLocalLabels();
    }
  }

  selectInteriorStar(i, { fly = false } = {}) {
    if (!this.interior || i < 0) return;
    const wp = this.interior.starWorld(i);
    const distLy = this.interior.starDistPc(i) * PC_TO_LY;
    const truePos = wp.clone().multiplyScalar(this.interior.pcPerUnit);
    const desig = `${this.interior.name.replace(/\s*\(.*\)/, '')}-${(i % 99999).toString().padStart(5, '0')}`;
    const info = { kind: 'interiorStar', name: desig, galaxy: this.interior.name, distLy, distFromCoreLy: distLy, imageDerived: this.interior.imageDerived };
    this._setSelection({ kind: 'interiorStar', worldPos: wp.clone(), truePos, info });
    if (fly) this.scene.flyTo(wp.clone(), { approach: Math.max(2, this.interior.extent() * 0.08) });
  }

  _buildRouteLayer() {
    this.routeGroup = new THREE.Group();
    this.scene.scene.add(this.routeGroup);
    this._routeRing = makeRingTexture('#7bf0a0', true);
  }

  // A polar "sector" grid: radial spokes at each 2h of RA on the equatorial plane
  // + the celestial polar axis. Reads like a spaceship map graticule; toggleable.
  _buildSectorGrid() {
    this.showSectorGrid = false;
    const g = new THREE.Group();
    const L = 1e5;
    const mkLine = (a, b, col, op) => {
      const m = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op });
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), m);
      l.frustumCulled = false; g.add(l);
    };
    for (let h = 0; h < 24; h += 2) {
      const a = h / 24 * Math.PI * 2, cardinal = h % 6 === 0;
      mkLine(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * L, Math.sin(a) * L, 0),
        cardinal ? 0x3f7fa0 : 0x24506a, cardinal ? 0.5 : 0.28);
    }
    mkLine(new THREE.Vector3(0, 0, -L), new THREE.Vector3(0, 0, L), 0x3f7fa0, 0.4); // polar axis
    g.visible = false;
    this.sectorGridGroup = g;
    this.scene.scene.add(g);
  }
  setSectorGrid(on) { this.showSectorGrid = !!on; if (this.sectorGridGroup) this.sectorGridGroup.visible = this.showSectorGrid; }

  on(evt, cb) { (this._listeners[evt] ||= []).push(cb); return this; }
  emit(evt, ...a) { (this._listeners[evt] || []).forEach((cb) => cb(...a)); }

  // ================= mode switching =================
  setMode(mode) {
    if (this._inGalaxy) this.exitGalaxy();
    if (this.cruise && !this._inCruiseNav) this.stopCruise();
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
    if (this._inGalaxy && this.interior) return worldPos.clone().multiplyScalar(this.interior.pcPerUnit);
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
    this.stopCruise(); this.stopVoyage();   // only one guided mode drives the camera
    this.clearSelection();
    this.autopilot = { seg: 0, t: 0, paused: false, speed: 0.11, descended: new Set(), atGalaxy: null };
    // initial follow offset: behind & above the first leg. Controls stay enabled
    // so you can orbit / zoom around the ship while it flies.
    const a = this.route[0].worldPos, b = this.route[1].worldPos;
    const fwd = b.clone().sub(a); const segLen = fwd.length() || 1; fwd.normalize();
    const up = new THREE.Vector3(0, 0, 1);
    const back = Math.max(0.5, segLen * 0.28);
    this.scene.setView(a.clone().addScaledVector(fwd, -back).addScaledVector(up, back * 0.5), a.clone());
    this.scene.controls.enabled = true;
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
    const wasDescended = !!this.autopilot.atGalaxy;
    this.autopilot = null;
    if (this._inGalaxy) this.exitGalaxy();  // disengaging inside a galaxy leaves it
    this.scene.controls.enabled = true;
    this.scene.controls.update();
    this.emit('nav', null);
    return wasDescended;
  }

  // If the waypoint just reached is a galaxy descent point, pause & drop inside.
  _maybeDescend(seg) {
    const ap = this.autopilot; if (!ap) return false;
    const wp = this.route[seg];
    if (wp && wp.galaxy && !ap.descended.has(seg)) {
      ap.descended.add(seg); ap.paused = true; ap.atGalaxy = 'pending';
      this._descendAtWaypoint(wp);
      return true;
    }
    return false;
  }

  // Called when the autopilot arrives at a galaxy waypoint: pause & drop inside.
  async _descendAtWaypoint(wp) {
    this.emit('nav', this._navReadout());               // "descending…"
    await this.enterGalaxy(wp.galaxy, { keepRoute: true });
    if (!this.autopilot) return;                          // disengaged during load
    this.autopilot.atGalaxy = wp.galaxy.name;
    this.scene.controls.enabled = true;                  // free-look inside the galaxy
    this.emit('nav', this._navReadout());
  }

  // Resume the course after a galaxy descent: rise out and fly on.
  resumeFromGalaxy() {
    const ap = this.autopilot; if (!ap || !ap.atGalaxy) return;
    ap.atGalaxy = null;
    this.exitGalaxy({ keepRoute: true });                // restores cosmos + camera to the waypoint
    this.scene.controls.enabled = true;                  // keep orbit/zoom during flight
    ap.paused = false;
    this.emit('nav', this._navReadout());
  }
  navSetSpeed(v) { if (this.autopilot) this.autopilot.speed = v; }

  _updateAutopilot(dt) {
    const ap = this.autopilot; if (!ap) return;
    if (ap.atGalaxy) return; // descended into a galaxy — the user explores; resume to continue
    const pts = this.route.map((r) => r.worldPos);
    if (!ap.paused) {
      let remaining = ap.speed * dt * this._routeSpan();
      while (remaining > 0 && ap.seg < pts.length - 1) {
        const segLen = Math.max(1e-6, pts[ap.seg].distanceTo(pts[ap.seg + 1]));
        const along = segLen * ap.t + remaining;
        if (along >= segLen) {
          remaining = along - segLen; ap.seg++; ap.t = 0;
          if (this._maybeDescend(ap.seg)) return; // arrived at a galaxy waypoint → drop inside
        } else { ap.t = along / segLen; remaining = 0; }
      }
      if (ap.seg >= pts.length - 1) {
        if (this._maybeDescend(ap.seg)) return; // final stop is a galaxy → descend before finishing
        this._navReadoutFinal(); this.stopRoute(); return;
      }
    }
    const a = pts[ap.seg], b = pts[ap.seg + 1];
    const cur = a.clone().lerp(b, ap.t);
    // follow-cam: shift the camera by exactly how far the target advanced this
    // frame, preserving whatever orbit/zoom offset the user has set. Controls stay
    // enabled, so drag/scroll works while the ship flies. (scene.update() calls
    // controls.update() right after this.)
    const delta = cur.clone().sub(this.scene.controls.target);
    this.scene.camera.position.add(delta);
    this.scene.controls.target.copy(cur);
  }

  _routeSpan() {
    let s = 0;
    for (let i = 1; i < this.route.length; i++) s += this.route[i].worldPos.distanceTo(this.route[i - 1].worldPos);
    return Math.max(1, s) * 0.12;
  }

  _navReadout() {
    const ap = this.autopilot; if (!ap) return null;
    if (ap.atGalaxy === 'pending') return { descending: true, seg: ap.seg, total: this.route.length - 1 };
    if (ap.atGalaxy) return { insideGalaxy: ap.atGalaxy, seg: ap.seg, total: this.route.length - 1 };
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
  // ================= preset expeditions (story routes) =================
  // Resolve an expedition stop {star|obj|ra/dec/distLy} to { label, ra(h), dec, distLy }.
  _resolveWaypoint(w) {
    if (w.ra != null && w.dec != null) return { label: w.label || 'waypoint', ra: w.ra, dec: w.dec, distLy: w.distLy || 0, note: w.note };
    if (w.star) {
      const q = String(w.star).toLowerCase();
      if (q === 'sol' || q === 'sun') return { label: w.label || 'Sol', ra: 0, dec: 0, distLy: 0, note: w.note };
      const list = this.catalog.search || [];
      const e = list.find((s) => (s.name || '').toLowerCase() === q) || list.find((s) => (s.name || '').toLowerCase().includes(q));
      if (e) { const i = e.i, x = this.catalog.x(i), y = this.catalog.y(i), z = this.catalog.z(i); const { ra, dec, r } = cartesianToRaDec(x, y, z); return { label: w.label || e.name, ra, dec, distLy: r * PC_TO_LY, note: w.note }; }
      return null;
    }
    if (w.obj) {
      const q = String(w.obj).toLowerCase();
      const find = (arr) => arr.find((o) => (o.name || '').toLowerCase() === q) || arr.find((o) => (o.name || '').toLowerCase().includes(q));
      let o = find(this.atlas);
      if (o) return { label: w.label || o.name, ra: o.ra, dec: o.dec, distLy: o.distLy, note: w.note };
      o = find(this.cosmosData.localGroup || []);
      if (o) return { label: w.label || o.name, ra: o.ra / 15, dec: o.dec, distLy: o.distLy, note: w.note }; // localgroup ra in degrees
      o = find(this.extras.structures || []);
      if (o) return { label: w.label || o.name, ra: o.ra, dec: o.dec, distLy: o.distGly != null ? o.distGly * 1e9 : (o.distMpc || 0) * 3.2615638e6, note: w.note };
      o = find(this.extras.clusters || []);
      if (o) return { label: w.label || o.name, ra: o.ra, dec: o.dec, distLy: o.distLy, note: w.note };
      return null;
    }
    return null;
  }

  // Load a preset expedition into the route (mode-aware), ready to ENGAGE.
  loadExpedition(exp) {
    if (typeof exp === 'string') exp = this.expeditions.find((e) => e.id === exp);
    if (!exp) return { ok: false };
    this.stopCruise();          // tracing supersedes any running cruise
    if (this._inGalaxy) this.exitGalaxy();
    const scale = exp.scale === 'local' ? 'local' : 'cosmos';
    if (this.mode !== scale) this.setMode(scale);
    if (this.autopilot) this.stopRoute();
    this.clearSelection(); this.clearRoute();
    this.cruiseSpeed = exp.cruiseC || this.cruiseSpeed;
    const D = this.cosmos ? this.cosmos.decadeUnit : 3;
    this.route = [];
    (exp.stops || []).forEach((stop, i) => {
      const w = this._resolveWaypoint(stop); if (!w) return;
      const distPc = Math.max((w.distLy || 0) / PC_TO_LY, 0);
      const ra = w.ra * 15 * Math.PI / 180, dec = w.dec * Math.PI / 180, cd = Math.cos(dec);
      const dir = new THREE.Vector3(cd * Math.cos(ra), cd * Math.sin(ra), Math.sin(dec));
      const truePos = dir.clone().multiplyScalar(distPc);
      const worldPos = this.mode === 'cosmos' ? dir.clone().multiplyScalar(D * Math.log10(Math.max(distPc, 1))) : truePos.clone();
      const wp = { worldPos, truePos, label: w.label || `stop ${i + 1}`, kind: stop.enter ? 'galaxy' : 'expedition' };
      // a descent waypoint: ENGAGE will pause here and drop inside the galaxy
      if (stop.enter && this.mode === 'cosmos') wp.galaxy = { name: w.label, ra: w.ra, dec: w.dec, distMpc: (w.distLy || 0) / 3.2615638e6, type: this._objType(stop.obj) || 'spiral', worldPos: worldPos.clone() };
      this.route.push(wp);
    });
    this._redrawRoute(); this.emit('route', this._routeSummary());
    this._activeExpedition = { id: exp.id, title: exp.title, premise: exp.premise, scale, length: exp.length, stops: this.route.map((w) => ({ label: w.label })) };
    this.emit('expedition', this._activeExpedition);
    this._fitRouteView();
    return { ok: true, stops: this.route.length };
  }

  // Frame the whole route in view.
  _fitRouteView() {
    if (!this.route.length) return;
    const box = new THREE.Box3();
    for (const r of this.route) box.expandByPoint(r.worldPos);
    const c = box.getCenter(new THREE.Vector3());
    const radius = Math.max(1.5, box.getSize(new THREE.Vector3()).length() * 0.5);
    const camPos = c.clone().add(new THREE.Vector3(0.5, 0.35, 1).setLength(radius * 2.4 + 3));
    this.scene.flyTo(c, { camPos, dur: 1.5 });
  }

  // Map / sector coordinate of a look direction + distance — a spaceship-map grid cell.
  sectorCode(dir, distLy) {
    const { ra, dec } = cartesianToRaDec(dir.x, dir.y, dir.z); // ra hours, dec deg
    const col = 'ABCDEFGHJKLMNPQRSTUVWX'[Math.min(21, Math.floor(ra / 24 * 22))]; // 22 RA columns
    const row = Math.min(17, Math.max(0, Math.floor((dec + 90) / 10)));           // 18 Dec rows (10°)
    let tier = 0;
    if (this._inGalaxy) tier = distLy > 0 ? Math.max(1, Math.ceil(Math.log10(distLy + 1))) : 0;
    else if (distLy > 0) tier = Math.max(1, Math.min(11, Math.floor(Math.log10(distLy)) + 1)); // ~decades of ly
    return `${col}${String(row).padStart(2, '0')}·${tier}`;
  }

  // free-text type of a named object (for interior morphology)
  _objType(q) {
    if (!q) return null;
    const s = String(q).toLowerCase();
    const find = (arr) => arr.find((o) => (o.name || '').toLowerCase() === s) || arr.find((o) => (o.name || '').toLowerCase().includes(s));
    return (find(this.atlas)?.type) || (find(this.cosmosData.localGroup || [])?.type) || null;
  }

  // ---- expedition cruise: a stepped, cinematic tour that can change scale and
  // descend INTO galaxies mid-voyage (a chapter with enter:true) ----
  startExpeditionCruise(exp) {
    if (typeof exp === 'string') exp = this.expeditions.find((e) => e.id === exp);
    if (!exp) return { ok: false };
    this.stopVoyage();
    if (this.autopilot) this.stopRoute();
    this.clearRoute(); this.clearSelection();
    const baseScale = exp.scale === 'local' ? 'local' : 'cosmos';
    const D = this.cosmos ? this.cosmos.decadeUnit : 3;
    const chapters = [];
    for (const w of (exp.stops || [])) {
      const r = this._resolveWaypoint(w); if (!r) continue;
      const distPc = Math.max((r.distLy || 0) / PC_TO_LY, 0);
      const ra = r.ra * 15 * Math.PI / 180, dec = r.dec * Math.PI / 180, cd = Math.cos(dec);
      const dir = new THREE.Vector3(cd * Math.cos(ra), cd * Math.sin(ra), Math.sin(dec));
      const truePos = dir.clone().multiplyScalar(distPc);
      const cosmosPos = dir.clone().multiplyScalar(D * Math.log10(Math.max(distPc, 1)));
      if (w.enter) {
        chapters.push({ kind: 'interior', label: r.label, note: r.note, truePos,
          galaxyInfo: { name: r.label, ra: r.ra, dec: r.dec, distMpc: (r.distLy || 0) / 3.2615638e6, type: this._objType(w.obj) || 'spiral', worldPos: cosmosPos } });
      } else {
        chapters.push({ kind: baseScale, label: r.label, note: r.note, truePos,
          worldPos: baseScale === 'cosmos' ? cosmosPos : truePos.clone() });
      }
    }
    if (!chapters.length) return { ok: false };
    this.cruise = { exp: { id: exp.id, title: exp.title, premise: exp.premise }, chapters, index: -1, scale: baseScale };
    this.cruiseGoto(0);
    return { ok: true, chapters: chapters.length };
  }

  async cruiseGoto(i) {
    const c = this.cruise; if (!c) return;
    i = Math.max(0, Math.min(c.chapters.length - 1, i));
    const ch = c.chapters[i];
    const token = (c._token = (c._token || 0) + 1); // guard against overlapping async steps
    // leave an interior we're no longer meant to be in
    if (this._inGalaxy && !(ch.kind === 'interior' && this.interior && this.interior.name === ch.label)) this.exitGalaxy();
    if (ch.kind === 'interior') {
      if (this.mode !== 'cosmos') { this._inCruiseNav = true; this.setMode('cosmos'); this._inCruiseNav = false; }
      c.index = i; this.emit('cruise', this._cruiseReadout(i, true)); // "descending…"
      if (!(this._inGalaxy && this.interior && this.interior.name === ch.label)) {
        await this.enterGalaxy(ch.galaxyInfo);
      }
      if (!this.cruise || c._token !== token) return; // superseded / cancelled
    } else {
      if (this.mode !== ch.kind) { this._inCruiseNav = true; this.setMode(ch.kind); this._inCruiseNav = false; }
      const approach = this.mode === 'cosmos' ? 2.4 : Math.max(3, ch.worldPos.length() * 0.12);
      this.scene.flyTo(ch.worldPos.clone(), { approach, dur: 1.6 });
    }
    c.index = i;
    this.emit('cruise', this._cruiseReadout(i, false));
  }

  cruiseStep(d) { if (this.cruise) this.cruiseGoto(this.cruise.index + d); }
  stopCruise() {
    if (!this.cruise) return;
    this.cruise = null;
    if (this._inGalaxy) this.exitGalaxy();
    this.emit('cruise', null);
  }
  _cruiseReadout(i, loading) {
    const c = this.cruise; if (!c) return null;
    const ch = c.chapters[i];
    let legLy = 0;
    if (i > 0) legLy = new THREE.Vector3().subVectors(ch.truePos, c.chapters[i - 1].truePos).length() * PC_TO_LY;
    return {
      title: c.exp.title, premise: c.exp.premise, index: i, total: c.chapters.length,
      label: ch.label, note: ch.note, interior: ch.kind === 'interior', loading: !!loading,
      legLy, legTime: this._legTimes(legLy),
    };
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
    const bloomable = info.kind === 'galaxy' || info.kind === 'localgalaxy' || (info.kind === 'procedural' && info.pType === 'galaxy');
    if (!bloomable) return;
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
    this.stopCruise(); if (this.autopilot) this.stopRoute();
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
    this.stopCruise(); if (this.autopilot) this.stopRoute();
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
      if (this._inGalaxy) { const i = this.interior.pick(this._ray, this.scene.camera); return i >= 0 ? { interiorStar: i } : null; }
      // labelled markers (clusters/structures) take priority when the cursor is on them
      const ex = this._pickExtra();
      if (ex) return ex;
      if (this.mode === 'local') { const i = this.starPicker.pick(ndc(e)); return i >= 0 ? { star: i } : null; }
      return this.cosmos.pick(this._ray);
    };
    const dispatch = (hit, fly) => {
      if (!hit) { if (!fly) this.clearSelection(); return; }
      if (hit.interiorStar != null) this.selectInteriorStar(hit.interiorStar, { fly });
      else if (hit.star != null) this.selectStar(hit.star, { fly });
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
      if (this.mode === 'cosmos') {
        this.cosmos.update(this.scene.camera);
        if (this.resolveStructures && this.structureShapes) this.structureShapes.update(this.scene.camera);
        if (this.showGalaxyImagery && this.galaxyBillboards) this.galaxyBillboards.update(this.scene.camera);
      }
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
    if (this._inGalaxy) {
      const i = this.interior.pick(this._ray, this.scene.camera);
      const key = 'in' + i;
      if (key !== this._hover.key) {
        this._hover.key = key;
        this.emit('hover', i >= 0 ? { text: `★ ${esc(this.interior.name)} · ${(this.interior.starDistPc(i) * PC_TO_LY / 1000).toFixed(1)} kly from core`, x: this._hover.x, y: this._hover.y } : null);
      }
      return;
    }
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
      // exclude the (huge) procedural layer from hover picking to keep it smooth;
      // it stays fully selectable on click.
      const hit = this.cosmos.pick(this._ray, { includeProcedural: false });
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
    let sectorDistLy;
    if (this._inGalaxy) sectorDistLy = cam.position.length() * this.interior.pcPerUnit * PC_TO_LY;
    else if (this.mode === 'cosmos') sectorDistLy = Math.pow(10, Math.min(cam.position.length(), this.cosmos.cmbR) / this.cosmos.decadeUnit) * PC_TO_LY;
    else sectorDistLy = cam.position.length() * PC_TO_LY;
    this.emit('frame', {
      mode: this._inGalaxy ? 'galaxy' : this.mode, camPos: cam.position, camRadius: cam.position.length(), dir, fov: cam.fov,
      visible: this.mode === 'local' ? this.starfield.visibleCount : this.cosmos.visibleCount(),
      decadeUnit: this.cosmos?.decadeUnit || 3, cmbR: this.cosmos?.cmbR || 30,
      focus: this.focus ? this.focus.label : null,
      sector: this.sectorCode(dir.lengthSq() > 1e-9 ? dir : new THREE.Vector3(1, 0, 0), sectorDistLy),
      galaxy: this._inGalaxy ? { name: this.interior.name, stars: this.interior.count, rangeLy: cam.position.length() * this.interior.pcPerUnit * PC_TO_LY } : null,
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
function surveyLabel(hips) {
  if (!hips) return null;
  if (/sdss/i.test(hips)) return 'SDSS';
  if (/dss2/i.test(hips)) return 'DSS2';
  if (/2mass/i.test(hips)) return '2MASS';
  if (/panstarrs|ps1/i.test(hips)) return 'PanSTARRS';
  return hips.split('/').pop();
}
function hoverCosmos(o) {
  if (o.kind === 'localgalaxy') return `${esc(o.name)} · ${(o.distLy / 1e6).toFixed(1)} Mly`;
  if (o.kind === 'procedural') return `✦ ${esc(o.name)} · z=${o.z.toFixed(3)} · imagined`;
  return `${o.kind === 'quasar' ? 'Quasar' : 'Galaxy'} · z=${o.z.toFixed(3)} · ${(o.comovingMpc * 3.2615638e6 / 1e9).toFixed(2)} Gly`;
}
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
