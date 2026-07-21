#!/usr/bin/env node
// Build the DEEPTIME dataset — the procedurally-generated far-future (~50 Gyr)
// universe on the same logarithmic-radial scale as COSMOS, but MORE EXTENDED (the
// expansion has accelerated: R = cosmos.cmbR × EXTENSION) and MORE STRUCTURED: a
// cosmic web of hubs, filaments and walls, threaded with a full catalogue of QTR
// deep-time cosmic OBJECTS, EVENTS and hazard/frontier REGIONS drawn from the
// bestiary — each cross-linked to its codex entry so a picked object opens its lore.
//
// Positions are stored NORMALISED to R (|pos| ≲ 1); the renderer multiplies by its
// own R so the dataset is independent of the exact display scale. The dense field
// of ~140k background galaxies stays procedural at runtime (cheap, seeded); this
// file carries the CURATED structure the renderer and the codex hang off.
//
// Output: public/data/deeptime.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/cosmos-meta.json'), 'utf8'));

const EXTENSION = 1.62;                 // deeptime reaches past the cosmos horizon
const SEED = 0xDEE9714E;

// ---- deterministic RNG (mulberry32) + helpers -----------------------------
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const R = rng(SEED);
const rnd = () => R();
const pick = (a) => a[Math.floor(rnd() * a.length)];
const gauss = (s) => (rnd() + rnd() + rnd() - 1.5) * s;
const round = (v, p = 4) => Math.round(v * 10 ** p) / 10 ** p;
const V = (x, y, z) => [round(x), round(y), round(z)];
const len = (p) => Math.hypot(p[0], p[1], p[2]);
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const jit = (s) => [gauss(s), gauss(s), gauss(s)];

// evocative far-future names
const SYL_A = ['Aeon', 'Vael', 'Sōr', 'Thren', 'Ixa', 'Orun', 'Kael', 'Nyx', 'Zeph', 'Umbra', 'Cael', 'Drav', 'Eryn', 'Mor', 'Ossa', 'Vyre', 'Halla', 'Tavu', 'Onei', 'Skarn', 'Yl', 'Wend', 'Corv', 'Aval'];
const SYL_B = ['reach', 'wold', 'mere', 'spire', 'fold', 'gyre', 'holt', 'run', 'drift', 'vault', 'shoal', 'coil', 'wane', 'span', 'loom', 'crest', 'hollow', 'weald', 'deep', 'verge'];
const nm = () => pick(SYL_A) + ' ' + (pick(SYL_B).replace(/^./, (c) => c.toUpperCase()));
const tag = (pre) => `${pre}-${100 + Math.floor(rnd() * 8900)}`;

const GTYPES = ['spiral', 'elliptical', 'lenticular', 'irregular', 'dwarf'];
// far-future species archetypes (from the projected species spectrum) + eras
const SPECIES = ['Neo-Sapiens Federates', 'Bio-Digital Symbionts', 'High-Gravity Compact Toolmakers', 'Oceanic Cephaliform Engineers', 'Low-Gravity Tall Gliders', 'Colonial Photosynthetic Minds', 'Regressive Human Offshoots', 'Ammonia-World Chemotroph Intellects', '—'];
const ERAS = ['Oceanic', 'Eonic', 'Galactic', 'Chronal'];

