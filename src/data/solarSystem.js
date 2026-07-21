// The Solar System, for the SYSTEMS scale — a full, layered catalogue: the Sun,
// eight planets, the IAU dwarf planets, notable trans-Neptunian & belt bodies,
// famous comets, and the major moons — each with its real astrophysical &
// physical properties. Orbits are real (semi-major axis in AU, with eccentricity
// & inclination); the renderer auto-scales AU to world units per system and
// size-exaggerates bodies so they stay visible. Belts (asteroid, Kuiper) and the
// Oort shell are drawn as clouds; every body carries a `group` so the whole class
// can be toggled as a layer.
//
//   a  semi-major axis (AU)     e  eccentricity          inc orbital inclination (°)
//   r  physical radius (km)     period orbital period (yr)  tilt axial tilt (°)
//   massMe mass (Earth = 1)     density (g/cm³)           gravity surface (Earth g)
//   rotation sidereal spin (h, negative = retrograde)     tempK mean/eq temp (K)

export const SUN = {
  name: 'Sun', kind: 'star', group: 'star', spectral: 'G2V', r: 696000, massMe: 332946,
  tempK: 5772, lum: 1, rotation: 609.12, color: [1.0, 0.86, 0.45],
  composition: 'H (~73%) · He (~25%) plasma', facts:
    'A G2V yellow dwarf holding 99.86% of the Solar System’s mass. Its fusion core (~15 million K) converts 600 million tonnes of hydrogen to helium each second, powering all life on Earth.',
};

