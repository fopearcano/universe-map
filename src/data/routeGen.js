// Procedural expansion of the Ledger of Ways. The hand-authored flagship routes
// give the network its voice; this fills it out to a full spread of ~500 charted
// crossings, each with a poetic name and every waypoint anchored to a real object
// from the supplied pool. Deterministic (seeded), so the map is the same every load.

const ADJ = ['Amber', 'Silent', 'Cold', 'Broken', 'Drowned', 'Ashen', 'Iron', 'Pale', 'Long', 'Quiet', 'Hollow', 'Gilded', 'Salt', 'Widowed', 'Lantern', 'Threadbare', 'Crimson', 'Golden', 'Weeping', 'Sunless', 'Starless', 'Faded', 'Bitter', 'Sacred', 'Forsaken', 'Endless', 'Whispering', 'Frozen', 'Emberlit', 'Moonless', 'Grave', 'Dawnless', 'Kestrel', 'Serpent', 'Deepwater', 'Wandering', 'Nameless', 'Sable', 'Vermillion', 'Hallowed', 'Sombre', 'Glass', 'Tidal', 'Sundered', 'Ivory', 'Obsidian', 'Lonesome', 'Errant', 'Brine', 'Windward', 'Ember', 'Silver', 'Leaden', 'Rimed', 'Ochre', 'Fallow', 'Wintered', 'Verdant', 'Ashgrey', 'Molten', 'Slack', 'Turning', 'Hungering', 'Patient', 'Mourned', 'Gallowed', 'Featherlight', 'Cindered', 'Salted', 'Stormworn', 'Quicksilver', 'Wormwood', 'Marbled', 'Dustbound', 'Ninefold', 'Twilit', 'Umbral', 'Candled', 'Reliquary', 'Beggared', 'Honeyed', 'Spiced', 'Coral', 'Onyx', 'Cobalt', 'Rusted', 'Mistbound', 'Waning', 'Owl-eyed', 'Thornbound', 'Sea-grey'];
const NOUN = ['Ladder', 'Ferry', 'Reach', 'Circuit', 'Walk', 'Road', 'Run', 'Line', 'String', 'Coil', 'Meridian', 'Bastion', 'Vigil', 'March', 'Screen', 'Picket', 'Tithe', 'Barter', 'Loop', 'Cut', 'Watch', 'Way', 'Passage', 'Crossing', 'Span', 'Bridge', 'Thread', 'Furrow', 'Channel', 'Lane', 'Trail', 'Wake', 'Gauntlet', 'Pilgrimage', 'Errand', 'Furlong', 'Reckoning', 'Descent', 'Verge', 'Trace', 'Artery', 'Girdle', 'Tether', 'Stitch', 'Weave', 'Seam', 'Ribbon', 'Vein', 'Skein', 'Halter', 'Gallows-walk', 'Rondel', 'Sluice', 'Conduit', 'Causeway', 'Corridor', 'Approach', 'Traverse', 'Sounding', 'Draught'];
const NOUN2 = ['Suns', 'Ash', 'Salt', 'Bones', 'Silk', 'Glass', 'Embers', 'Widows', 'Saints', 'Reavers', 'Pilgrims', 'Sorrows', 'Lanterns', 'Mirrors', 'Tides', 'Whispers', 'the Drowned', 'the Faithful', 'the Lost', 'the Deep', 'the Long Night', 'Cinders', 'Vespers', 'Thorns', 'Mourning', 'the Nameless', 'the Fallen', 'Winter', 'the Quiet', 'Exiles', 'Wolves', 'the Meek', 'Spice', 'Amber', 'Coral', 'the Sleepless', 'Relics', 'the Patient', 'Furnaces', 'the Forsaken', 'Vellum', 'Beacons', 'the Unlit', 'Harvest', 'the Owl', 'the Debtors', 'the Ninefold', 'Dust', 'the Threadbare', 'the Grey'];
const NAME = ['Widow', 'Hangman', 'Ferryman', 'Reaver', 'Cartographer', 'Pilgrim', 'Kestrel', 'Serpent', 'Diver', 'Crosser', 'Warden', 'Exile', 'Saint', 'Sister', 'Factor', 'Envoy', 'Marshal', 'Verderer', 'Beggar', 'Sentinel', 'Corsair', 'Wanderer', 'Almoner', 'Steward', 'Widower', 'Cantor', 'Glassmaker', 'Salter', 'Lamplighter', 'Reliquar', 'Drover', 'Chandler', 'Vintner', 'Netmaker', 'Bellringer', 'Cooper', 'Wright', 'Harrier', 'Verger', 'Coster', 'Ostler', 'Fletcher', 'Weaver', 'Mourner', 'Prowman'];
const ROUTEWORD = ['Road', 'Route', 'Run', 'Way', 'Passage', 'Circuit', 'Line', 'March', 'Corridor', 'Reach', 'Trail', 'Lane', 'Course', 'Track', 'Crossing', 'Traverse', 'Round', 'Circuit', 'Walk', 'Haul'];