// ---- 1) the cosmic web: hubs (nodes) + filaments + walls ------------------
const HUBS = 54;
const hubs = [];
for (let i = 0; i < HUBS; i++) {
  // cosmologically-spaced shells, biased inward (dense core, thinning out)
  const rf = Math.min(0.98, 0.06 + 0.92 * Math.pow(rnd(), 1.35));
  const u = rnd(), v = rnd(), th = Math.acos(2 * u - 1), ph = 2 * Math.PI * v;
  const p = V(rf * Math.sin(th) * Math.cos(ph), rf * Math.sin(th) * Math.sin(ph) * 0.82, rf * Math.cos(th));
  const supercluster = rnd() < 0.16;         // a few dense supercluster nodes
  hubs.push({ i, pos: p, rf: round(rf, 3), supercluster });
}
// filaments: each hub to its 2–3 nearest; plus a few long "wall" cross-links
const filaments = [];
const seen = new Set();
const key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
for (let i = 0; i < HUBS; i++) {
  const near = hubs.map((h) => [h.i, len([hubs[i].pos[0] - h.pos[0], hubs[i].pos[1] - h.pos[1], hubs[i].pos[2] - h.pos[2]])]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]);
  const n = 2 + (rnd() < 0.5 ? 1 : 0);
  for (let k = 0; k < n; k++) { const j = near[k][0]; if (!seen.has(key(i, j))) { seen.add(key(i, j)); filaments.push([i, j, 'filament']); } }
}
for (let w = 0; w < 10; w++) {           // sheet-like walls between farther nodes
  const a = Math.floor(rnd() * HUBS); const b = Math.floor(rnd() * HUBS);
  if (a !== b && !seen.has(key(a, b))) { seen.add(key(a, b)); filaments.push([a, b, 'wall']); }
}

// placement helpers along the web
const onFilament = (jitter = 0.02) => { const [a, b] = pick(filaments); const t = 0.12 + 0.76 * rnd(); return add(lerp(hubs[a].pos, hubs[b].pos, t), jit(jitter)); };
const atHub = (jitter = 0.015, superOnly = false) => { const pool = superOnly ? hubs.filter((h) => h.supercluster) : hubs; const h = pick(pool.length ? pool : hubs); return add(h.pos, jit(jitter)); };
const inVoid = () => { // a point away from any filament (drop into the emptier regions)
  let best = null, bestD = -1;
  for (let tries = 0; tries < 8; tries++) {
    const rf = 0.25 + 0.6 * rnd(); const u = rnd(), v = rnd(), th = Math.acos(2 * u - 1), ph = 2 * Math.PI * v;
    const p = V(rf * Math.sin(th) * Math.cos(ph), rf * Math.sin(th) * Math.sin(ph), rf * Math.cos(th));
    let dmin = Infinity;
    for (const [a, b] of filaments) { const d = distToSeg(p, hubs[a].pos, hubs[b].pos); if (d < dmin) dmin = d; }
    if (dmin > bestD) { bestD = dmin; best = p; }
  }
  return best;
};
const nearHorizon = () => { const u = rnd(), v = rnd(), th = Math.acos(2 * u - 1), ph = 2 * Math.PI * v; const rf = 0.9 + 0.08 * rnd(); return V(rf * Math.sin(th) * Math.cos(ph), rf * Math.sin(th) * Math.sin(ph), rf * Math.cos(th)); };
function distToSeg(p, a, b) { const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]; const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1))); const c = [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]; return len([p[0] - c[0], p[1] - c[1], p[2] - c[2]]); }

// ---- 2) anchors — the 120 named, navigable galaxies -----------------------
const ANCHORS = 120;
const anchors = [];
for (let i = 0; i < ANCHORS; i++) {
  let pos, type, name, gtag, diameterKpc, home = false;
  if (i === 0) { pos = V(0, 0, 0); type = 'elliptical'; name = 'Aeon Hearth'; gtag = 'HOME'; diameterKpc = 210; home = true; }
  else { pos = onFilament(0.02); type = pick(GTYPES); name = nm(); gtag = tag(pick(['DG', 'FL', 'AR'])); diameterKpc = 18 + Math.pow(rnd(), 1.5) * 120; }
  const rf = round(len(pos), 3);
  const massMsun = round((type === 'elliptical' ? 4 : type === 'dwarf' ? 0.02 : 1) * (0.4 + rnd() * 2.5) * 1e11, 0);
  anchors.push({
    i, name, tag: gtag, type, pos, rf, diameterKpc: round(diameterKpc, 1), massMsun,
    era: home ? 'Oceanic' : pick(ERAS), species: home ? 'Neo-Sapiens Federates' : pick(SPECIES),
    driveClass: rf < 0.25 ? 'I' : rf < 0.55 ? 'II' : rf < 0.85 ? 'III' : 'ω',
    seed: (Math.imul(SEED, 2654435761) + i * 40503) >>> 0, home,
  });
}