// ---- the eight planets ------------------------------------------------------
export const PLANETS = [
  { name: 'Mercury', kind: 'planet', group: 'planet', a: 0.387, e: 0.2056, inc: 7.00, period: 0.241, r: 2440,
    massMe: 0.0553, density: 5.43, gravity: 0.38, rotation: 1407.6, tilt: 0.03, tempK: 440, albedo: 0.07, moonsCount: 0,
    atmosphere: 'none (thin exosphere)', composition: 'iron core · silicate mantle', color: [0.62, 0.58, 0.53],
    facts: 'The smallest planet and closest to the Sun — an airless, cratered iron world with 600°C day-to-night temperature swings and a surprisingly large metallic core.' },
  { name: 'Venus', kind: 'planet', group: 'planet', a: 0.723, e: 0.0068, inc: 3.39, period: 0.615, r: 6052,
    massMe: 0.815, density: 5.24, gravity: 0.90, rotation: -5832.5, tilt: 177.4, tempK: 737, albedo: 0.77, moonsCount: 0,
    atmosphere: 'CO₂ · 92 bar', composition: 'rocky · basaltic', color: [0.92, 0.82, 0.55],
    facts: 'Earth’s rocky twin wrapped in a crushing CO₂ atmosphere. A runaway greenhouse bakes the surface to 465°C — hotter than Mercury — and it spins backwards, slower than it orbits.' },
  { name: 'Earth', kind: 'planet', group: 'planet', a: 1.000, e: 0.0167, inc: 0.00, period: 1.000, r: 6371,
    massMe: 1.000, density: 5.51, gravity: 1.00, rotation: 23.93, tilt: 23.44, tempK: 288, albedo: 0.31, moonsCount: 1,
    atmosphere: 'N₂ 78% · O₂ 21%', composition: 'iron core · silicate mantle · water', color: [0.36, 0.56, 0.86],
    facts: 'The only known living world — liquid-water oceans, a protective magnetic field and a large stabilising Moon. The densest planet in the Solar System.',
    moons: [{ name: 'Moon', aKm: 384400, r: 1737, tempK: 250, composition: 'anorthosite crust · iron-poor',
      facts: 'Earth’s single natural satellite — raised the tides that shaped life and stabilises the planet’s axial tilt. Formed from a giant impact ~4.5 Gyr ago.' }] },
  { name: 'Mars', kind: 'planet', group: 'planet', a: 1.524, e: 0.0934, inc: 1.85, period: 1.881, r: 3390,
    massMe: 0.1074, density: 3.93, gravity: 0.38, rotation: 24.62, tilt: 25.19, tempK: 210, albedo: 0.25, moonsCount: 2,
    atmosphere: 'thin CO₂ · 0.006 bar', composition: 'rocky · iron-oxide dust', color: [0.82, 0.42, 0.26],
    facts: 'The "Red Planet" — rusted deserts, the Solar System’s tallest volcano (Olympus Mons, 22 km) and Valles Marineris, plus ancient dry riverbeds hinting at a wetter past.',
    moons: [{ name: 'Phobos', aKm: 9376, r: 11, facts: 'A tiny, irregular inner moon spiralling towards Mars — it will break up or crash in ~50 Myr.' },
            { name: 'Deimos', aKm: 23460, r: 6, facts: 'The smaller, outer Martian moon; both are likely captured asteroids.' }] },
  { name: 'Jupiter', kind: 'planet', group: 'planet', a: 5.203, e: 0.0489, inc: 1.30, period: 11.86, r: 69911,
    massMe: 317.8, density: 1.33, gravity: 2.53, rotation: 9.93, tilt: 3.13, tempK: 165, albedo: 0.50, moonsCount: 95,
    atmosphere: 'H₂ · He · ammonia clouds', composition: 'gas giant · metallic-H interior', color: [0.83, 0.71, 0.56],
    facts: 'The giant of the system — 2.5× the mass of all other planets combined. The centuries-old Great Red Spot is a storm wider than Earth; its 95 moons include four planet-sized Galileans.',
    moons: [{ name: 'Io', aKm: 421700, r: 1822, tempK: 130, composition: 'silicate · sulfur',
      facts: 'The most volcanically active body known — hundreds of active volcanoes heated by tidal flexing from Jupiter and its sibling moons.' },
            { name: 'Europa', aKm: 671034, r: 1561, tempK: 102, composition: 'ice shell · salt-water ocean',
      facts: 'A cracked ice shell over a global salt-water ocean holding twice Earth’s water — a prime target in the search for life.' },
            { name: 'Ganymede', aKm: 1070412, r: 2634, tempK: 110, composition: 'ice · rock · iron core',
      facts: 'The largest moon in the Solar System, bigger than Mercury, and the only moon with its own magnetic field and a subsurface ocean.' },
            { name: 'Callisto', aKm: 1882700, r: 2410, tempK: 134, composition: 'ice · rock',
      facts: 'The most heavily cratered body known — an ancient, geologically dead ice-and-rock world, possibly hiding a deep ocean.' }] },
  { name: 'Saturn', kind: 'planet', group: 'planet', a: 9.537, e: 0.0565, inc: 2.49, period: 29.45, r: 58232,
    massMe: 95.2, density: 0.687, gravity: 1.07, rotation: 10.66, tilt: 26.73, tempK: 134, albedo: 0.50, moonsCount: 146,
    atmosphere: 'H₂ · He · ammonia haze', composition: 'gas giant (less dense than water)', color: [0.90, 0.82, 0.60], tilt2: 26.7,
    ring: { inner: 74500, outer: 140220 },
    facts: 'The ringed jewel — a gas giant so low in density it would float on water, girdled by a dazzling system of ice rings only ~10 m thick. Its 146 moons lead the Solar System.',
    moons: [{ name: 'Titan', aKm: 1221870, r: 2575, tempK: 94, composition: 'ice · organic haze',
      facts: 'The second-largest moon — a hazy world with a thick nitrogen atmosphere and rivers, lakes and rain of liquid methane.' },
            { name: 'Rhea', aKm: 527108, r: 764, facts: 'Saturn’s second-largest moon, an icy cratered world with a tenuous oxygen exosphere.' },
            { name: 'Iapetus', aKm: 3560820, r: 735, facts: 'The two-faced moon — one hemisphere bright ice, the other coated black, with a strange equatorial ridge.' },
            { name: 'Dione', aKm: 377396, r: 561, facts: 'An icy moon streaked with bright ice cliffs.' },
            { name: 'Enceladus', aKm: 237948, r: 252, tempK: 75, composition: 'fresh water ice',
      facts: 'A small moon venting water geysers from a subsurface ocean through its south-polar "tiger stripes" — feeding Saturn’s E ring.' },
            { name: 'Mimas', aKm: 185539, r: 198, facts: 'The "Death Star" moon, dominated by the huge Herschel crater.' }] },
  { name: 'Uranus', kind: 'planet', group: 'planet', a: 19.19, e: 0.0457, inc: 0.77, period: 84.02, r: 25362,
    massMe: 14.54, density: 1.27, gravity: 0.89, rotation: -17.24, tilt: 97.77, tempK: 76, albedo: 0.49, moonsCount: 28,
    atmosphere: 'H₂ · He · methane', composition: 'ice giant · water/ammonia/methane', color: [0.60, 0.85, 0.90], tilt2: 97.8,
    ring: { inner: 42000, outer: 51000 },
    facts: 'An ice giant tipped on its side (98° tilt), rolling around the Sun so each pole gets 42 years of sunlight then 42 of dark. Methane gives it its pale cyan colour; it has 13 faint rings.',
    moons: [{ name: 'Titania', aKm: 435910, r: 789, facts: 'Uranus’s largest moon, scarred by great fault canyons.' },
            { name: 'Oberon', aKm: 583520, r: 761, facts: 'The outermost large Uranian moon, dark and ancient.' },
            { name: 'Ariel', aKm: 190900, r: 579, facts: 'The brightest Uranian moon, with the youngest surface and long rift valleys.' },
            { name: 'Umbriel', aKm: 266000, r: 585, facts: 'The darkest large Uranian moon, with a mysterious bright ring "Wunda".' },
            { name: 'Miranda', aKm: 129390, r: 236, facts: 'A tiny moon with a jumbled, dramatic patchwork surface and 20 km cliffs.' }] },
  { name: 'Neptune', kind: 'planet', group: 'planet', a: 30.07, e: 0.0113, inc: 1.77, period: 164.8, r: 24622,
    massMe: 17.15, density: 1.64, gravity: 1.14, rotation: 16.11, tilt: 28.32, tempK: 72, albedo: 0.41, moonsCount: 16,
    atmosphere: 'H₂ · He · methane', composition: 'ice giant · densest giant', color: [0.28, 0.45, 0.86],
    facts: 'The windiest planet — supersonic 2,000 km/h storms tear across a deep-blue ice giant found by prediction from Uranus’s wobble, not by telescope. Densest of the four giants.',
    moons: [{ name: 'Triton', aKm: 354759, r: 1353, tempK: 38, composition: 'nitrogen ice · rock',
      facts: 'A large moon orbiting backwards with active nitrogen geysers — almost certainly a captured Kuiper-belt dwarf, slowly spiralling in.' },
            { name: 'Proteus', aKm: 117647, r: 210, facts: 'A dark, boxy inner moon near the largest a non-spherical body can be.' },
            { name: 'Nereid', aKm: 5513400, r: 170, facts: 'One of the most eccentric moon orbits known.' }] },
];

