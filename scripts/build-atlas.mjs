#!/usr/bin/env node
// The Cosmic Atlas: a curated knowledge base of notable real objects and events
// across every major astrophysical class — supermassive & stellar black holes,
// neutron stars/pulsars/magnetars, supernovae & remnants, nebulae, exoplanet
// systems, active/notable galaxies, quasars & blazars, transient events
// (gravitational waves, gamma-ray & fast-radio bursts) and extreme stars.
//
// This is deliberately CURATED, not exhaustive (the real universe holds billions
// of catalogued objects). Positions are catalogue-approximate; the value is the
// headline astrophysics of each object. Computes LOCAL (parsec) + COSMOS
// (log-radial) positions in the same equatorial frame as the star catalogue.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'public', 'data');
const DECADE_UNIT = 3.0, LY_TO_PC = 1 / 3.2615638;

const CATEGORIES = {
  smbh: { label: 'Supermassive black holes', color: [1.0, 0.42, 0.25] },
  sbh: { label: 'Stellar black holes', color: [0.78, 0.45, 1.0] },
  pulsar: { label: 'Neutron stars & pulsars', color: [0.7, 0.95, 1.0] },
  supernova: { label: 'Supernovae & remnants', color: [1.0, 0.5, 0.72] },
  nebula: { label: 'Nebulae', color: [0.42, 1.0, 0.72] },
  exoplanet: { label: 'Exoplanet systems', color: [1.0, 0.85, 0.42] },
  system: { label: 'Nearby star systems', color: [0.72, 0.9, 1.0] },
  galaxy: { label: 'Notable galaxies', color: [0.62, 0.82, 1.0] },
  quasar: { label: 'Quasars & blazars', color: [0.82, 0.42, 1.0] },
  transient: { label: 'Transient events', color: [1.0, 0.34, 0.34] },
  hyperstar: { label: 'Extreme stars', color: [1.0, 0.62, 0.32] },
};