// ---- 3) the deep-time object catalogue ------------------------------------
// each class: {n, cls, glyph, place, size, name, qtr, note}
let oid = 0;
const objects = [];
const OBJ = [
  { n: 42, cls: 'seam-well', place: () => atHub(0.02), size: () => 1.6 + rnd() * 1.8, qtr: 'obj-natural-seam-wells',
    name: () => nm() + ' Well', note: 'A natural seam-well — a black hole lit toward the seam 𝔍, its accretion structure a standing gate.' },
  { n: 14, cls: 'kindled-well', place: () => add(pick(anchors.slice(1)).pos, jit(0.03)), size: () => 2.2 + rnd() * 1.4, qtr: 'obj-kindled-wells',
    name: () => nm() + ' Gate', note: 'A kindled seam-well (Φ₄) — engineered: a black hole held open as an intra-universal gate.' },
  { n: 60, cls: 'seam-pearl', place: () => onFilament(0.03), size: () => 0.7 + rnd() * 0.7, qtr: 'obj-seam-pearls',
    name: () => tag('SP'), note: 'A seam-pearl — a condensed droplet of the seam, left where a crossing set.' },
  { n: 30, cls: 'information-reef', place: () => onFilament(0.02), size: () => 1.2 + rnd() * 1.0, qtr: 'obj-information-reefs',
    name: () => nm() + ' Reef', note: 'An information reef — a shoal of dense mutual information where causal order frays.' },
  { n: 45, cls: 'beacon-core', place: () => onFilament(0.06), size: () => 0.9 + rnd() * 0.5, qtr: 'obj-beacon-cores',
    name: () => tag('BC'), note: 'A beacon core — a pulsar the fleets anchor ΛL phase to; the backbone of shared time.' },
  { n: 10, cls: 'formless-mouth', place: () => inVoid(), size: () => 2.0 + rnd() * 1.6, qtr: 'obj-the-formless-mouths',
    name: () => nm() + ' Mouth', note: 'A rumoured Formless mouth — a Class-ω throat the Assembly denies exists; chased by one mythical ship.' },
  { n: 22, cls: 'law-shard', place: () => nearHorizon(), size: () => 1.0 + rnd() * 1.2, qtr: 'obj-law-shards',
    name: () => tag('LS'), note: 'A law-shard — curvature-frontier debris where the effective constitution is subtly wrong.' },
  { n: 12, cls: 'amplitude-twin', place: null, size: () => 0.9 + rnd() * 0.6, qtr: 'obj-amplitude-twins',
    name: () => nm() + ' Twin', note: 'An amplitude twin — one object read as two, entangled across the web by a shared throat.' },
];
for (const spec of OBJ) {
  for (let k = 0; k < spec.n; k++) {
    if (spec.cls === 'amplitude-twin') { // a linked pair
      const a = onFilament(0.04); const b = add(a, jit(0.28)); const pairId = `dtx-${oid}`;
      const name = spec.name();
      objects.push({ id: `dto-${oid++}`, cls: spec.cls, name: name + ' α', pos: V(...a), size: round(spec.size(), 2), qtr: spec.qtr, twin: pairId, note: spec.note });
      objects.push({ id: `dto-${oid++}`, cls: spec.cls, name: name + ' β', pos: V(...b), size: round(spec.size(), 2), qtr: spec.qtr, twin: pairId, note: spec.note });
    } else {
      const p = spec.place(); if (!p) continue;
      objects.push({ id: `dto-${oid++}`, cls: spec.cls, name: spec.name(), pos: V(...p), size: round(spec.size(), 2), qtr: spec.qtr, note: spec.note });
    }
  }
}

