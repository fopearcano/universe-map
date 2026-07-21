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

// ---- 1) the cosmic web — nodes, filaments and walls, modelled on the real
//        large-scale structure: a minimum-spanning-tree spine (guarantees one
//        connected web) + short-range extra links (the loops and branches real
//        surveys show), every filament a SMOOTH CURVED path (control points that
//        sag toward the barycentre and bow perpendicular — gravity, not right
//        angles), varying thickness at the nodes. ------------------------------
const HUBS = 92;
const hubs = [];
for (let i = 0; i < HUBS; i++) {
  const rf = Math.min(0.98, 0.05 + 0.93 * Math.pow(rnd(), 1.3));   // inner-biased shells
  const u = rnd(), v = rnd(), th = Math.acos(2 * u - 1), ph = 2 * Math.PI * v;
  const p = V(rf * Math.sin(th) * Math.cos(ph), rf * Math.sin(th) * Math.sin(ph) * 0.82, rf * Math.cos(th));
  const supercluster = rnd() < 0.15;
  hubs.push({ i, pos: p, rf: round(rf, 3), supercluster });
}
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// edges = a minimum spanning tree (Prim) + extra near links (loops/branches)
const edgeKey = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
const edgeSet = new Set();
const edges = [];             // [a, b, kind]
const inTree = new Array(HUBS).fill(false);
inTree[0] = true;
const frontier = []; // {d, a, b}
const pushFrontier = (a) => { for (let b = 0; b < HUBS; b++) if (!inTree[b] && b !== a) frontier.push({ d: dist2(hubs[a].pos, hubs[b].pos), a, b }); };
pushFrontier(0);
while (edges.length < HUBS - 1 && frontier.length) {
  frontier.sort((x, y) => x.d - y.d);
  let e = null; while (frontier.length) { const c = frontier.shift(); if (!inTree[c.b]) { e = c; break; } }
  if (!e) break;
  inTree[e.b] = true; edgeSet.add(edgeKey(e.a, e.b)); edges.push([e.a, e.b, 'filament']); pushFrontier(e.b);
}
// extra links: each hub to its 1–3 nearest neighbours (loops); some long "walls"
for (let i = 0; i < HUBS; i++) {
  const near = hubs.map((h) => [h.i, dist2(hubs[i].pos, h.pos)]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]);
  const n = 1 + (rnd() < 0.6 ? 1 : 0) + (rnd() < 0.3 ? 1 : 0);
  for (let k = 0; k < n; k++) { const [j, d2] = near[k]; if (d2 > (0.42) ** 2) continue; const kk = edgeKey(i, j); if (!edgeSet.has(kk)) { edgeSet.add(kk); edges.push([i, j, 'filament']); } }
}
for (let w = 0; w < 14; w++) { const a = Math.floor(rnd() * HUBS), b = Math.floor(rnd() * HUBS); const kk = edgeKey(a, b); if (a !== b && !edgeSet.has(kk) && dist2(hubs[a].pos, hubs[b].pos) < 0.7 ** 2) { edgeSet.add(kk); edges.push([a, b, 'wall']); } }

// a smooth curved control-point path for each edge (gravitational sag + a bow)
function curvedPath(a, b, kind) {
  const A = hubs[a].pos, B = hubs[b].pos, d = sub(B, A), L = len(d);
  const dir = norm(d);
  // a stable perpendicular basis
  let up = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const e1 = norm(cross(dir, up)), e2 = norm(cross(dir, e1));
  const nSeg = Math.max(2, Math.min(6, Math.round(L / (0.14))));   // more control points on longer filaments
  const bow = L * (kind === 'wall' ? 0.05 : 0.10 + rnd() * 0.12);   // perpendicular bow magnitude
  const bph1 = rnd() * Math.PI * 2, bph2 = rnd() * Math.PI * 2;
  const pts = [A.slice()];
  for (let s = 1; s < nSeg; s++) {
    const t = s / nSeg, base = lerp(A, B, t), envelope = Math.sin(Math.PI * t); // 0 at ends, max middle
    const o1 = bow * envelope * Math.cos(bph1) + gauss(L * 0.03);
    const o2 = bow * envelope * Math.sin(bph2) + gauss(L * 0.03);
    // gravitational sag: pull the midsection gently toward the origin (mass)
    const sag = -0.06 * envelope;
    const p = [
      base[0] + e1[0] * o1 + e2[0] * o2 + base[0] * sag,
      base[1] + e1[1] * o1 + e2[1] * o2 + base[1] * sag,
      base[2] + e1[2] * o1 + e2[2] * o2 + base[2] * sag,
    ];
    pts.push(V(...p));
  }
  pts.push(B.slice());
  return pts;
}
const filaments = edges.map(([a, b, kind]) => ({ a, b, kind, pts: curvedPath(a, b, kind) }));