// [name, category, type, RA(hours), Dec(deg), distance(light-years), facts]
const OBJECTS = [
  // ---- supermassive black holes ----
  ['Sagittarius A*', 'smbh', 'galactic-centre black hole', 17.761, -29.008, 26670, 'The 4.3-million-solar-mass black hole at the centre of the Milky Way; imaged by the Event Horizon Telescope in 2022.'],
  ['M87* (Pōwehi)', 'smbh', 'supermassive black hole', 12.514, 12.391, 53.5e6, 'A 6.5-billion-solar-mass black hole in galaxy M87 — the first black hole ever directly imaged (EHT, 2019).'],
  ['TON 618', 'smbh', 'ultramassive black hole', 12.478, 31.72, 10.37e9, 'One of the most massive black holes known (~66 billion M☉), powering a hyperluminous quasar.'],
  ['Phoenix A', 'smbh', 'ultramassive black hole', 23.44, -42.72, 5.7e9, 'A candidate for the most massive black hole known (~100 billion M☉) at the heart of the Phoenix Cluster.'],
  ['OJ 287 primary', 'smbh', 'binary black hole', 8.907, 20.108, 3.5e9, 'A blazar hosting an ~18-billion-solar-mass black hole orbited by a smaller one — a natural black-hole binary.'],
  ['NGC 1277 BH', 'smbh', 'overmassive black hole', 3.33, 41.57, 220e6, "A 'relic' galaxy whose black hole is startlingly massive for the galaxy's size."],

  // ---- stellar black holes ----
  ['Cygnus X-1', 'sbh', 'black-hole X-ray binary', 19.972, 35.202, 7240, 'The first widely accepted black hole (1971); ~21 M☉, feeding on a blue-supergiant companion.'],
  ['Gaia BH1', 'sbh', 'nearest black hole', 17.478, -0.581, 1560, 'The closest known black hole to Earth (2022), ~10 M☉ orbited by a Sun-like star.'],
  ['V404 Cygni', 'sbh', 'microquasar', 20.409, 33.867, 7800, 'A black-hole binary that dramatically flared in 2015; ~9 M☉.'],
  ['GRO J1655-40', 'sbh', 'microquasar', 16.898, -39.846, 11000, 'A black hole ejecting jets at ~92% the speed of light.'],
  ['A0620-00', 'sbh', 'black-hole binary', 6.517, -0.35, 3300, 'One of the nearest black holes to Earth, ~6.6 M☉.'],
  ['LMC X-1', 'sbh', 'stellar black hole', 5.658, -69.743, 165000, 'A black hole in the Large Magellanic Cloud.'],

  // ---- neutron stars & pulsars ----
  ['Crab Pulsar', 'pulsar', 'young pulsar', 5.575, 22.014, 6500, 'A neutron star spinning 30 times a second — the collapsed core of the SN 1054 supernova.'],
  ['Vela Pulsar', 'pulsar', 'pulsar', 8.588, -45.176, 959, 'A nearby young pulsar and gamma-ray source in the Vela supernova remnant.'],
  ['PSR B1919+21', 'pulsar', 'first pulsar found', 19.362, 21.883, 2283, "The first pulsar ever detected (1967) — briefly nicknamed 'LGM-1'."],
  ['PSR J0740+6620', 'pulsar', 'most massive neutron star', 7.68, 66.34, 4600, 'One of the most massive neutron stars known (~2.1 M☉), a key test of ultra-dense matter.'],
  ['PSR B1257+12', 'pulsar', 'pulsar with planets', 13.005, 12.68, 2300, 'Host of the first confirmed exoplanets (1992) — worlds orbiting a dead star.'],
  ['SGR 1806-20', 'pulsar', 'magnetar', 18.135, -20.41, 50000, 'A magnetar whose 2004 giant flare was the brightest extrasolar event ever recorded in gamma rays.'],
  ['Geminga', 'pulsar', 'nearby gamma-ray pulsar', 6.57, 17.77, 815, 'A radio-quiet gamma-ray pulsar, one of the closest to Earth.'],

  // ---- supernovae & remnants ----
  ['Crab Nebula (M1)', 'supernova', 'supernova remnant', 5.575, 22.014, 6500, 'The expanding wreckage of a star seen to explode in 1054 AD, recorded by Chinese astronomers.'],
  ["Tycho's SNR (SN 1572)", 'supernova', 'Type Ia remnant', 0.42, 64.13, 9000, "Remnant of the 1572 supernova that helped overturn belief in unchanging heavens."],
  ["Kepler's SNR (SN 1604)", 'supernova', 'supernova remnant', 17.508, -21.49, 20000, 'The last naked-eye supernova seen in the Milky Way, observed by Kepler in 1604.'],
  ['Cassiopeia A', 'supernova', 'supernova remnant', 23.391, 58.815, 11000, 'The youngest known Milky-Way remnant (~350 yr) and the brightest radio source in the sky.'],
  ['Vela SNR', 'supernova', 'supernova remnant', 8.58, -45.17, 800, 'A large, nearby remnant ~11,000 years old, home to the Vela Pulsar.'],
  ['SN 1987A', 'supernova', 'recent supernova', 5.588, -69.269, 168000, 'The nearest observed supernova in modern times (LMC) — the first with detected neutrinos.'],
  ['Veil Nebula (Cygnus Loop)', 'supernova', 'supernova remnant', 20.85, 30.7, 2400, 'A delicate, filamentary remnant 10,000–20,000 years old.'],

  // ---- nebulae ----
  ['Orion Nebula (M42)', 'nebula', 'stellar nursery', 5.588, -5.391, 1344, "The nearest large star-forming region, visible to the naked eye in Orion's sword."],
  ['Eagle Nebula (M16)', 'nebula', 'emission nebula', 18.313, -13.79, 7000, "Home of the 'Pillars of Creation', columns of gas birthing new stars."],
  ['Carina Nebula', 'nebula', 'emission nebula', 10.75, -59.87, 7500, 'A vast star-forming region hosting the volatile hypergiant Eta Carinae.'],
  ['Ring Nebula (M57)', 'nebula', 'planetary nebula', 18.893, 33.03, 2300, "A dying Sun-like star's shed outer layers, glowing as a smoke ring."],
  ['Helix Nebula', 'nebula', 'planetary nebula', 22.494, -20.837, 655, "One of the nearest planetary nebulae, the 'Eye of God'."],
  ['Lagoon Nebula (M8)', 'nebula', 'emission nebula', 18.06, -24.38, 4100, 'A giant interstellar cloud and star-forming region in Sagittarius.'],
  ["Cat's Eye Nebula", 'nebula', 'planetary nebula', 17.98, 66.63, 3300, 'An intricately structured planetary nebula.'],
  ['Horsehead Nebula', 'nebula', 'dark nebula', 5.68, -2.46, 1375, 'A dark cloud of dust silhouetted against glowing gas in Orion.'],
  ['Rosette Nebula', 'nebula', 'emission nebula', 6.53, 4.95, 5200, 'A rose-shaped cloud with a young star cluster at its heart.'],

  // ---- exoplanet systems ----
  ['TRAPPIST-1', 'exoplanet', 'seven-planet system', 23.106, -5.041, 40.7, 'A cool dwarf with seven Earth-sized planets, three in the habitable zone.'],
  ['Proxima Centauri b', 'exoplanet', 'nearest exoplanet', 14.496, -62.68, 4.24, 'The closest exoplanet — a roughly Earth-mass world in the habitable zone of the nearest star.'],
  ['51 Pegasi (Dimidium)', 'exoplanet', 'first exoplanet at a Sun-like star', 22.96, 20.77, 50.5, 'The 1995 discovery of 51 Peg b launched the exoplanet era (Nobel Prize 2019).'],
  ['Kepler-90', 'exoplanet', 'eight-planet system', 18.95, 49.31, 2790, "A system with eight known planets, matching our Solar System's count."],
  ['Kepler-452', 'exoplanet', "'Earth's cousin'", 19.75, 44.28, 1800, "Host of Kepler-452b, an Earth-size planet in a Sun-like star's habitable zone."],
  ['HD 209458 (Osiris)', 'exoplanet', 'first transiting exoplanet', 22.05, 18.88, 159, 'The first exoplanet seen to transit its star and the first with a detected atmosphere.'],
  ['TOI-700', 'exoplanet', 'habitable-zone system', 6.46, -65.58, 101, 'A red dwarf with an Earth-size planet, TOI-700 d, in the habitable zone.'],
  ['55 Cancri', 'exoplanet', 'five-planet system', 8.98, 28.33, 41, "Includes 55 Cancri e, a scorching 'super-Earth' possibly rich in carbon."],
  ['HR 8799', 'exoplanet', 'directly-imaged four-planet system', 23.063, 21.135, 133, 'One of the first systems whose planets were seen directly in images — four giant worlds around a young star.'],
  ['K2-18', 'exoplanet', 'habitable-zone sub-Neptune', 11.501, 7.588, 124, 'A super-Earth/sub-Neptune whose atmosphere shows water vapour and carbon-bearing molecules.'],
  ['LHS 1140', 'exoplanet', 'habitable-zone rocky planet', 0.730, -15.271, 48.9, 'A quiet red dwarf hosting a dense rocky planet, LHS 1140 b, in its habitable zone.'],
  ['GJ 1214', 'exoplanet', 'sub-Neptune "waterworld"', 17.251, 4.963, 47.5, 'Host of a much-studied sub-Neptune with a thick, steamy atmosphere.'],
  ['Gliese 667 C', 'exoplanet', 'multi-planet red-dwarf system', 17.311, -34.998, 23.6, 'A red dwarf in a triple system with several planets, some near the habitable zone.'],
  ['Kepler-16', 'exoplanet', 'circumbinary planet ("Tatooine")', 19.273, 51.757, 245, 'A planet orbiting two stars at once — the first confirmed circumbinary world.'],
  ['PSR B1257+12', 'exoplanet', 'first confirmed exoplanets', 13.005, 12.681, 2300, 'A pulsar whose planets (1992) were the first exoplanets ever confirmed.'],
  ['WASP-12', 'exoplanet', 'ultra-hot Jupiter', 6.505, 29.672, 1410, 'A gas giant so close to its star it is being tidally shredded and devoured.'],
  ['Gliese 486', 'exoplanet', 'rocky super-Earth', 12.791, 9.807, 26.3, 'A nearby transiting rocky super-Earth, a prime target for atmospheric study.'],
  ['TOI-1452', 'exoplanet', 'candidate ocean world', 19.339, 73.033, 100, 'A super-Earth possibly covered by a deep global ocean.'],

  // ---- nearby star systems (the solar neighbourhood) ----
  ['Alpha Centauri', 'system', 'nearest star system (triple)', 14.660, -60.833, 4.37, "The Sun's nearest neighbours — a Sun-like pair (Rigil Kentaurus & Toliman) plus the red dwarf Proxima; humanity's first interstellar target."],
  ["Barnard's Star", 'system', 'fastest-moving star', 17.963, 4.693, 5.96, 'A red dwarf with the largest known proper motion, drifting a Moon-width across the sky each 180 years.'],
  ['Sirius', 'system', 'brightest star (binary)', 6.752, -16.716, 8.60, 'The brightest star in the night sky — a hot A-type star with a white-dwarf companion, Sirius B.'],
  ['Luhman 16', 'system', 'nearest brown-dwarf binary', 10.723, -53.319, 6.50, 'A pair of brown dwarfs; the third-closest system to the Sun.'],
  ['Wolf 359', 'system', 'nearby flare star', 10.944, 7.014, 7.86, 'A faint, active red dwarf; one of the closest stars and a science-fiction landmark.'],
  ['Epsilon Eridani', 'system', 'young nearby system', 3.548, -9.458, 10.50, 'A young Sun-like star with a dusty debris disk and a giant planet — a nearby analogue of the early Solar System.'],
  ['Tau Ceti', 'system', 'nearest single Sun-like star', 1.734, -15.937, 11.90, 'The closest solitary star resembling the Sun; a long-standing target in the search for other Earths.'],
  ['Procyon', 'system', 'bright binary', 7.655, 5.225, 11.46, 'The eighth-brightest star, an F-type subgiant with a white-dwarf companion, Procyon B.'],
  ['Vega', 'system', 'debris-disk star', 18.616, 38.784, 25.0, 'A brilliant nearby A-type star with a dusty debris disk; a former and future northern pole star.'],
  ['Fomalhaut', 'system', 'debris-disk system', 22.961, -29.622, 25.1, 'A young star girdled by a sharp dust ring — the "Eye of Sauron" — sculpted by unseen bodies.'],
  ['40 Eridani (Keid)', 'system', 'triple system', 4.259, -7.653, 16.3, "A nearby triple with a white dwarf and red dwarf; fictionally the home of Star Trek's Vulcan."],
  ['Altair', 'system', 'fast-rotating star', 19.846, 8.868, 16.7, 'A brilliant, rapidly spinning A-type star flattened into an oblate spheroid by its own spin.'],

  // ---- notable galaxies ----
  ['M87 (Virgo A)', 'galaxy', 'giant elliptical (AGN)', 12.514, 12.391, 53.5e6, 'A giant elliptical firing a 5,000-light-year plasma jet; hosts the first-imaged black hole.'],
  ['Whirlpool Galaxy (M51)', 'galaxy', 'grand-design spiral', 13.497, 47.195, 23e6, 'A classic face-on spiral interacting with a small companion galaxy.'],
  ['Sombrero Galaxy (M104)', 'galaxy', 'spiral', 12.667, -11.62, 29.3e6, 'An edge-on spiral with a bright bulge and a striking dark dust lane.'],
  ['Cartwheel Galaxy', 'galaxy', 'ring galaxy', 0.61, -33.72, 500e6, 'A ring galaxy sculpted by a head-on collision.'],
  ['Antennae Galaxies', 'galaxy', 'merging galaxies', 12.03, -18.87, 45e6, 'Two galaxies caught mid-collision, triggering intense bursts of star formation.'],
  ['Messier 77', 'galaxy', 'Seyfert galaxy', 2.711, -0.013, 47e6, 'A prototype Seyfert galaxy with an actively feeding central black hole.'],
  ['Pinwheel Galaxy (M101)', 'galaxy', 'spiral', 14.053, 54.349, 21e6, 'A large, face-on grand-design spiral galaxy.'],

  // ---- quasars & blazars ----
  ['3C 273', 'quasar', 'first quasar identified', 12.485, 2.05, 2.44e9, 'The first object recognised as a quasar (1963) and the optically brightest in our sky.'],
  ['3C 279', 'quasar', 'blazar', 12.936, -5.789, 5.3e9, 'A blazar showing apparent superluminal jet motion.'],
  ['ULAS J1342+0928', 'quasar', 'very distant quasar', 13.71, 9.48, 13.1e9, 'One of the most distant quasars, seen ~690 million years after the Big Bang.'],
  ['Markarian 421', 'quasar', 'blazar', 11.074, 38.209, 397e6, 'One of the closest, best-studied blazars and a TeV gamma-ray source.'],
  ['APM 08279+5255', 'quasar', 'hyperluminous quasar', 8.51, 52.75, 12e9, 'An extremely luminous, gravitationally lensed quasar.'],
  ['BL Lacertae', 'quasar', 'blazar prototype', 22.045, 42.28, 900e6, "The prototype of the 'BL Lac' class of blazars."],

  // ---- transient events ----
  ['GW150914', 'transient', 'first gravitational-wave detection', 9.0, -70.0, 1.3e9, 'The first direct detection of gravitational waves (2015): two black holes (~36 & 29 M☉) merging. (Position approximate.)'],
  ['GW170817', 'transient', 'neutron-star merger / kilonova', 13.16, -23.38, 130e6, 'The first neutron-star merger seen in both gravitational waves and light — a forge of heavy elements like gold.'],
  ['GRB 221009A', 'transient', 'brightest gamma-ray burst (BOAT)', 19.02, 19.77, 2.4e9, "The 'brightest of all time' gamma-ray burst (2022), from a collapsing massive star."],
  ['GRB 080319B', 'transient', 'naked-eye gamma-ray burst', 14.05, 36.3, 7.5e9, 'A gamma-ray burst briefly visible to the naked eye despite its immense distance.'],
  ['FRB 121102', 'transient', 'repeating fast radio burst', 5.517, 33.15, 3e9, 'The first fast radio burst found to repeat, localized to a distant dwarf galaxy.'],

  // ---- extreme stars ----
  ['UY Scuti', 'hyperstar', 'red supergiant', 18.475, -12.75, 9500, "Among the largest known stars — placed at the Sun it would reach beyond Jupiter's orbit."],
  ['VY Canis Majoris', 'hyperstar', 'red hypergiant', 7.38, -25.77, 3900, 'A colossal, unstable red hypergiant shedding vast amounts of mass.'],
  ['Eta Carinae', 'hyperstar', 'luminous blue variable', 10.75, -59.685, 7500, 'A ~100-solar-mass unstable pair that erupted in the 1840s and may soon go supernova.'],
  ['R136a1', 'hyperstar', 'most massive star', 5.646, -69.1, 163000, 'The most massive star known (~200 M☉), in the Tarantula Nebula of the LMC.'],
  ['Betelgeuse', 'hyperstar', 'red supergiant', 5.919, 7.407, 548, 'A doomed red supergiant that will one day explode as a brilliant supernova.'],
  ['WR 104', 'hyperstar', 'Wolf-Rayet pinwheel', 18.05, -23.63, 8000, "A Wolf-Rayet star spinning out a spiral 'pinwheel' of dust."],
  ['Stephenson 2-18', 'hyperstar', 'extreme red supergiant', 18.65, -6.09, 19000, 'A candidate for the largest known star by radius.'],
];