// ---- 4) hazard & frontier regions -----------------------------------------
let rid = 0;
const regions = [];
const REG = [
  { n: 10, cls: 'dead-sea', place: () => inVoid(), radius: () => 0.08 + rnd() * 0.07, qtr: 'hazard-dead', name: () => nm() + ' Still', note: 'The Dead-Sea — a becalmed patch of vacuum where a fleet can stall, unable to find purchase.' },
  { n: 12, cls: 'squall', place: () => onFilament(0.05), radius: () => 0.05 + rnd() * 0.05, qtr: 'hazard-squall', name: () => nm() + ' Squall', note: 'A squall — violent vacuum fluctuation that batters a hull and throws a dive off its phase.' },
  { n: 8, cls: 'refusal-zone', place: () => nearHorizon(), radius: () => 0.06 + rnd() * 0.06, qtr: 'obj-refusal-zones', name: () => nm() + ' Refusal', note: 'A refusal zone — the approach to the curvature limit Κ, where parallels bow apart and conservation leaks.' },
];
for (const spec of REG) for (let k = 0; k < spec.n; k++) { const p = spec.place(); if (!p) continue; regions.push({ id: `dtr-${rid++}`, cls: spec.cls, name: spec.name(), pos: V(...p), radius: round(spec.radius(), 3), qtr: spec.qtr, note: spec.note }); }

// ---- 5) event markers ------------------------------------------------------
let eid = 0;
const events = [];
const EVT = [
  { n: 26, cls: 'crossing', place: () => onFilament(0.03), qtr: 'term-the-crossing', name: () => nm() + ' Crossing', note: 'An Idrenes-bridge crossing — the routine dive between OCT rungs at phase-lock.' },
  { n: 16, cls: 'seam-scar', place: () => onFilament(0.03), qtr: 'obj-seam-scars', name: () => tag('SC'), note: 'A seam-scar — the healed-over wake of a previous crossing; a hazard and an archaeological record.' },
  { n: 6, cls: 'failed-condensation', place: () => atHub(0.03), qtr: 'term-failed-condensation', name: () => tag('FC'), note: 'A failed condensation — a mishandled phase-lock left a ship smeared across the arrivals it might have made.' },
  { n: 9, cls: 'aeonic-edge', place: () => nearHorizon(), qtr: 'recon-conformal-cyclic-cosmology', name: () => nm() + ' Verge', note: 'An aeonic edge — a speculative conformal crossover toward the next aeon of this universe, read through Κ.' },
];
for (const spec of EVT) for (let k = 0; k < spec.n; k++) { const p = spec.place(); if (!p) continue; events.push({ id: `dte-${eid++}`, cls: spec.cls, name: spec.name(), pos: V(...p), qtr: spec.qtr, note: spec.note }); }

// ---- assemble + write ------------------------------------------------------
const CLASSES = {
  object: ['seam-well', 'kindled-well', 'seam-pearl', 'information-reef', 'beacon-core', 'formless-mouth', 'law-shard', 'amplitude-twin'],
  region: ['dead-sea', 'squall', 'refusal-zone'],
  event: ['crossing', 'seam-scar', 'failed-condensation', 'aeonic-edge'],
};
const db = {
  meta: {
    title: 'DEEPTIME — the far-future universe dataset',
    version: '1.0', generated: '2026-07-21', seed: SEED,
    extension: EXTENSION, decadeUnit: meta.decadeUnit, cmbR: round(meta.cmb.displayR, 3),
    note: 'Procedural ~50 Gyr universe on the cosmos log-radial scale, extended ×' + EXTENSION + ' (accelerating expansion). Positions normalised to R = cmbR × extension. Objects/events/regions link to the QTR codex.',
    classes: CLASSES,
    counts: { hubs: hubs.length, filaments: filaments.length, anchors: anchors.length, objects: objects.length, regions: regions.length, events: events.length },
  },
  hubs, filaments, anchors, objects, regions, events,
};
const out = path.join(ROOT, 'public/data/deeptime.json');
fs.writeFileSync(out, JSON.stringify(db));
console.log(`deeptime.json: ${hubs.length} hubs · ${filaments.length} filaments · ${anchors.length} anchors · ${objects.length} objects · ${regions.length} regions · ${events.length} events → ${(fs.statSync(out).size / 1024).toFixed(0)} kB`);
