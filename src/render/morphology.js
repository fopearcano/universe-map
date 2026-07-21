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

// Galaxies — structured, not a flat scatter: a spiral gets log-spiral arms with a
// realistic pitch, an optional central bar, a golden bulge, a diffuse red halo,
// blue-white HII star-forming knots strung along the arms, and a radial colour
// gradient (golden core → blue arms). Ellipticals get a de-Vaucouleurs-ish
// ellipsoid with a core→edge gradient + halo; irregulars a clumpy disc of knots.
export function galaxyCloud(morph, R, rnd, count) {
  const N = count || 1500;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const arms = 2 + Math.floor(rnd() * 3);                 // 2–4 spiral arms
  const pitch = 0.22 + rnd() * 0.16;                       // arm winding (log-spiral b)
  const barred = morph === 'spiral' && rnd() < 0.45;       // ~half of spirals are barred
  const barLen = R * (0.22 + rnd() * 0.12), barW = R * 0.05;
  const tilt = rnd() * Math.PI, roll = rnd() * Math.PI * 2;
  const spin = rnd() < 0.5 ? 1 : -1;
  // a handful of bright HII / star-forming knots seeded along the arms
  const KN = morph === 'spiral' ? 26 + Math.floor(rnd() * 22) : (morph === 'irregular' ? 34 : 0);
  const knots = [];
  for (let k = 0; k < KN; k++) {
    const rr = (0.25 + 0.72 * rnd()) * R;
    const arm = Math.floor(rnd() * arms) * (Math.PI * 2 / arms);
    const a = arm + spin * Math.log(rr / (R * 0.06) + 1) / pitch;
    knots.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr, s: R * (0.02 + rnd() * 0.05) });
  }
  const core = [1.0, 0.86, 0.6], bulge = [1.0, 0.82, 0.55], armC = [0.62, 0.76, 1.0], hii = [0.7, 0.9, 1.0], halo = [0.9, 0.6, 0.5], irr = [0.72, 0.86, 1.0];
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  for (let i = 0; i < N; i++) {
    let r, a, z, c, bright = 1;
    const u = rnd();
    if (morph === 'elliptical') {
      r = Math.pow(rnd(), 0.55) * R; a = rnd() * Math.PI * 2;
      z = (rnd() - 0.5) * R * 0.72 * (1 - 0.7 * r / R);   // oblate
      c = lerp3(core, halo, Math.min(1, r / R));
      if (u < 0.06) { r *= 1.6; c = halo; bright = 0.6; } // sparse halo
    } else if (morph === 'irregular') {
      if (u < 0.5 && knots.length) { const kn = knots[Math.floor(rnd() * knots.length)]; const rr = kn.s * Math.sqrt(rnd()); const ph = rnd() * Math.PI * 2; r = Math.hypot(kn.x + Math.cos(ph) * rr, kn.y + Math.sin(ph) * rr); a = Math.atan2(kn.y + Math.sin(ph) * rr, kn.x + Math.cos(ph) * rr); c = hii; bright = 1.2; }
      else { r = Math.pow(rnd(), 0.5) * R; a = rnd() * Math.PI * 2 + Math.sin(r * 18) * 0.7; c = irr; }
      z = (rnd() - 0.5) * R * 0.16;
    } else { // spiral / lenticular
      const isBulge = u < 0.18;
      if (isBulge) { r = Math.pow(rnd(), 1.7) * R * 0.32; a = rnd() * Math.PI * 2; z = (rnd() - 0.5) * R * 0.24 * (1 - r / (R * 0.32)); c = lerp3(core, bulge, Math.min(1, r / (R * 0.32))); }
      else if (barred && u < 0.36) { // central bar
        const t = rnd() * 2 - 1; r = Math.abs(t) * barLen; a = Math.atan2((rnd() - 0.5) * barW, t * barLen); const bx = t * barLen; const by = (rnd() - 0.5) * barW; r = Math.hypot(bx, by); a = Math.atan2(by, bx); z = (rnd() - 0.5) * R * 0.05; c = lerp3(core, bulge, 0.5);
      } else if (rnd() < 0.34 && knots.length) { // an HII knot along an arm
        const kn = knots[Math.floor(rnd() * knots.length)]; const rr = kn.s * Math.sqrt(rnd()); const ph = rnd() * Math.PI * 2; const x = kn.x + Math.cos(ph) * rr, y = kn.y + Math.sin(ph) * rr; r = Math.hypot(x, y); a = Math.atan2(y, x); z = (rnd() - 0.5) * R * 0.04; c = hii; bright = 1.3;
      } else { // the arms — log spiral with scatter
        r = Math.pow(rnd(), 0.55) * R;
        const arm = Math.floor(rnd() * arms) * (Math.PI * 2 / arms);
        a = arm + spin * Math.log(r / (R * 0.06) + 1) / pitch + (rnd() - 0.5) * 0.35;
        z = (rnd() - 0.5) * R * 0.045;
        c = lerp3(armC, halo, Math.max(0, r / R - 0.6) / 0.4);   // outskirts redden slightly
        bright = 0.85 + 0.3 * rnd();
      }
    }
    let x = Math.cos(a) * r, y = Math.sin(a) * r;
    const xr = x * Math.cos(roll) - y * Math.sin(roll); y = x * Math.sin(roll) + y * Math.cos(roll); x = xr;
    const yt = y * Math.cos(tilt) - z * Math.sin(tilt); z = y * Math.sin(tilt) + z * Math.cos(tilt); y = yt;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    col[i * 3] = c[0] * bright; col[i * 3 + 1] = c[1] * bright; col[i * 3 + 2] = c[2] * bright;
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