// ---- dwarf planets (IAU) + notable trans-Neptunian objects ------------------
export const DWARFS = [
  { name: 'Ceres', kind: 'dwarf', group: 'dwarf', a: 2.766, e: 0.0758, inc: 10.59, period: 4.60, r: 473,
    massMe: 0.00016, density: 2.16, gravity: 0.029, rotation: 9.07, tempK: 168, albedo: 0.09, moonsCount: 0, discovered: 1801,
    composition: 'ice · hydrated rock', color: [0.6, 0.6, 0.58],
    facts: 'The largest asteroid-belt body and the innermost dwarf planet — an icy world with bright salt deposits (cryovolcanic brine) in Occator crater. Holds ~25% of the belt’s mass.' },
  { name: 'Pluto', kind: 'dwarf', group: 'dwarf', a: 39.48, e: 0.2488, inc: 17.16, period: 248.0, r: 1188,
    massMe: 0.00218, density: 1.85, gravity: 0.063, rotation: -153.3, tilt: 122.5, tempK: 44, albedo: 0.52, moonsCount: 5, discovered: 1930,
    composition: 'nitrogen/methane ice · rock', color: [0.78, 0.68, 0.58],
    facts: 'The archetypal Kuiper-belt dwarf — a heart-shaped nitrogen-ice glacier (Sputnik Planitia), water-ice mountains and a thin haze, with a giant moon it is tidally locked to.',
    moons: [{ name: 'Charon', aKm: 19591, r: 606, facts: 'Half Pluto’s diameter — the two are a mutually-orbiting double world locked face-to-face.' },
            { name: 'Nix', aKm: 48690, r: 25, facts: 'A small, tumbling outer moon of Pluto.' },
            { name: 'Hydra', aKm: 64720, r: 30, facts: 'Pluto’s outermost known moon.' }] },
  { name: 'Haumea', kind: 'dwarf', group: 'dwarf', a: 43.13, e: 0.195, inc: 28.2, period: 284.0, r: 780,
    massMe: 0.00067, density: 2.6, gravity: 0.044, rotation: 3.92, tempK: 32, albedo: 0.51, moonsCount: 2, discovered: 2004,
    composition: 'crystalline water ice', color: [0.86, 0.84, 0.80], ring: { inner: 2252, outer: 2322 },
    facts: 'A dwarf planet spun so fast (a 3.9-hour day) that it is stretched into a rugby-ball shape twice as long as it is wide. It has two moons and a thin ring — the first found on a minor planet.' },
  { name: 'Makemake', kind: 'dwarf', group: 'dwarf', a: 45.79, e: 0.161, inc: 29.0, period: 306.0, r: 715,
    massMe: 0.0005, density: 1.9, gravity: 0.05, rotation: 22.83, tempK: 32, albedo: 0.81, moonsCount: 1, discovered: 2005,
    composition: 'methane · ethane ice', color: [0.80, 0.66, 0.56],
    facts: 'A bright, reddish Kuiper-belt dwarf coated in frozen methane, with one small dark moon. Its 2005 Easter discovery gave it its Rapa Nui creator-god name.' },
  { name: 'Eris', kind: 'dwarf', group: 'dwarf', a: 67.78, e: 0.4407, inc: 44.04, period: 558.0, r: 1163,
    massMe: 0.0028, density: 2.43, gravity: 0.084, rotation: 379.2, tempK: 30, albedo: 0.96, moonsCount: 1, discovered: 2005,
    composition: 'nitrogen/methane ice · rock', color: [0.90, 0.90, 0.92],
    facts: 'The most massive dwarf planet — slightly heavier than Pluto — on a distant, tilted, eccentric orbit. Its 2005 discovery triggered the redefinition of "planet" that demoted Pluto.',
    moons: [{ name: 'Dysnomia', aKm: 37300, r: 350, facts: 'Eris’s single dark moon, used to weigh the dwarf precisely.' }] },
];