const round = (n, d = 4) => { const p = 10 ** d; return Math.round(n * p) / p; };
function dir(raH, decD) {
  const ra = raH * 15 * Math.PI / 180, dec = decD * Math.PI / 180, cd = Math.cos(dec);
  return [cd * Math.cos(ra), cd * Math.sin(ra), Math.sin(dec)];
}

const objects = OBJECTS.map(([name, category, type, ra, dec, distLy, facts]) => {
  const distPc = distLy * LY_TO_PC, d = dir(ra, dec);
  return {
    name, category, type, ra, dec, distLy, facts,
    color: CATEGORIES[category].color,
    pos: [round(d[0] * distPc), round(d[1] * distPc), round(d[2] * distPc)], // parsec (LOCAL)
    dir: d.map((v) => round(v, 6)),
    displayR: round(DECADE_UNIT * Math.log10(Math.max(distPc, 1)), 4),        // COSMOS
  };
});

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'atlas.json'), JSON.stringify({
  categories: CATEGORIES, decadeUnit: DECADE_UNIT, count: objects.length, objects,
}));
const byCat = {};
for (const o of objects) byCat[o.category] = (byCat[o.category] || 0) + 1;
console.log('[build-atlas] wrote atlas.json ·', objects.length, 'objects');
console.log('[build-atlas]', Object.entries(byCat).map(([k, v]) => `${k}:${v}`).join('  '));