const COMM_OPS = ["the Amber Syndics", "the Ferryman's Guild", 'the Cloud Factors', 'the Salt Factors', 'the Lantern Wardens', 'the Dwarf Leagues', 'the Furnace Cartel', 'the Kestrel Wing', 'the Silk Assembly', 'the Glassmakers', 'the Spice Concord', 'the Free Haulers', 'the Pilgrim Trust', 'Pelagian Assembly', 'the Irrationals', 'the Reliquary Fund'];
const MIL_OPS = ['the Iron Synod', 'the Kestrel Wing', 'the Nūbi', 'the Drowned Legion', 'the Grey Marshals', 'the Verge Wardens', 'the Ashen Guard', 'the Ninth Fleet', 'the Serpent Corps', 'Pelagian Assembly', 'the Sīli', 'the Bastion Order', 'the Long Watch', 'the Sable Cohort'];
const COMM_KINDS = ['trade lane', 'courier run', 'ore-haul', 'pilgrim way', 'salvage loop', 'supply line', 'spice road', 'silk run', 'ferry', 'relic road', 'exchange', 'survey circuit', 'fuel haul', 'short-haul', 'courier trunk', 'grain road'];
const MIL_KINDS = ['patrol', 'war-road', 'blockade', 'picket', 'siege line', 'deep-strike', 'fast picket', 'screen', 'border patrol', 'memorial patrol', 'stealth corridor', 'fortress resupply', 'pirate sweep', 'capital ring', 'exile road', 'relief run'];
const COMM_LORE = ['cargo that outlives its carriers.', 'beacon to beacon, and never a word spoken.', 'they pay the Undertow in years.', 'charted in a hand no one can read.', 'the ledger says profit; the crews say penance.', 'a road that smells of cold metal and older debt.', 'the sweetest little run in the book.', 'slow, honest, and untaxed.', 'every crossing pauses to log a verse.', 'holds full, tongues held.', 'a route walked in lifetimes and walked anyway.', 'the manifests lie; the stars do not.'];
const MIL_LORE = ['the guns never cool.', 'relieved so rarely the crews name their own graves.', 'a heading and a locked drive.', 'no one who rides it speaks of it.', 'the first to see a thing come up out of the deep.', 'a wall of guns holding the dark shut.', 'they ride in and some do not ride out.', 'run with beacons off and the clock kept by hand.', 'the bloodiest supply in the ledger, and never enough.', 'a coil so old the crews forgot what to fear.', 'a funeral circuit, drives set to a dirge.', 'charted for the dead who still march it.'];
const TRAFFIC = ['heavy', 'heavy', 'steady', 'steady', 'steady', 'light', 'light', 'ghost'];
const CLASSES = ['0', 'I', 'I', 'I', 'I', 'I', 'I', 'II', 'II', 'II', 'II', 'III', 'III', 'ω'];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function generateRoutes(pool, { commercial = 0, military = 0, seed = 1234, existingNames = [] } = {}) {
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const used = new Set(existingNames.map((n) => n.toLowerCase()));

  const name = () => {
    for (let t = 0; t < 24; t++) {
      const k = Math.floor(rnd() * 5);
      let n;
      if (k === 0) n = `The ${pick(ADJ)} ${pick(NOUN)}`;
      else if (k === 1) n = `The ${pick(NOUN)} of ${pick(NOUN2)}`;
      else if (k === 2) n = `The ${pick(NAME)}'s ${pick(NOUN)}`;
      else if (k === 3) n = `The ${pick(ADJ)} ${pick(ROUTEWORD)}`;
      else n = `${pick(NAME)}'s ${pick(ROUTEWORD)}`;
      if (!used.has(n.toLowerCase())) { used.add(n.toLowerCase()); return n; }
    }
    let n; do { n = `The ${pick(ADJ)} ${pick(NOUN)} of ${pick(NOUN2)}`; } while (used.has(n.toLowerCase()));
    used.add(n.toLowerCase()); return n;
  };

  // k-nearest neighbours (display space) so most routes are coherent local segments
  const N = pool.length;
  const near = pool.map((p, i) => {
    const d = [];
    for (let j = 0; j < N; j++) if (j !== i) { const q = pool[j]; d.push([j, (p.pos[0] - q.pos[0]) ** 2 + (p.pos[1] - q.pos[1]) ** 2 + (p.pos[2] - q.pos[2]) ** 2]); }
    d.sort((a, b) => a[1] - b[1]);
    return d.slice(0, 8).map((x) => x[0]);
  });
  const hubW = pool.map((p) => p.hub || 1);
  const hubSum = hubW.reduce((a, b) => a + b, 0);
  const pickHub = () => { let r = rnd() * hubSum; for (let i = 0; i < N; i++) { r -= hubW[i]; if (r <= 0) return i; } return 0; };

  const routes = [];
  let id = 0;
  const makeOne = (cat) => {
    const comm = cat === 'commercial';
    const len = 2 + (rnd() < 0.5 ? 0 : rnd() < 0.6 ? 1 : rnd() < 0.7 ? 2 : 3); // 2..5, mostly 2-3
    const trunk = rnd() < 0.14;                                 // a few long-haul trunks
    const chain = [pickHub()];
    for (let step = 1; step < len; step++) {
      const cur = chain[chain.length - 1];
      let nxt;
      if (trunk || rnd() < 0.18) { let g = 0; do { nxt = Math.floor(rnd() * N); } while (chain.includes(nxt) && ++g < 8); }
      else { const cands = near[cur].filter((j) => !chain.includes(j)); nxt = cands.length ? pick(cands) : Math.floor(rnd() * N); }
      if (!chain.includes(nxt)) chain.push(nxt);
    }
    if (chain.length < 2) return null;
    const objs = chain.map((j) => pool[j]);
    return {
      id: `way-${(id++).toString(36)}`, name: name(), category: cat,
      kind: comm ? pick(COMM_KINDS) : pick(MIL_KINDS),
      operator: comm ? pick(COMM_OPS) : pick(MIL_OPS),
      driveClass: pick(CLASSES), traffic: pick(TRAFFIC),
      lore: comm ? pick(COMM_LORE) : pick(MIL_LORE),
      stops: objs.map((o) => o.name), positions: objs.map((o) => o.pos.slice()),
    };
  };
  for (let c = 0; c < commercial; c++) { const r = makeOne('commercial'); if (r) routes.push(r); }
  for (let m = 0; m < military; m++) { const r = makeOne('military'); if (r) routes.push(r); }
  return routes;
}