// piecewise Catmull-Rom over a control-point array; t in [0,1] across the whole path
function catmull(P, t) {
  const n = P.length; if (n < 2) return P[0];
  const seg = Math.min(n - 2, Math.floor(t * (n - 1))); const lt = t * (n - 1) - seg;
  const p0 = P[Math.max(0, seg - 1)], p1 = P[seg], p2 = P[seg + 1], p3 = P[Math.min(n - 1, seg + 2)];
  const t2 = lt * lt, t3 = t2 * lt; const out = [];
  for (let k = 0; k < 3; k++) out[k] = 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * lt + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
  return out;
}
const sampleFil = (fil, t) => catmull(fil.pts, t);

// placement helpers along the CURVED web
const filWeight = filaments.map((f) => Math.exp(-(hubs[f.a].pos && len(lerp(hubs[f.a].pos, hubs[f.b].pos, 0.5))) / 0.42)); // inner filaments favoured
const wSum = filWeight.reduce((s, x) => s + x, 0) || 1;
const pickFil = () => { let x = rnd() * wSum, i = 0; while (i < filaments.length - 1 && (x -= filWeight[i]) > 0) i++; return filaments[i]; };
const onFilament = (jitter = 0.02) => { const f = pickFil(); const t = 0.1 + 0.8 * rnd(); return add(sampleFil(f, t), jit(jitter)); };
const atHub = (jitter = 0.015, superOnly = false) => { const pool = superOnly ? hubs.filter((h) => h.supercluster) : hubs; const h = pick(pool.length ? pool : hubs); return add(h.pos, jit(jitter)); };
const inVoid = () => {
  let best = null, bestD = -1;
  for (let tries = 0; tries < 8; tries++) {
    const rf = 0.25 + 0.6 * rnd(), u = rnd(), v = rnd(), th = Math.acos(2 * u - 1), ph = 2 * Math.PI * v;
    const p = V(rf * Math.sin(th) * Math.cos(ph), rf * Math.sin(th) * Math.sin(ph), rf * Math.cos(th));
    let dmin = Infinity;
    for (const f of filaments) for (let s = 0; s <= 4; s++) { const q = sampleFil(f, s / 4); const d = dist2(p, q); if (d < dmin) dmin = d; }
    if (dmin > bestD) { bestD = dmin; best = p; }
  }
  return best;
};
const nearHorizon = () => { const u = rnd(), v = rnd(), th = Math.acos(2 * u - 1), ph = 2 * Math.PI * v; const rf = 0.9 + 0.08 * rnd(); return V(rf * Math.sin(th) * Math.cos(ph), rf * Math.sin(th) * Math.sin(ph), rf * Math.cos(th)); };

// ---- 2) anchors — the named, navigable galaxies ---------------------------
const ANCHORS = 150;
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
  { n: 64, cls: 'seam-well', place: () => atHub(0.02), size: () => 1.6 + rnd() * 1.8, qtr: 'obj-natural-seam-wells',
    name: () => nm() + ' Well', note: 'A natural seam-well — a black hole lit toward the seam 𝔍, its accretion structure a standing gate.' },
  { n: 22, cls: 'kindled-well', place: () => add(pick(anchors.slice(1)).pos, jit(0.03)), size: () => 2.2 + rnd() * 1.4, qtr: 'obj-kindled-wells',
    name: () => nm() + ' Gate', note: 'A kindled seam-well (Φ₄) — engineered: a black hole held open as an intra-universal gate.' },
  { n: 95, cls: 'seam-pearl', place: () => onFilament(0.03), size: () => 0.7 + rnd() * 0.7, qtr: 'obj-seam-pearls',
    name: () => tag('SP'), note: 'A seam-pearl — a condensed droplet of the seam, left where a crossing set.' },
  { n: 48, cls: 'information-reef', place: () => onFilament(0.02), size: () => 1.2 + rnd() * 1.0, qtr: 'obj-information-reefs',
    name: () => nm() + ' Reef', note: 'An information reef — a shoal of dense mutual information where causal order frays.' },
  { n: 70, cls: 'beacon-core', place: () => onFilament(0.06), size: () => 0.9 + rnd() * 0.5, qtr: 'obj-beacon-cores',
    name: () => tag('BC'), note: 'A beacon core — a pulsar the fleets anchor ΛL phase to; the backbone of shared time.' },
  { n: 16, cls: 'formless-mouth', place: () => inVoid(), size: () => 2.0 + rnd() * 1.6, qtr: 'obj-the-formless-mouths',
    name: () => nm() + ' Mouth', note: 'A rumoured Formless mouth — a Class-ω throat the Assembly denies exists; chased by one mythical ship.' },
  { n: 34, cls: 'law-shard', place: () => nearHorizon(), size: () => 1.0 + rnd() * 1.2, qtr: 'obj-law-shards',
    name: () => tag('LS'), note: 'A law-shard — curvature-frontier debris where the effective constitution is subtly wrong.' },
  { n: 18, cls: 'amplitude-twin', place: null, size: () => 0.9 + rnd() * 0.6, qtr: 'obj-amplitude-twins',
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
