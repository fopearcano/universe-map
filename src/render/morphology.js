// Procedural, illustrative morphology for stellar structures. Real per-object
// morphology data does not exist at catalogue scale, so a structure's shape is
// derived from its type string (galaxy Hubble type / star-cluster class). These
// clouds are clearly illustrative — a way to *see* systems, galaxy shapes and
// cluster structure — not observed geometry.

// A small deterministic PRNG so a given object always resolves to the same shape.
export function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Integer seed from a world position (stable per object).
export function seedFromVec(v) {
  return (Math.floor(Math.abs(v.x * 733.1 + v.y * 977.7 + v.z * 613.3)) % 2147483647) || 12345;
}

// Map a free-text type string to a morphology class.
export function morphFromType(type = '') {
  const t = String(type).toLowerCase();
  if (/globular/.test(t)) return 'globular';
  if (/\bopen\b/.test(t)) return 'open';
  if (/ellip|lenticular|spheroidal|\bdsph\b|^e\d|\bcd\b|\bs0\b/.test(t)) return 'elliptical';
  if (/irr|magellanic|\bsm\b|starburst|dwarf irregular|\bim\b/.test(t)) return 'irregular';
  return 'spiral'; // spirals + anything unclassified
}

// Build a point cloud (positions + colours), centred at the origin, extent ≈ R.
export function structureCloud(morph, R, seed, opts = {}) {
  const rnd = mulberry(seed);
  if (morph === 'globular' || morph === 'open') return clusterCloud(morph, R, rnd, opts.count);
  return galaxyCloud(morph, R, rnd, opts.count);
}

// Galaxies: spiral (log arms + bulge), elliptical (smooth ellipsoid), irregular
// (clumpy thin disc).
export function galaxyCloud(morph, R, rnd, count) {
  const N = count || 1500;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const arms = 2 + Math.floor(rnd() * 3), tilt = rnd() * Math.PI, roll = rnd() * Math.PI * 2;
  const disk = [0.6, 0.75, 1.0], bulge = [1.0, 0.85, 0.62], irr = [0.72, 0.86, 1.0];
  for (let i = 0; i < N; i++) {
    const isBulge = rnd() < (morph === 'elliptical' ? 0.8 : 0.28);
    let r, a, z;
    if (morph === 'elliptical') {
      r = Math.pow(rnd(), 0.5) * R; a = rnd() * Math.PI * 2; z = (rnd() - 0.5) * R * 0.7 * (1 - r / R);
    } else if (morph === 'irregular') {
      r = Math.pow(rnd(), 0.5) * R; a = rnd() * Math.PI * 2 + Math.sin(r * 18) * 0.7; z = (rnd() - 0.5) * R * 0.14;
    } else { // spiral
      r = isBulge ? Math.pow(rnd(), 2) * R * 0.35 : Math.pow(rnd(), 0.6) * R;
      const arm = Math.floor(rnd() * arms) * (Math.PI * 2 / arms);
      a = arm + r * 7 + (rnd() - 0.5) * 0.5; z = (rnd() - 0.5) * (isBulge ? R * 0.28 : R * 0.05);
    }
    let x = Math.cos(a) * r, y = Math.sin(a) * r;
    const xr = x * Math.cos(roll) - y * Math.sin(roll); y = x * Math.sin(roll) + y * Math.cos(roll); x = xr;
    const yt = y * Math.cos(tilt) - z * Math.sin(tilt); z = y * Math.sin(tilt) + z * Math.cos(tilt); y = yt;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    const c = morph === 'irregular' ? irr : (isBulge || morph === 'elliptical' ? bulge : disk);
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
  }
  return { positions: pos, colors: col };
}

// Star clusters: globular (dense Plummer sphere, older/golden) and open (loose,
// slightly flattened scatter of young blue-white stars).
export function clusterCloud(type, R, rnd, count) {
  const globular = type === 'globular';
  const N = count || (globular ? 1400 : 320);
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const c = globular ? [1.0, 0.9, 0.68] : [0.78, 0.86, 1.0];
  const a = R * 0.42;
  for (let i = 0; i < N; i++) {
    let r;
    if (globular) { r = Math.min(R * 1.7, a / Math.sqrt(Math.pow(Math.max(1e-4, rnd()), -2 / 3) - 1)); }
    else { r = Math.pow(rnd(), 0.5) * R; }
    const u = rnd() * 2 - 1, ph = rnd() * Math.PI * 2, s = Math.sqrt(Math.max(0, 1 - u * u));
    const flat = globular ? 1 : 0.55; // open clusters a touch flattened
    pos[i * 3] = r * s * Math.cos(ph); pos[i * 3 + 1] = r * s * Math.sin(ph); pos[i * 3 + 2] = r * u * flat;
    const b = globular ? 0.75 + rnd() * 0.25 : 0.8 + rnd() * 0.2;
    col[i * 3] = c[0] * b; col[i * 3 + 1] = c[1] * b; col[i * 3 + 2] = c[2] * b;
  }
  return { positions: pos, colors: col };
}
