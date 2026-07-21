// The SYSTEMS registry — every star system the SYSTEMS scale can show: our own
// Solar System (data/solarSystem.js), a curated set of real exoplanet systems
// with their measured planet properties, and an unlimited supply of deterministic
// procedurally-generated systems. All share one descriptor shape:
//
//   { id, name, tag, kind:'real'|'proc', distanceLy, star, bodies[], belts?, oort?, trojans? }
//   star  = { name, spectral, r(km), massMe, tempK, lum, color, composition?, facts }
//   body  = { name, kind, group, a, e, inc, period, r, massMe?, tempK?, type?, … , facts }
//
// Physics not measured directly (surface gravity, escape velocity, density) is
// derived from mass + radius by bodyPhysics().
import { SOLAR_SYSTEM } from './solarSystem.js';

const RE = 6371, RJ = 69911, RSUN = 696000, MJ = 317.8;   // km / Earth-mass helpers
const re = (x) => Math.round(x * RE);
const rj = (x) => Math.round(x * RJ);
const rsun = (x) => Math.round(x * RSUN);
const mj = (x) => x * MJ;

// ── derived physics (Earth-relative → real units) ────────────────────────────
export function bodyPhysics(b) {
  const out = {};
  if (b.massMe != null && b.r) {
    const rr = b.r / RE;                                   // radius in Earth radii
    out.gravity = b.gravity != null ? b.gravity : b.massMe / (rr * rr);            // Earth g
    out.escape = 11.186 * Math.sqrt(Math.max(0, b.massMe / rr));                    // km/s
    out.density = b.density != null ? b.density : 5.513 * b.massMe / (rr * rr * rr); // g/cm³
  } else {
    if (b.gravity != null) out.gravity = b.gravity;
    if (b.density != null) out.density = b.density;
  }
  return out;
}

// ── real exoplanet systems ───────────────────────────────────────────────────
// masses in Earth masses (mj() for Jupiter masses), radii in km (re()/rj()),
// a in AU, period in years, tempK = equilibrium temperature.
const P = (planet) => ({ kind: 'planet', group: 'planet', e: 0.02, inc: 0.2, ...planet });

