// The Solar System, for the SYSTEM scale — the Sun, the eight planets, a few
// dwarf planets and the major moons. Orbits are drawn to real scale (semi-major
// axis in AU, with eccentricity & inclination); body sizes are exaggerated on a
// gentle cube-root law so they stay visible against the vast orbital distances.
// Moon orbital radii are exaggerated too (real ones are invisibly small next to
// an AU) but their relative order is preserved.
//
//   a      semi-major axis (AU)         e     eccentricity
//   inc    orbital inclination (deg)    r     physical radius (km)
//   period orbital period (years)       tilt  axial/ring tilt (deg)

export const SUN = {
  name: 'Sun', kind: 'star', r: 696000, color: [1.0, 0.86, 0.45],
  facts: 'The Sun — a G2V yellow dwarf holding 99.86% of the Solar System’s mass; its fusion core powers all life on Earth.',
};

export const PLANETS = [
  { name: 'Mercury', kind: 'planet', a: 0.387, e: 0.2056, inc: 7.00, r: 2440, period: 0.241, color: [0.62, 0.58, 0.53],
    facts: 'The smallest planet and the closest to the Sun — an airless, cratered world of extreme temperature swings.' },
  { name: 'Venus', kind: 'planet', a: 0.723, e: 0.0068, inc: 3.39, r: 6052, period: 0.615, color: [0.92, 0.82, 0.55],
    facts: 'A rocky twin of Earth wrapped in a crushing CO₂ atmosphere; a runaway greenhouse bakes its surface to 465°C.' },
  { name: 'Earth', kind: 'planet', a: 1.000, e: 0.0167, inc: 0.00, r: 6371, period: 1.000, color: [0.36, 0.56, 0.86],
    facts: 'The only known living world — liquid-water oceans, a protective magnetic field, and one large Moon.',
    moons: [{ name: 'Moon', aKm: 384400, r: 1737, facts: 'Earth’s single natural satellite; raised the tides that shaped life and stabilises the planet’s tilt.' }] },
  { name: 'Mars', kind: 'planet', a: 1.524, e: 0.0934, inc: 1.85, r: 3390, period: 1.881, color: [0.82, 0.42, 0.26],
    facts: 'The "Red Planet" — rusted deserts, the Solar System’s tallest volcano (Olympus Mons) and ancient dry riverbeds.',
    moons: [{ name: 'Phobos', aKm: 9376, r: 11, facts: 'A tiny, doomed inner moon spiralling towards Mars.' },
            { name: 'Deimos', aKm: 23460, r: 6, facts: 'The smaller, outer Martian moon.' }] },
  { name: 'Ceres', kind: 'dwarf', a: 2.766, e: 0.0758, inc: 10.59, r: 473, period: 4.60, color: [0.6, 0.6, 0.58],
    facts: 'The largest asteroid-belt body and closest dwarf planet — an icy world with bright salt deposits in Occator crater.' },
  { name: 'Jupiter', kind: 'planet', a: 5.203, e: 0.0489, inc: 1.30, r: 69911, period: 11.86, color: [0.83, 0.71, 0.56],
    facts: 'The giant of the system — a gas world with the centuries-old Great Red Spot storm and 90+ moons.',
    moons: [{ name: 'Io', aKm: 421700, r: 1822, facts: 'The most volcanically active body known, heated by tidal flexing.' },
            { name: 'Europa', aKm: 671034, r: 1561, facts: 'An ice shell over a global salt-water ocean — a prime search for life.' },
            { name: 'Ganymede', aKm: 1070412, r: 2634, facts: 'The largest moon in the Solar System, bigger than Mercury, with its own magnetic field.' },
            { name: 'Callisto', aKm: 1882700, r: 2410, facts: 'A heavily cratered, ancient ice-and-rock world.' }] },
  { name: 'Saturn', kind: 'planet', a: 9.537, e: 0.0565, inc: 2.49, r: 58232, period: 29.45, color: [0.90, 0.82, 0.60], tilt: 26.7,
    ring: { inner: 74500, outer: 140220 },
    facts: 'The ringed jewel — a low-density gas giant girdled by a dazzling system of ice rings.',
    moons: [{ name: 'Titan', aKm: 1221870, r: 2575, facts: 'A hazy moon with a thick atmosphere and lakes of liquid methane.' },
            { name: 'Rhea', aKm: 527108, r: 764, facts: 'Saturn’s second-largest moon, an icy cratered world.' },
            { name: 'Enceladus', aKm: 237948, r: 252, facts: 'A small moon venting water geysers from a subsurface ocean.' }] },
  { name: 'Uranus', kind: 'planet', a: 19.19, e: 0.0457, inc: 0.77, r: 25362, period: 84.02, color: [0.60, 0.85, 0.90], tilt: 97.8,
    ring: { inner: 42000, outer: 51000 },
    facts: 'An ice giant tipped on its side (98° tilt), rolling around the Sun; palest blue from atmospheric methane.',
    moons: [{ name: 'Titania', aKm: 435910, r: 789, facts: 'Uranus’s largest moon, scarred by great canyons.' },
            { name: 'Oberon', aKm: 583520, r: 761, facts: 'The outermost large Uranian moon.' },
            { name: 'Miranda', aKm: 129390, r: 236, facts: 'A tiny moon with a jumbled, dramatic patchwork surface.' }] },
  { name: 'Neptune', kind: 'planet', a: 30.07, e: 0.0113, inc: 1.77, r: 24622, period: 164.8, color: [0.28, 0.45, 0.86],
    facts: 'The windiest planet — a deep-blue ice giant with supersonic storms, found by prediction from Uranus’s wobble.',
    moons: [{ name: 'Triton', aKm: 354759, r: 1353, facts: 'A large moon orbiting backwards, with nitrogen geysers — likely a captured Kuiper-belt world.' }] },
  { name: 'Pluto', kind: 'dwarf', a: 39.48, e: 0.2488, inc: 17.16, r: 1188, period: 248.0, color: [0.78, 0.68, 0.58],
    facts: 'The famous dwarf planet of the Kuiper Belt — a heart-shaped nitrogen-ice plain (Sputnik Planitia) and a big moon.',
    moons: [{ name: 'Charon', aKm: 19591, r: 606, facts: 'Half Pluto’s size — the two are a mutually-orbiting double world.' }] },
  { name: 'Eris', kind: 'dwarf', a: 67.78, e: 0.4407, inc: 44.04, r: 1163, period: 558.0, color: [0.82, 0.82, 0.84],
    facts: 'A distant, massive Kuiper-belt dwarf whose 2005 discovery triggered the redefinition of "planet".',
    moons: [{ name: 'Dysnomia', aKm: 37300, r: 350, facts: 'Eris’s only known moon.' }] },
];