// distant/scattered trans-Neptunian bodies (kuiper layer)
export const TNOS = [
  { name: 'Gonggong', kind: 'tno', group: 'kuiper', a: 67.5, e: 0.50, inc: 30.6, period: 554.0, r: 615,
    massMe: 0.00030, rotation: 22.4, tempK: 30, albedo: 0.14, moonsCount: 1, discovered: 2007, composition: 'ice · red tholins', color: [0.7, 0.42, 0.4],
    facts: 'A large, dark-red scattered-disc dwarf with a moon (Xiangliu) and traces of water ice and methane frost.' },
  { name: 'Quaoar', kind: 'tno', group: 'kuiper', a: 43.7, e: 0.039, inc: 8.0, period: 288.0, r: 555,
    massMe: 0.00023, rotation: 17.7, tempK: 44, albedo: 0.12, moonsCount: 1, discovered: 2002, composition: 'ice · rock', color: [0.72, 0.6, 0.52], ring: { inner: 4100, outer: 4400 },
    facts: 'A Kuiper-belt dwarf with a moon (Weywot) and a ring far outside the distance where rings "should" collapse into a moon — a puzzle for ring physics.' },
  { name: 'Orcus', kind: 'tno', group: 'kuiper', a: 39.4, e: 0.22, inc: 20.6, period: 247.0, r: 458,
    massMe: 0.00011, rotation: 13.2, tempK: 44, albedo: 0.23, moonsCount: 1, discovered: 2004, composition: 'water ice · ammonia', color: [0.66, 0.7, 0.74],
    facts: 'The "anti-Pluto" — same orbital period as Pluto but always on the opposite side, with a relatively large moon (Vanth).' },
  { name: 'Sedna', kind: 'tno', group: 'kuiper', a: 506.0, e: 0.855, inc: 11.9, period: 11400.0, r: 500,
    massMe: 0.0002, rotation: 10.3, tempK: 12, albedo: 0.32, moonsCount: 0, discovered: 2003, composition: 'ultra-red tholins · ice', color: [0.72, 0.34, 0.28],
    facts: 'One of the most distant known bodies — never closer than 76 AU, ranging out past 900 AU on an 11,400-year orbit. Its detached path hints at an unseen distant perturber.' },
];

// notable asteroids (asteroid layer) — the belt’s named heavyweights
export const ASTEROIDS = [
  { name: 'Vesta', kind: 'asteroid', group: 'asteroid', a: 2.362, e: 0.089, inc: 7.14, period: 3.63, r: 262,
    massMe: 0.0000434, density: 3.46, rotation: 5.34, tempK: 255, albedo: 0.42, discovered: 1807, composition: 'differentiated basalt', color: [0.78, 0.74, 0.66],
    facts: 'The brightest asteroid and second-most-massive — a differentiated protoplanet with a huge south-polar impact basin that flung meteorites to Earth.' },
  { name: 'Pallas', kind: 'asteroid', group: 'asteroid', a: 2.772, e: 0.231, inc: 34.83, period: 4.61, r: 256,
    massMe: 0.0000357, density: 2.89, rotation: 7.81, tempK: 164, albedo: 0.16, discovered: 1802, composition: 'carbon/silicate', color: [0.6, 0.62, 0.6],
    facts: 'The third-largest asteroid, on a steeply tilted 35° orbit that makes it hard to reach — a battered survivor of the early belt.' },
  { name: 'Hygiea', kind: 'asteroid', group: 'asteroid', a: 3.142, e: 0.112, inc: 3.83, period: 5.57, r: 217,
    massMe: 0.0000145, density: 1.94, rotation: 13.8, tempK: 164, albedo: 0.07, discovered: 1849, composition: 'dark carbonaceous', color: [0.5, 0.5, 0.52],
    facts: 'The fourth-largest asteroid — nearly round enough to be a dwarf planet, and the largest of the dark carbon-rich outer belt.' },
];