const EXO = [
  { id: 'trappist1', name: 'TRAPPIST-1', tag: 'M8V · 40.7 ly', kind: 'real', distanceLy: 40.7,
    star: { name: 'TRAPPIST-1', spectral: 'M8V', r: rsun(0.1192), massMe: 0.0898 * 332946, tempK: 2566, lum: 0.000553, color: [1.0, 0.4, 0.24], composition: 'ultracool red dwarf',
      facts: 'A Jupiter-sized ultracool red dwarf 40 ly away hosting seven Earth-sized planets — the largest batch of terrestrial worlds around one star, three of them in the habitable zone.' },
    bodies: [
      P({ name: 'TRAPPIST-1 b', a: 0.01154, period: 0.00413, r: re(1.116), massMe: 1.374, tempK: 400, type: 'rocky · hot' , facts: 'The innermost world — a hot rocky planet baked by its close orbit; likely a dense, airless or steam-shrouded surface.' }),
      P({ name: 'TRAPPIST-1 c', a: 0.01580, period: 0.00663, r: re(1.097), massMe: 1.308, tempK: 342, type: 'rocky', facts: 'A Venus-like rocky planet just inside the habitable zone, possibly with a thin atmosphere.' }),
      P({ name: 'TRAPPIST-1 d', a: 0.02227, period: 0.01109, r: re(0.788), massMe: 0.388, tempK: 288, type: 'rocky · low-mass', facts: 'The lightest of the seven — a small rocky world at the inner edge of the habitable zone, perhaps water-rich.' }),
      P({ name: 'TRAPPIST-1 e', a: 0.02925, period: 0.01670, r: re(0.920), massMe: 0.692, tempK: 251, type: 'rocky · habitable zone', facts: 'The most Earth-like of the seven — a rocky, likely dense world squarely in the habitable zone; a prime target for atmosphere hunts.' }),
      P({ name: 'TRAPPIST-1 f', a: 0.03849, period: 0.02522, r: re(1.045), massMe: 1.039, tempK: 219, type: 'rocky · habitable zone', facts: 'A habitable-zone world that may hold a deep water-ice or ocean layer under a thick atmosphere.' }),
      P({ name: 'TRAPPIST-1 g', a: 0.04683, period: 0.03381, r: re(1.129), massMe: 1.321, tempK: 199, type: 'water-rich · habitable zone', facts: 'The largest of the seven — a likely water-world at the outer edge of the habitable zone.' }),
      P({ name: 'TRAPPIST-1 h', a: 0.06189, period: 0.05138, r: re(0.755), massMe: 0.326, tempK: 173, type: 'icy', facts: 'The cold outermost world — small, icy, and locked in the same resonant chain as its siblings.' }),
    ] },
  { id: 'proxima', name: 'Proxima Centauri', tag: 'M5.5V · 4.24 ly', kind: 'real', distanceLy: 4.24,
    star: { name: 'Proxima Centauri', spectral: 'M5.5V', r: rsun(0.1542), massMe: 0.122 * 332946, tempK: 3042, lum: 0.0017, color: [1.0, 0.46, 0.3], composition: 'flare red dwarf',
      facts: 'The closest star to the Sun (4.24 ly), a small flaring red dwarf bound to the Alpha Centauri pair. It hosts the nearest known exoplanet — the potentially habitable Proxima b.' },
    bodies: [
      P({ name: 'Proxima d', a: 0.02885, period: 0.01402, r: re(0.81), massMe: 0.26, tempK: 360, type: 'sub-Earth · hot', facts: 'A tiny, hot candidate world skimming close to the star — one of the lowest-mass exoplanets ever found.' }),
      P({ name: 'Proxima b', a: 0.04857, period: 0.03064, r: re(1.1), massMe: 1.07, tempK: 234, type: 'rocky · habitable zone', facts: 'The nearest exoplanet to Earth — a rocky world in the habitable zone, though bathed in stellar flares. The most tempting target for a future probe.' }),
      P({ name: 'Proxima c', a: 1.489, period: 5.28, r: re(1.5), massMe: 7.0, tempK: 39, type: 'cold super-Earth', facts: 'A cold super-Earth or mini-Neptune far from the star, on a 5-year orbit — possibly ringed.' }),
    ] },
  { id: '55cnc', name: '55 Cancri', tag: 'K0V · 41 ly', kind: 'real', distanceLy: 41,
    star: { name: '55 Cancri A (Copernicus)', spectral: 'K0V', r: rsun(0.943), massMe: 0.905 * 332946, tempK: 5172, lum: 0.582, color: [1.0, 0.86, 0.62], composition: 'orange dwarf',
      facts: 'A naked-eye orange dwarf hosting five planets — from a scorching super-Earth "lava world" to a Jupiter analog. The star is metal-rich and part of a wide binary.' },
    bodies: [
      P({ name: '55 Cnc e', a: 0.01544, period: 0.00202, r: re(1.875), massMe: 8.08, tempK: 2000, type: 'lava super-Earth', facts: 'A super-Earth so close it orbits in 18 hours, with a dayside near 2,400°C — possibly a lava ocean under a rock-vapour atmosphere.' }),
      P({ name: '55 Cnc b', a: 0.1134, period: 0.0401, r: rj(0.99), massMe: mj(0.804), tempK: 700, type: 'hot gas giant', facts: 'A hot Jupiter-mass world — the first planet found around this star, on a 14-day orbit.' }),
      P({ name: '55 Cnc c', a: 0.2373, period: 0.1214, r: rj(0.6), massMe: mj(0.165), tempK: 500, type: 'warm Neptune', facts: 'A Saturn-mass warm giant on a 44-day orbit.' }),
      P({ name: '55 Cnc f', a: 0.781, period: 0.712, r: rj(0.6), massMe: mj(0.155), tempK: 300, type: 'temperate giant', facts: 'A sub-Saturn near the habitable zone — any large moons could be temperate.' }),
      P({ name: '55 Cnc d', a: 5.957, period: 14.47, r: rj(1.1), massMe: mj(3.88), tempK: 120, type: 'Jupiter analog', facts: 'A cold Jupiter-analog on a 14-year orbit — one of the first true Jupiter twins found.' }),
    ] },
  { id: 'kepler90', name: 'Kepler-90', tag: 'G0 · 2,790 ly', kind: 'real', distanceLy: 2790,
    star: { name: 'Kepler-90', spectral: 'G0V', r: rsun(1.2), massMe: 1.2 * 332946, tempK: 6080, lum: 1.99, color: [1.0, 0.92, 0.78], composition: 'yellow-white dwarf',
      facts: 'The first star known to host as many planets as our Sun — eight — in a compact, ordered sequence of small inner worlds and large outer giants, a scaled-down Solar System.' },
    bodies: [
      P({ name: 'Kepler-90 b', a: 0.074, period: 0.0192, r: re(1.31), massMe: 2.7, tempK: 990, type: 'rocky · hot', facts: 'A hot rocky inner world.' }),
      P({ name: 'Kepler-90 c', a: 0.089, period: 0.0239, r: re(1.19), massMe: 2.2, tempK: 900, type: 'rocky · hot', facts: 'A small hot rocky planet.' }),
      P({ name: 'Kepler-90 i', a: 0.107, period: 0.0396, r: re(1.32), massMe: 2.8, tempK: 710, type: 'rocky', facts: 'Discovered by machine learning in 2017 — the find that made this the first 8-planet exosystem.' }),
      P({ name: 'Kepler-90 d', a: 0.32, period: 0.1636, r: re(2.87), massMe: 8, tempK: 420, type: 'mini-Neptune', facts: 'A warm mini-Neptune.' }),
      P({ name: 'Kepler-90 e', a: 0.42, period: 0.2517, r: re(2.66), massMe: 7, tempK: 370, type: 'mini-Neptune', facts: 'A temperate sub-Neptune.' }),
      P({ name: 'Kepler-90 f', a: 0.48, period: 0.342, r: re(2.86), massMe: 8, tempK: 340, type: 'mini-Neptune', facts: 'A sub-Neptune near the habitable zone.' }),
      P({ name: 'Kepler-90 g', a: 0.71, period: 0.5766, r: re(8.13), massMe: mj(0.7), tempK: 280, type: 'gas giant', facts: 'A puffy gas giant in the outer system.' }),
      P({ name: 'Kepler-90 h', a: 1.01, period: 0.9079, r: re(11.3), massMe: mj(1.2), tempK: 240, type: 'Jupiter-like', facts: 'The outermost world — a Jupiter-like giant near where Earth orbits our Sun.' }),
    ] },
  { id: 'toi700', name: 'TOI-700', tag: 'M2V · 101 ly', kind: 'real', distanceLy: 101,
    star: { name: 'TOI-700', spectral: 'M2V', r: rsun(0.420), massMe: 0.416 * 332946, tempK: 3480, lum: 0.0233, color: [1.0, 0.56, 0.36], composition: 'quiet red dwarf',
      facts: 'A quiet red dwarf hosting the first Earth-sized habitable-zone planet found by TESS. Two of its worlds (d and e) sit in the habitable zone.' },
    bodies: [
      P({ name: 'TOI-700 b', a: 0.0637, period: 0.0273, r: re(1.037), massMe: 1.1, tempK: 415, type: 'rocky · hot', facts: 'A hot Earth-sized inner world.' }),
      P({ name: 'TOI-700 c', a: 0.0929, period: 0.0439, r: re(2.63), massMe: 7.7, tempK: 340, type: 'mini-Neptune', facts: 'A mini-Neptune between the two habitable-zone worlds.' }),
      P({ name: 'TOI-700 e', a: 0.134, period: 0.0761, r: re(0.953), massMe: 0.82, tempK: 295, type: 'rocky · habitable zone', facts: 'An Earth-sized rocky world in the optimistic habitable zone.' }),
      P({ name: 'TOI-700 d', a: 0.1633, period: 0.1024, r: re(1.144), massMe: 1.72, tempK: 268, type: 'rocky · habitable zone', facts: 'The first Earth-sized habitable-zone planet found by TESS — a rocky world that could hold liquid water.' }),
    ] },
  { id: 'gliese581', name: 'Gliese 581', tag: 'M3V · 20.4 ly', kind: 'real', distanceLy: 20.4,
    star: { name: 'Gliese 581', spectral: 'M3V', r: rsun(0.299), massMe: 0.31 * 332946, tempK: 3480, lum: 0.012, color: [1.0, 0.52, 0.34], composition: 'red dwarf',
      facts: 'A nearby red dwarf that was an early exoplanet hotspot — home to some of the first super-Earths found near a habitable zone, and a testbed for the whole field.' },
    bodies: [
      P({ name: 'Gliese 581 e', a: 0.028, period: 0.0086, r: re(1.1), massMe: 1.7, tempK: 430, type: 'rocky · hot', facts: 'One of the lowest-mass exoplanets known at its 2009 discovery — a hot rocky world.' }),
      P({ name: 'Gliese 581 b', a: 0.041, period: 0.0147, r: re(3.8), massMe: 15.8, tempK: 350, type: 'warm Neptune', facts: 'A Neptune-mass planet, the first found in the system.' }),
      P({ name: 'Gliese 581 c', a: 0.073, period: 0.0353, r: re(1.7), massMe: 5.5, tempK: 290, type: 'super-Earth', facts: 'One of the first super-Earths found near a habitable zone — likely too hot, a Venus analog.' }),
      P({ name: 'Gliese 581 d', a: 0.218, period: 0.183, r: re(2.0), massMe: 6.98, tempK: 200, type: 'cold super-Earth', facts: 'A super-Earth near the cold edge of the habitable zone — much debated, possibly warmed by a thick atmosphere.' }),
    ] },
  { id: 'hr8799', name: 'HR 8799', tag: 'A5V · 133 ly', kind: 'real', distanceLy: 133,
    star: { name: 'HR 8799', spectral: 'A5V', r: rsun(1.34), massMe: 1.47 * 332946, tempK: 7200, lum: 4.9, color: [0.82, 0.88, 1.0], composition: 'young A-type star',
      facts: 'A young (~30 Myr) A-type star and the first with a multi-planet system directly imaged — four massive giants still glowing with their birth heat, orbiting between two debris belts.' },
    bodies: [
      P({ name: 'HR 8799 e', a: 16.4, period: 45, e: 0.13, r: rj(1.2), massMe: mj(7.4), tempK: 1150, type: 'young hot giant', facts: 'The innermost imaged giant — still red-hot from formation, glowing in the infrared.' }),
      P({ name: 'HR 8799 d', a: 26.7, period: 100, e: 0.12, r: rj(1.2), massMe: mj(9.1), tempK: 1090, type: 'young hot giant', facts: 'A massive young giant on a 100-year orbit.' }),
      P({ name: 'HR 8799 c', a: 41.4, period: 190, e: 0.05, r: rj(1.2), massMe: mj(7.8), tempK: 1090, type: 'young hot giant', facts: 'Its spectrum shows water and methane in a cloudy, hydrogen-rich atmosphere.' }),
      P({ name: 'HR 8799 b', a: 71.6, period: 460, e: 0.02, r: rj(1.1), massMe: mj(5.7), tempK: 900, type: 'young hot giant', facts: 'The outermost and lightest imaged giant, orbiting near the system’s cold outer debris belt.' }),
    ] },
];

