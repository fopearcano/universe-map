// A hand-curated set of Local Group & nearby galaxies to bridge the gap between
// the Milky Way's stars and the deep galaxy surveys. Distances are direct
// measurements (Mpc), not redshift-derived (peculiar motion dominates this close).
// Positions are RA/Dec (deg, J2000); values follow the McConnachie (2012) Local
// Group census and standard NED/SIMBAD entries.
export const LOCAL_GROUP = [
  // ---- Milky Way's brightest companions ----
  { name: 'Large Magellanic Cloud', ra: 80.894, dec: -69.756, distMpc: 0.0499, type: 'SBm irregular' },
  { name: 'Small Magellanic Cloud', ra: 13.187, dec: -72.829, distMpc: 0.0620, type: 'dwarf irregular' },
  { name: 'Sagittarius Dwarf', ra: 283.831, dec: -30.545, distMpc: 0.0200, type: 'dwarf elliptical' },
  { name: 'Canis Major Dwarf', ra: 108.150, dec: -27.670, distMpc: 0.0079, type: 'disrupted dwarf' },

  // ---- Milky Way dwarf spheroidals (classical) ----
  { name: 'Sculptor Dwarf', ra: 15.039, dec: -33.709, distMpc: 0.086, type: 'dwarf spheroidal' },
  { name: 'Fornax Dwarf', ra: 39.997, dec: -34.449, distMpc: 0.147, type: 'dwarf spheroidal' },
  { name: 'Leo I', ra: 152.117, dec: 12.309, distMpc: 0.254, type: 'dwarf spheroidal' },
  { name: 'Leo II', ra: 168.370, dec: 22.152, distMpc: 0.233, type: 'dwarf spheroidal' },
  { name: 'Draco Dwarf', ra: 260.060, dec: 57.921, distMpc: 0.076, type: 'dwarf spheroidal' },
  { name: 'Ursa Minor Dwarf', ra: 227.285, dec: 67.222, distMpc: 0.076, type: 'dwarf spheroidal' },
  { name: 'Sextans Dwarf', ra: 153.262, dec: -1.615, distMpc: 0.086, type: 'dwarf spheroidal' },
  { name: 'Carina Dwarf', ra: 100.403, dec: -50.966, distMpc: 0.105, type: 'dwarf spheroidal' },

  // ---- Milky Way ultra-faint dwarfs ----
  { name: 'Boötes I', ra: 210.025, dec: 14.500, distMpc: 0.066, type: 'ultra-faint dwarf' },
  { name: 'Canes Venatici I', ra: 202.015, dec: 33.556, distMpc: 0.218, type: 'dwarf spheroidal' },
  { name: 'Hercules Dwarf', ra: 247.758, dec: 12.792, distMpc: 0.132, type: 'ultra-faint dwarf' },
  { name: 'Ursa Major I', ra: 158.720, dec: 51.920, distMpc: 0.097, type: 'ultra-faint dwarf' },
  { name: 'Ursa Major II', ra: 132.875, dec: 63.130, distMpc: 0.032, type: 'ultra-faint dwarf' },
  { name: 'Coma Berenices Dwarf', ra: 186.746, dec: 23.904, distMpc: 0.044, type: 'ultra-faint dwarf' },
  { name: 'Segue 1', ra: 151.767, dec: 16.082, distMpc: 0.023, type: 'ultra-faint dwarf' },
  { name: 'Segue 2', ra: 34.817, dec: 20.175, distMpc: 0.035, type: 'ultra-faint dwarf' },
  { name: 'Leo IV', ra: 173.237, dec: -0.533, distMpc: 0.154, type: 'ultra-faint dwarf' },
  { name: 'Leo V', ra: 172.790, dec: 2.220, distMpc: 0.178, type: 'ultra-faint dwarf' },
  { name: 'Reticulum II', ra: 53.920, dec: -54.050, distMpc: 0.030, type: 'ultra-faint dwarf' },
  { name: 'Tucana II', ra: 342.980, dec: -58.570, distMpc: 0.058, type: 'ultra-faint dwarf' },
  { name: 'Pisces II', ra: 344.629, dec: 5.955, distMpc: 0.183, type: 'ultra-faint dwarf' },

  // ---- Andromeda (M31) and its satellites ----
  { name: 'Andromeda Galaxy (M31)', ra: 10.685, dec: 41.269, distMpc: 0.765, type: 'SA(s)b spiral' },
  { name: 'Triangulum Galaxy (M33)', ra: 23.462, dec: 30.660, distMpc: 0.870, type: 'SA(s)cd spiral' },
  { name: 'M32', ra: 10.674, dec: 40.865, distMpc: 0.763, type: 'compact elliptical' },
  { name: 'M110 (NGC 205)', ra: 10.092, dec: 41.685, distMpc: 0.820, type: 'dwarf elliptical' },
  { name: 'NGC 147', ra: 8.301, dec: 48.508, distMpc: 0.676, type: 'dwarf spheroidal' },
  { name: 'NGC 185', ra: 9.742, dec: 48.337, distMpc: 0.617, type: 'dwarf spheroidal' },
  { name: 'Andromeda I', ra: 11.418, dec: 38.000, distMpc: 0.745, type: 'dwarf spheroidal' },
  { name: 'Andromeda II', ra: 19.124, dec: 33.420, distMpc: 0.652, type: 'dwarf spheroidal' },
  { name: 'Andromeda III', ra: 8.849, dec: 36.506, distMpc: 0.744, type: 'dwarf spheroidal' },
  { name: 'Andromeda VII (Cassiopeia)', ra: 351.632, dec: 50.677, distMpc: 0.762, type: 'dwarf spheroidal' },
  { name: 'Andromeda XXI', ra: 358.660, dec: 42.470, distMpc: 0.859, type: 'dwarf spheroidal' },
  { name: 'LGS 3 (Pisces)', ra: 15.980, dec: 21.884, distMpc: 0.769, type: 'dwarf transition' },
  { name: 'IC 1613', ra: 16.199, dec: 2.120, distMpc: 0.755, type: 'dwarf irregular' },
  { name: 'Pegasus Dwarf (DDO 216)', ra: 352.142, dec: 14.746, distMpc: 0.920, type: 'dwarf transition' },
  { name: 'Cetus Dwarf', ra: 6.531, dec: -11.043, distMpc: 0.755, type: 'dwarf spheroidal' },

  // ---- isolated Local Group members ----
  { name: 'IC 10', ra: 5.072, dec: 59.303, distMpc: 0.660, type: 'dwarf irregular starburst' },
  { name: 'NGC 6822 (Barnard)', ra: 296.234, dec: -14.803, distMpc: 0.500, type: 'dwarf irregular' },
  { name: 'WLM', ra: 0.492, dec: -15.461, distMpc: 0.933, type: 'dwarf irregular' },
  { name: 'Leo A', ra: 149.860, dec: 30.746, distMpc: 0.798, type: 'dwarf irregular' },
  { name: 'Leo T', ra: 143.722, dec: 17.051, distMpc: 0.417, type: 'dwarf transition' },
  { name: 'Phoenix Dwarf', ra: 27.776, dec: -44.445, distMpc: 0.415, type: 'dwarf transition' },
  { name: 'Tucana Dwarf', ra: 340.457, dec: -64.419, distMpc: 0.887, type: 'dwarf spheroidal' },
  { name: 'Aquarius Dwarf (DDO 210)', ra: 311.719, dec: -12.848, distMpc: 1.072, type: 'dwarf irregular' },
  { name: 'SagDIG', ra: 292.496, dec: -17.680, distMpc: 1.067, type: 'dwarf irregular' },
  { name: 'Antlia Dwarf', ra: 143.870, dec: -27.350, distMpc: 1.320, type: 'dwarf transition' },

  // ---- nearby galaxies just beyond the Local Group ----
  { name: 'NGC 3109', ra: 150.780, dec: -26.159, distMpc: 1.300, type: 'Magellanic spiral' },
  { name: 'Sextans A', ra: 152.751, dec: -4.693, distMpc: 1.320, type: 'dwarf irregular' },
  { name: 'Sextans B', ra: 150.000, dec: 5.332, distMpc: 1.360, type: 'dwarf irregular' },
  { name: 'NGC 55', ra: 3.723, dec: -39.196, distMpc: 2.000, type: 'Magellanic spiral' },
  { name: 'NGC 300', ra: 13.723, dec: -37.684, distMpc: 2.080, type: 'SA(s)d spiral' },
  { name: 'IC 342', ra: 56.702, dec: 68.096, distMpc: 3.280, type: 'intermediate spiral' },
  { name: 'NGC 253 (Sculptor)', ra: 11.888, dec: -25.288, distMpc: 3.500, type: 'starburst spiral' },
  { name: 'M81 (Bode)', ra: 148.888, dec: 69.065, distMpc: 3.630, type: 'SA(s)ab spiral' },
  { name: 'M82 (Cigar)', ra: 148.968, dec: 69.680, distMpc: 3.530, type: 'starburst irregular' },
  { name: 'NGC 247', ra: 11.786, dec: -20.760, distMpc: 3.400, type: 'SAB(s)d spiral' },
  { name: 'Centaurus A (NGC 5128)', ra: 201.365, dec: -43.019, distMpc: 3.800, type: 'peculiar elliptical' },
  { name: 'Maffei I', ra: 39.198, dec: 59.653, distMpc: 3.400, type: 'elliptical (obscured)' },
  { name: 'NGC 6503', ra: 267.360, dec: 70.144, distMpc: 5.270, type: 'dwarf spiral' },
];