// famous comets (comet layer) — highly eccentric orbits with a tail
export const COMETS = [
  { name: '1P/Halley', kind: 'comet', group: 'comet', a: 17.8, e: 0.967, inc: 162.3, period: 75.3, r: 5.5,
    tempK: 100, albedo: 0.04, discovered: '−240 (1P)', composition: 'ice · dust · organics', color: [0.7, 0.85, 0.9],
    facts: 'The most famous comet — the first shown to be periodic, returning every ~76 years on a retrograde orbit. Last seen 1986; next perihelion 2061.' },
  { name: '2P/Encke', kind: 'comet', group: 'comet', a: 2.22, e: 0.848, inc: 11.8, period: 3.30, r: 2.4,
    tempK: 200, albedo: 0.05, discovered: 1786, composition: 'ice · dust', color: [0.7, 0.85, 0.9],
    facts: 'The comet with the shortest known period (3.3 yr) — parent of the Taurid meteor showers, now nearly stripped of ice.' },
  { name: 'C/1995 O1 Hale–Bopp', kind: 'comet', group: 'comet', a: 186.0, e: 0.995, inc: 89.4, period: 2533.0, r: 30,
    tempK: 90, albedo: 0.04, discovered: 1995, composition: 'ice · dust · CO', color: [0.75, 0.88, 0.95],
    facts: 'The "Great Comet of 1997" — an exceptionally large, bright nucleus visible to the naked eye for a record 18 months. It will not return for ~2,500 years.' },
];

// belts & shells — drawn as clouds, toggled as layers
export const BELTS = [
  { name: 'Asteroid Belt', group: 'asteroid', kind: 'belt', inner: 2.06, outer: 3.28, incMax: 18, count: 2200, color: [0.72, 0.66, 0.55],
    facts: 'The main asteroid belt between Mars and Jupiter — millions of rocky bodies totalling only ~3% of the Moon’s mass, shepherded into gaps (Kirkwood gaps) by Jupiter’s resonances.' },
  { name: 'Kuiper Belt', group: 'kuiper', kind: 'belt', inner: 30, outer: 50, incMax: 28, count: 3000, color: [0.55, 0.62, 0.78],
    facts: 'A vast ring of icy bodies beyond Neptune — the source of short-period comets and home to Pluto and the other Kuiper dwarfs. Hundreds of times more massive than the asteroid belt.' },
];

// the Oort cloud — a schematic spherical shell (toggle), far beyond the planets
export const OORT = { group: 'oort', kind: 'shell', inner: 2000, outer: 5000, count: 2600, color: [0.5, 0.55, 0.7],
  facts: 'The Oort cloud — a hypothesised spherical shell of trillions of icy bodies from ~2,000 to 100,000 AU, the source of long-period comets and the true edge of the Sun’s domain.' };

// Jupiter Trojans — two clouds at the Sun–Jupiter L4/L5 points (±60°)
export const TROJANS = { group: 'trojan', kind: 'trojan', a: 5.203, spread: 0.9, count: 900, incMax: 25, color: [0.6, 0.55, 0.45],
  facts: 'The Jupiter Trojans — two great swarms of asteroids trapped 60° ahead of and behind Jupiter at the stable L4/L5 Lagrange points; over a million larger than 1 km.' };

// the assembled Solar System descriptor (systems registry consumes this shape)
export const SOLAR_SYSTEM = {
  id: 'sol', name: 'Solar System', tag: 'Sol', kind: 'real', distanceLy: 0,
  star: SUN,
  bodies: [...PLANETS, ...DWARFS, ...TNOS, ...ASTEROIDS, ...COMETS],
  belts: BELTS, oort: OORT, trojans: TROJANS,
  facts: 'Our home system — one G-type star, eight planets, five-plus dwarf planets, ~300 moons, two great belts and a distant comet cloud, all born from one collapsing cloud 4.6 billion years ago.',
};