// ── procedural systems — deterministic from a seed ───────────────────────────
function mulberry(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const NA = ['Vel', 'Corvus', 'Ysm', 'Tarn', 'Ophi', 'Kein', 'Drav', 'Sorn', 'Aeq', 'Myr', 'Halcy', 'Cael', 'Zon', 'Peth', 'Orrel', 'Xanth'];
// star archetypes weighted toward the common low-mass end (spectral, massSun, rSun, tempK, lum, color, note)
const STARS = [
  { w: 46, spectral: 'M', massSun: 0.3, rSun: 0.35, tempK: 3300, lum: 0.02, color: [1.0, 0.5, 0.32], note: 'red dwarf' },
  { w: 20, spectral: 'K', massSun: 0.75, rSun: 0.78, tempK: 4600, lum: 0.3, color: [1.0, 0.78, 0.55], note: 'orange dwarf' },
  { w: 13, spectral: 'G', massSun: 1.0, rSun: 1.0, tempK: 5700, lum: 1.0, color: [1.0, 0.9, 0.7], note: 'yellow dwarf' },
  { w: 8, spectral: 'F', massSun: 1.3, rSun: 1.3, tempK: 6600, lum: 3.5, color: [1.0, 0.96, 0.86], note: 'yellow-white star' },
  { w: 5, spectral: 'A', massSun: 1.9, rSun: 1.7, tempK: 8500, lum: 20, color: [0.82, 0.88, 1.0], note: 'white star' },
  { w: 4, spectral: 'D', massSun: 0.6, rSun: 0.013, tempK: 12000, lum: 0.003, color: [0.85, 0.9, 1.0], note: 'white dwarf remnant' },
  { w: 4, spectral: 'K-giant', massSun: 1.4, rSun: 15, tempK: 4200, lum: 60, color: [1.0, 0.72, 0.5], note: 'red-giant star' },
];
const PLANET_LETTERS = 'bcdefghijk';

export function makeProcSystem(seed) {
  const rnd = mulberry((seed >>> 0) || 1);
  const name = NA[Math.floor(rnd() * NA.length)] + '-' + (100 + Math.floor(rnd() * 8899));
  // pick a weighted star
  const tot = STARS.reduce((s, a) => s + a.w, 0); let x = rnd() * tot, S = STARS[0];
  for (const s of STARS) { if ((x -= s.w) <= 0) { S = s; break; } }
  const lum = S.lum * (0.6 + 0.8 * rnd());
  const star = { name, spectral: S.spectral, r: rsun(S.rSun), massMe: S.massSun * 332946, tempK: Math.round(S.tempK), lum: +lum.toFixed(3), color: S.color, composition: S.note,
    facts: `A procedurally-modelled ${S.note} — one plausible ${S.spectral}-type system consistent with the Sun’s cosmological setting, generated on demand.` };
  const nP = 2 + Math.floor(rnd() * 8);                       // 2–9 planets
  const bodies = [];
  let a = (0.04 + 0.06 * rnd()) * Math.sqrt(Math.max(0.02, lum));  // inner edge scales with luminosity
  const ratio = 1.4 + rnd() * 0.7;
  for (let i = 0; i < nP; i++) {
    a *= (ratio + (rnd() - 0.5) * 0.3); if (i === 0) a = (0.04 + 0.06 * rnd()) * Math.sqrt(Math.max(0.02, lum));
    const period = Math.sqrt(a * a * a / (S.massSun || 1));
    const Teq = Math.round(278.6 * Math.pow(lum, 0.25) / Math.sqrt(a));    // equilibrium temp (albedo≈0.3 baked into ~279)
    // type by temperature + a coin flip for hot-Jupiter migration
    let type, r, massMe, moons = 0, ring = null;
    const hot = Teq > 600, cold = Teq < 180;
    if (hot && rnd() < 0.25) { type = 'hot gas giant'; r = rj(0.9 + rnd() * 0.4); massMe = mj(0.3 + rnd() * 2); moons = 0; }
    else if (hot) { type = rnd() < 0.5 ? 'lava world' : 'rocky · hot'; r = re(0.5 + rnd() * 1.6); massMe = Math.pow(r / RE, 3) * (4 + rnd() * 3) / 5.5; }
    else if (cold && rnd() < 0.6) { type = rnd() < 0.5 ? 'gas giant' : 'ice giant'; r = re(3.5 + rnd() * 9); massMe = Math.pow(r / RE, 2.0) * (3 + rnd() * 6); moons = 1 + Math.floor(rnd() * 4); ring = rnd() < 0.4 ? { inner: r * 1.5, outer: r * 2.3 } : null; }
    else { // temperate
      const roll = rnd();
      if (roll < 0.5) { type = 'rocky'; r = re(0.5 + rnd() * 1.4); massMe = Math.pow(r / RE, 3) * (4 + rnd() * 2) / 5.5; }
      else if (roll < 0.8) { type = 'super-Earth'; r = re(1.4 + rnd() * 1.2); massMe = Math.pow(r / RE, 3) * (5 + rnd() * 2) / 5.5; }
      else { type = 'mini-Neptune'; r = re(2 + rnd() * 2); massMe = Math.pow(r / RE, 2.06) * (2 + rnd() * 3); moons = rnd() < 0.5 ? 1 : 0; }
    }
    const habitable = Teq >= 200 && Teq <= 320 && /rocky|super-Earth|ocean/.test(type);
    const body = { name: `${name} ${PLANET_LETTERS[i]}`, kind: 'planet', group: 'planet', a: +a.toFixed(4), e: +(rnd() * 0.12).toFixed(3), inc: +(rnd() * 4).toFixed(2),
      period: +period.toFixed(4), r: Math.round(r), massMe: +massMe.toFixed(3), tempK: Teq, type: habitable ? type + ' · habitable zone' : type,
      color: planetColor(type, Teq, rnd), facts: `A ${type} at ${a.toFixed(2)} AU (equilibrium ${Teq} K).${habitable ? ' It falls in the star’s habitable zone.' : ''}` };
    if (ring) body.ring = ring;
    if (moons > 0) body.moons = Array.from({ length: moons }, (_, mi) => ({ name: `${name} ${PLANET_LETTERS[i]}${mi + 1}`, aKm: Math.round(r * (3 + mi * 2.4) * 1.6), r: Math.round(200 + rnd() * 1400), facts: 'A modelled moon.' }));
    body.moonsCount = moons;
    bodies.push(body);
  }
  return { id: 'proc:' + (seed >>> 0), name, tag: `${S.spectral} · procedural`, kind: 'proc', distanceLy: null, star, bodies,
    facts: `A procedurally-generated ${S.note} system (seed ${seed >>> 0}) with ${nP} planets, grown from the same physical rules as the real catalogue.` };
}
function planetColor(type, Teq, rnd) {
  if (/lava|hot/.test(type)) return [1.0, 0.5 + rnd() * 0.2, 0.3];
  if (/gas giant|Jupiter/.test(type)) return [0.85, 0.72 + rnd() * 0.1, 0.55];
  if (/ice giant|Neptune/.test(type)) return [0.4, 0.6, 0.9];
  if (Teq < 200) return [0.75, 0.82, 0.9];
  return [0.4 + rnd() * 0.2, 0.6, 0.7 + rnd() * 0.2];
}

// ── registry ─────────────────────────────────────────────────────────────────
const REAL = [SOLAR_SYSTEM, ...EXO];
const procCache = new Map();

export function systemList() {
  return REAL.map((s) => ({ id: s.id, name: s.name, tag: s.tag, kind: s.kind }));
}
export function getSystem(id) {
  if (!id) return SOLAR_SYSTEM;
  const real = REAL.find((s) => s.id === id);
  if (real) return real;
  if (id.startsWith('proc:')) {
    if (!procCache.has(id)) procCache.set(id, makeProcSystem(parseInt(id.slice(5), 10) || 1));
    return procCache.get(id);
  }
  return SOLAR_SYSTEM;
}
export { SOLAR_SYSTEM };
