// Voyage definitions. Each waypoint is matched against the real HYG catalog by
// `match` (hip number, hd number, exact proper name, or Gliese id). Coordinates,
// distance and stellar data are pulled from the catalog at build time — only the
// narrative is authored here. `distance_ly` is the accepted modern value, shown
// alongside the catalog-derived distance for reference.
//
// The three voyages answer the brief "track a story voyage like Ulysses or Darwin":
// a documented real expedition (Voyager), a survey traverse (Nearest Neighbours),
// and a narrative odyssey (an Interstellar Odyssey that mirrors Homer).

export const VOYAGES = [
  {
    id: 'nearest-neighbours',
    title: "The Sun's Nearest Neighbours",
    subtitle: 'A survey traverse of every star within ~12.5 light-years',
    kind: 'survey',
    intro:
      "Charted like Darwin's Beagle working its way along a coastline, this voyage " +
      'steps outward from the Sun through the local stellar neighbourhood, one system ' +
      'at a time, in order of true distance. Most of these neighbours are dim red dwarfs ' +
      'invisible to the naked eye — the real demographics of our galaxy.',
    waypoints: [
      { match: { id: 0 }, title: 'Sol — home port', distance_ly: 0.0,
        narrative: 'Departure point. A middle-aged G2V dwarf; every distance on this map is measured from here.' },
      { match: { hip: 70890 }, title: 'Proxima Centauri', distance_ly: 4.24,
        narrative: 'The single closest star to the Sun, an M5.5 red dwarf so faint it was only found in 1915. It hosts Proxima b, a roughly Earth-mass planet in its habitable zone.' },
      { match: { hip: 71683 }, title: 'Rigil Kentaurus (Alpha Centauri A)', distance_ly: 4.37,
        narrative: 'The brighter member of the Alpha Centauri triple system and a near-twin of our own Sun. To the unaided eye it and Toliman merge into the third-brightest star in the night sky.' },
      { match: { hip: 87937 }, title: "Barnard's Star", distance_ly: 5.96,
        narrative: 'A red dwarf with the largest proper motion of any star — it slides a full lunar diameter across the sky every 180 years. A "runaway star" racing through the solar neighbourhood.' },
      { match: { proper: 'Wolf 359' }, title: 'Wolf 359', distance_ly: 7.86,
        narrative: 'A tiny, flaring M6 dwarf, one of the lowest-mass and faintest stars known. Famous to a generation as the site of a fictional battle, it is very real and very close.' },
      { match: { hip: 54035 }, title: 'Lalande 21185', distance_ly: 8.31,
        narrative: 'The brightest red dwarf in the northern sky, yet still far too faint to see without a telescope. Long-term astrometry hints at a family of planets.' },
      { match: { hip: 32349 }, title: 'Sirius', distance_ly: 8.60,
        narrative: 'The brightest star in Earth’s night sky, a hot A-type star orbited by Sirius B, a dense white-dwarf ember — the burnt-out core of a once more massive companion.' },
      { match: { hip: 92403 }, title: 'Ross 154', distance_ly: 9.69,
        narrative: 'A young, magnetically active red dwarf in Sagittarius that erupts in powerful flares, brightening in minutes.' },
      { match: { proper: 'Ross 248' }, title: 'Ross 248', distance_ly: 10.30,
        narrative: 'A flare star drifting toward us; in roughly 36,000 years it will briefly become the closest star to the Sun, before Proxima reclaims the title.' },
      { match: { hip: 16537 }, title: 'Epsilon Eridani (Ran)', distance_ly: 10.48,
        narrative: 'A young orange dwarf ringed by dusty debris belts and at least one giant planet — a solar system caught in the act of forming.' },
      { match: { hip: 114046 }, title: 'Lacaille 9352', distance_ly: 10.74,
        narrative: 'A red dwarf in Piscis Austrinus with two known planets and the fourth-largest proper motion of any star.' },
      { match: { hip: 57548 }, title: 'Ross 128', distance_ly: 11.01,
        narrative: 'A quiet, old red dwarf hosting Ross 128 b, a temperate Earth-mass world — one of the nearest exoplanets that could plausibly be clement.' },
      { match: { hip: 104214 }, title: '61 Cygni', distance_ly: 11.40,
        narrative: 'The "Flying Star" — in 1838 the first star to have its distance measured by parallax, a keystone of the cosmic distance ladder. A wide pair of orange dwarfs.' },
      { match: { hip: 37279 }, title: 'Procyon', distance_ly: 11.46,
        narrative: 'The eighth-brightest star in the sky, a bright F-type star with its own white-dwarf companion, Procyon B.' },
      { match: { hip: 8102 }, title: 'Tau Ceti', distance_ly: 11.91,
        narrative: 'The nearest lone Sun-like star, long a touchstone of the search for other Earths. It carries a massive debris disk and several candidate planets.' },
      { match: { hip: 108870 }, title: 'Epsilon Indi', distance_ly: 11.87,
        narrative: 'An orange dwarf accompanied by a pair of cool brown dwarfs — failed stars — and a confirmed giant planet.' },
    ],
  },

  {
    id: 'voyager',
    title: 'Voyager — the Interstellar Errand',
    subtitle: 'Where our farthest machines are actually heading',
    kind: 'probe',
    intro:
      "Humanity's first interstellar craft carry no engines that matter now — they " +
      'coast forever on the momentum of planetary slingshots. This voyage plots the ' +
      'real stars the Voyager and Pioneer probes will drift past across the next ' +
      'million years, each encounter tens of thousands of years away.',
    waypoints: [
      { match: { id: 0 }, title: 'Sol — launch, 1972–1977', distance_ly: 0.0,
        narrative: 'Pioneer 10 & 11 and Voyager 1 & 2 all began here, flung outward by gravity assists off the giant planets onto escape trajectories out of the Solar System.' },
      { match: { hip: 57544 }, title: 'Voyager 1 → Gliese 445', distance_ly: 17.6,
        narrative: 'Voyager 1, the most distant human object, is climbing north out of the galactic plane. In about 40,000 years it will pass within ~1.6 light-years of Gliese 445, a faint red dwarf now in Camelopardalis.' },
      { match: { proper: 'Ross 248' }, title: 'Voyager 2 → Ross 248', distance_ly: 10.30,
        narrative: 'In roughly 40,000 years Voyager 2 will drift within ~1.7 light-years of Ross 248 — which, by then, will itself be the closest star to the Sun.' },
      { match: { hip: 32349 }, title: 'Voyager 2 → Sirius', distance_ly: 8.60,
        narrative: 'Far deeper into the future — some 296,000 years from now — Voyager 2 will glide about 4.3 light-years past Sirius, the brightest star in our sky.' },
      { match: { hip: 21421 }, title: 'Pioneer 10 → Aldebaran', distance_ly: 65.3,
        narrative: 'Pioneer 10, silent since 2003, is aimed toward Aldebaran, the red-giant eye of Taurus. At its coasting speed the crossing would take over two million years.' },
    ],
  },

  {
    id: 'odyssey',
    title: 'An Interstellar Odyssey',
    subtitle: 'A mythic grand tour that mirrors Homer',
    kind: 'myth',
    intro:
      "Ulysses' voyage home from Troy is the archetypal story-voyage: a route of trials " +
      'traced across a map. Here the same shape is laid over the brightest beacons of the ' +
      'night sky — depart Ithaca, endure the wonders and terrors of the deep, and return. ' +
      'Every star and its physics are real; only the myth is borrowed.',
    waypoints: [
      { match: { id: 0 }, title: 'Ithaca — the Sun', distance_ly: 0.0,
        narrative: 'The harbour we leave and long to regain. From this ordinary yellow dwarf every heading is measured, and to it the whole voyage bends back.' },
      { match: { hip: 32349 }, title: 'Sirius — the beacon set alight', distance_ly: 8.60,
        narrative: 'We cast off toward the sky’s brightest star, the Dog Star that the ancients watched rise with the summer heat. Its blue-white glare is the lighthouse at the mouth of the dark sea.' },
      { match: { hip: 21421 }, title: 'Aldebaran — the eye of the Cyclops', distance_ly: 65.3,
        narrative: 'A single vast red eye glares from the Hyades: Aldebaran, a bloated orange giant forty times the Sun’s girth. We slip past its stare and press on into open sky.' },
      { match: { hip: 24436 }, title: 'Rigel — the bag of winds', distance_ly: 863,
        narrative: 'At Orion’s foot burns Rigel, a blue supergiant pouring out a hundred thousand times the Sun’s light. Here the winds are loosed — a star so luminous its radiation storms across light-years.' },
      { match: { hip: 27989 }, title: 'Betelgeuse — the house of the dead', distance_ly: 548,
        narrative: 'A doomed red supergiant, so swollen it would swallow Jupiter’s orbit, flickering toward the supernova that will end it. We pass through the shadow of a star already dying, the land of the shades.' },
      { match: { hip: 80763 }, title: 'Antares — Scylla and Charybdis', distance_ly: 550,
        narrative: 'The red heart of the Scorpion, a supergiant rival to Mars, marks the strait of monsters. We thread between its churning stellar wind and the crush of its gravity, and survive.' },
      { match: { hip: 91262 }, title: 'Vega — the song of the Sirens', distance_ly: 25.0,
        narrative: 'Brilliant, swift-spinning Vega was once the pole star and will be again. Its clear blue song has lured astronomers for two centuries; ringed by a disk of debris, it nearly holds us fast.' },
      { match: { hip: 97649 }, title: 'Altair — the swift crossing', distance_ly: 16.7,
        narrative: 'The Eagle’s star spins so fast — a full rotation in nine hours — that it bulges at its equator. On its rushing winds we make the swift passage of the Summer Triangle.' },
      { match: { hip: 102098 }, title: "Deneb — Calypso's far island", distance_ly: 1550,
        narrative: 'Farthest of all our ports, Deneb blazes as one of the most luminous stars known, yet hangs so remote its distance is still argued. Here, at the edge of the map, the voyage lingers longest before turning for home.' },
      { match: { hip: 69673 }, title: 'Arcturus — the Bear-guard points home', distance_ly: 36.7,
        narrative: 'The old orange giant "Guardian of the Bear" wheels near the celestial pole and has steered navigators for millennia. By its light we set the final heading back toward Ithaca.' },
      { match: { id: 0 }, title: 'Ithaca regained — the Sun', distance_ly: 0.0,
        narrative: 'The long arc closes. We fall back toward the pale yellow star we set out from, the voyage told and the map complete.' },
    ],
  },
];
