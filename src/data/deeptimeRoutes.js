// The "Ways of the Deep" — the far-future travel network laid over the DEEPTIME
// cosmic web. Fleets cross between galaxies along Idrenes-bridge lanes anchored to
// the beacon phase-network; the routes fan out from the home supergalaxy in a
// branching, colour-coded tree (each top-level branch a "trunk" with its own hue)
// so the overlay reads like an organic topology map. Deterministic (seeded) so the
// network is identical every load. Emits browsable named "ways" (chains of
// galaxies) plus a handful of curated multi-galaxy voyages.

// route orders (guilds) — the browse groups; each named way falls in one
export const DT_ORDERS = [
  { key: 'bridge',    label: 'Bridge-roads',      kinds: ['crossing lane', 'bridge-road', 'phase run', 'dive corridor'] },
  { key: 'beacon',    label: 'Beacon-circuits',   kinds: ['beacon circuit', 'phase-lock loop', 'clock run', 'ΛL relay'] },
  { key: 'seam',      label: 'Seam-hauls',        kinds: ['seam-haul', 'well road', 'gate approach', 'pearl run'] },
  { key: 'reef',      label: 'Reef-runs',         kinds: ['reef-run', 'archive road', 'sounding', 'salvage loop'] },
  { key: 'pilgrim',   label: 'Pilgrim-ways',      kinds: ['pilgrim way', 'edge road', 'mouth approach', 'verge march'] },
  { key: 'kindled',   label: 'Kindled-lanes',     kinds: ['kindled lane', 'gate-road', 'engineered dive', 'trunk express'] },
  { key: 'refusal',   label: 'Refusal-patrols',   kinds: ['refusal patrol', 'Κ picket', 'frontier watch', 'law-shard sweep'] },
  { key: 'amplitude', label: 'Amplitude-threads', kinds: ['amplitude thread', 'twin tether', 'entangled run', 'shared-throat road'] },
];
const ORDER_W = [24, 14, 16, 10, 8, 12, 7, 5];   // relative frequency of each order

const OPERATORS = ['the Aeon Concord', 'the Bridgewrights', 'the Beacon Wardens', 'the Seam Factors', 'the Reef Cartographers', 'the Pilgrim Trust', 'the Kindled League', 'the Κ Marshals', 'the Ninefold Fleet', 'the Undertow Guild', 'the Phase Assembly', 'the Long Watch', 'the Amplitude Choir', 'the Formless Errantry'];
const TRAFFIC = ['heavy', 'heavy', 'steady', 'steady', 'steady', 'thin', 'thin', 'ghost'];
const LORE = [
  'beacon to beacon, and the clock kept by hand.', 'a dive the fleets could run in their sleep, and some do.',
  'charted in phase-ink no living pilot can read.', 'the manifests lie; the seam does not.',
  'run with drives cold between the wells.', 'a road walked in aeons and walked anyway.',
  'the crews name their own arrivals before they set.', 'holds full of years, tongues held.',
  'they pay the Undertow in centuries.', 'the last road out before the refusal takes hold.',
  'one throat in, one throat out, and never the same twice.', 'a circuit so old the fleets forgot what it fed.',
];
const SYL_A = ['Aeon', 'Vael', 'Sōr', 'Thren', 'Ixa', 'Orun', 'Kael', 'Nyx', 'Zeph', 'Umbra', 'Cael', 'Drav', 'Eryn', 'Mor', 'Ossa', 'Vyre', 'Halla', 'Tavu', 'Onei', 'Skarn', 'Corv', 'Aval', 'Ninefold', 'Undertow', 'Pale', 'Sable'];
const WAYWORD = ['Road', 'Reach', 'Run', 'Way', 'Passage', 'Crossing', 'Span', 'Bridge', 'Thread', 'Circuit', 'Line', 'Descent', 'Traverse', 'Coil', 'Tether', 'Verge', 'Approach'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function mulberry(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// HSL→RGB (h,s,l in 0..1) → [r,g,b] 0..1
function hsl(h, s, l) {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}

// Build the Ways network from the anchor galaxies. `anchors`: [{ i, name, pos:[x,y,z], home, driveClass }]
export function generateDeeptimeRoutes(anchors, { seed = 0xD7A1, count = 3000, trunks = 22 } = {}) {
  const N = anchors.length;
  if (N < 3) return { routes: [], voyages: [], trunkCount: 0 };
  const rnd = mulberry(seed >>> 0);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const pos = anchors.map((a) => a.pos);
  const rad = pos.map((p) => Math.hypot(p[0], p[1], p[2]));

  // ---- spatial grid for k-nearest-neighbour queries ----
  let maxR = 0; for (const r of rad) if (r > maxR) maxR = r;
  const cell = Math.max(1e-6, maxR / 14), grid = new Map();
  const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < N; i++) { const k = key(pos[i][0], pos[i][1], pos[i][2]); (grid.get(k) || grid.set(k, []).get(k)).push(i); }
  const d2 = (a, b) => (pos[a][0] - pos[b][0]) ** 2 + (pos[a][1] - pos[b][1]) ** 2 + (pos[a][2] - pos[b][2]) ** 2;
  const neighbours = (i, K) => {
    const [x, y, z] = pos[i], cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    const cand = [];
    for (let R = 1; R <= 3 && cand.length < K * 3; R++) {
      cand.length = 0;
      for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) {
        const b = grid.get(`${cx + dx},${cy + dy},${cz + dz}`); if (b) for (const j of b) if (j !== i) cand.push(j);
      }
    }
    cand.sort((a, b) => d2(i, a) - d2(i, b));
    return cand.slice(0, K);
  };

  // ---- radial tree: parent = nearest neighbour closer to the origin ----
  const order = [...Array(N).keys()].sort((a, b) => rad[a] - rad[b]);
  const root = order[0];
  const parent = new Array(N).fill(-1), trunk = new Array(N).fill(-1), knn = new Array(N);
  for (let oi = 0; oi < N; oi++) {
    const i = order[oi]; const nn = neighbours(i, 10); knn[i] = nn;
    if (i === root) continue;
    let best = -1, bd = Infinity;
    for (const j of nn) if (rad[j] < rad[i]) { const d = d2(i, j); if (d < bd) { bd = d; best = j; } }
    parent[i] = best >= 0 ? best : root;
  }
  // trunk id = index of the root-child ancestor; hue evenly spaced round the wheel
  const trunkOf = (i) => { let c = i, g = 0; while (parent[c] !== -1 && parent[c] !== root && g++ < 64) c = parent[c]; return c; };
  const trunkIds = new Map();
  for (let i = 0; i < N; i++) { if (i === root) { trunk[i] = 0; continue; } const t = trunkOf(i); if (!trunkIds.has(t)) trunkIds.set(t, trunkIds.size); trunk[i] = trunkIds.get(t); }
  const nTrunks = Math.max(1, trunkIds.size);
  const trunkColor = (t) => hsl(((t * 0.61803398875) % 1), 0.95, 0.56);   // golden-ratio hue spread, vivid

  // ---- named ways: radial chains walking inward along near neighbours ----
  const orderPick = () => { let x = rnd() * ORDER_W.reduce((a, b) => a + b, 0), k = 0; while (k < DT_ORDERS.length - 1 && (x -= ORDER_W[k]) > 0) k++; return k; };
  const outerW = rad.map((r) => 0.2 + r / (maxR || 1));   // routes tend to start toward the rim
  const outerSum = outerW.reduce((a, b) => a + b, 0);
  const pickOuter = () => { let x = rnd() * outerSum, i = 0; while (i < N - 1 && (x -= outerW[i]) > 0) i++; return i; };
  const used = new Set();
  const wayName = (guildLabel) => {
    for (let t = 0; t < 20; t++) {
      const k = Math.floor(rnd() * 3);
      const n = k === 0 ? `The ${pick(SYL_A)} ${pick(WAYWORD)}` : k === 1 ? `${pick(SYL_A)}'s ${guildLabel.replace(/s$/, '')}` : `The ${pick(SYL_A)} ${pick(WAYWORD)} to ${pick(SYL_A)}`;
      if (!used.has(n)) { used.add(n); return n; }
    }
    let n; do { n = `The ${pick(SYL_A)} ${pick(WAYWORD)} of ${pick(SYL_A)}`; } while (used.has(n)); used.add(n); return n;
  };

  const routes = [];
  for (let c = 0; c < count; c++) {
    const start = pickOuter();
    const len = 2 + (rnd() < 0.45 ? 0 : rnd() < 0.6 ? 1 : rnd() < 0.6 ? 2 : 3);   // 2..5, mostly 2-3
    const chain = [start];
    for (let step = 1; step < len; step++) {
      const cur = chain[chain.length - 1];
      const cands = (knn[cur] || []).filter((j) => !chain.includes(j) && rad[j] < rad[cur] + cell * 2);
      let nxt = cands.length ? cands.sort((a, b) => rad[a] - rad[b])[0] : (knn[cur] || []).find((j) => !chain.includes(j));
      if (nxt == null) break; chain.push(nxt);
    }
    if (chain.length < 2) continue;
    const g = orderPick(), ord = DT_ORDERS[g], t = trunk[chain[0]];
    routes.push({
      id: `dtw-${c.toString(36)}`, name: wayName(ord.label), order: ord.key, orderLabel: ord.label,
      kind: pick(ord.kinds), operator: pick(OPERATORS), driveClass: anchors[chain[0]].driveClass || pick(['I', 'II', 'III', 'ω']),
      traffic: pick(TRAFFIC), lore: pick(LORE), color: trunkColor(t), trunk: t,
      stops: chain.map((j) => anchors[j].name), stopIdx: chain.slice(),
      positions: chain.map((j) => pos[j].slice()),
    });
  }

  // ---- curated voyages: long radial descents + a beacon loop ----
  const voyages = [];
  const leaves = order.slice().reverse();   // outermost first
  const pathToRoot = (i) => { const path = [i]; let c = i, g = 0; while (parent[c] !== -1 && g++ < 40) { c = parent[c]; path.push(c); } return path; };
  const VOY = [
    { id: 'dtv-longspiral', title: 'The Long Spiral In', subtitle: 'From the frayed rim of the deep-time cosmos, galaxy by galaxy down a single trunk to the home supergalaxy Aeon Hearth.', order: 'bridge' },
    { id: 'dtv-beaconcircuit', title: 'The Beacon Circuit', subtitle: 'A phase-lock loop through the clock-galaxies whose pulsars keep the fleets’ shared time.', order: 'beacon' },
    { id: 'dtv-pilgrimage', title: 'Pilgrimage to the Mouth', subtitle: 'Outward along the pilgrim-ways toward a rumoured Formless mouth at the edge of the map.', order: 'pilgrim' },
    { id: 'dtv-seamroad', title: 'The Seam-Well Road', subtitle: 'A haul between the great lit black holes, each a standing gate toward the seam.', order: 'seam' },
    { id: 'dtv-refusal', title: 'The Refusal March', subtitle: 'A patrol to the curvature limit Κ, where the constitution of space itself starts to fail.', order: 'refusal' },
  ];
  let li = 0;
  for (const v of VOY) {
    // choose a distinct outer leaf and take its inward path (trimmed to a readable length)
    while (li < leaves.length && leaves[li] === root) li++;
    const leaf = leaves[Math.min(li, leaves.length - 1)]; li += Math.max(1, Math.floor(N / 60));
    let path = pathToRoot(leaf);
    if (v.id === 'dtv-beaconcircuit') { path = path.slice(0, 6); path.push(path[0]); }   // a loop
    else path = path.filter((_, k) => k % Math.ceil(path.length / 7) === 0 || k === path.length - 1).slice(0, 8);
    if (path.length < 2) continue;
    voyages.push({ ...v, stops: path.map((j) => anchors[j].name), stopIdx: path, positions: path.map((j) => pos[j].slice()) });
  }

  return { routes, voyages, trunkCount: nTrunks };
}
