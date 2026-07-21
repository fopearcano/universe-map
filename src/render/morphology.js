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

// Galaxies — structured and genuinely varied, not a flat scatter. Every galaxy
// draws a distinct set of morphology knobs from its seed so no two read alike:
//   · spirals come in flavours — grand-design (few sharp arms), flocculent (many
//     faint fragmented arms), or ringed — with a variable arm count, pitch, bar
//     strength, bulge fraction, disc thickness, a stellar age (blue↔red palette),
//     bright blue-white HII knots strung along the arms, a globular-halo sprinkle,
//     and an optional dust lane that reads as a dark band edge-on;
//   · lenticulars (S0) get a big smooth bulge + a featureless disc, no arms;
//   · ellipticals get a triaxial de-Vaucouleurs-ish spheroid (boxy↔disky) with a
//     core→edge colour gradient, a halo and orbiting globular specks;
//   · dwarves are diffuse, low-concentration, lightly lumpy;
//   · irregulars are clumpy with an optional tidal tail streaming off one side.
// Returns positions + colours + a per-star size hint (nucleus & HII knots big,
// halo small) so the interior renderer can size stars by role.
export function galaxyCloud(morph, R, rnd, count) {
  const N = count || 1500;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), siz = new Float32Array(N);
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // ---- per-galaxy variety knobs (deterministic from this galaxy's rnd) --------
  const age = rnd();                                       // 0 young/blue … 1 old/red
  const arms = 2 + Math.floor(rnd() * 4);                  // 2–5 spiral arms
  const pitch = 0.14 + rnd() * 0.34;                       // arm winding (log-spiral b)
  const flavour = rnd();                                   // spiral sub-type selector
  const grand = flavour < 0.5;                             // grand-design vs flocculent
  const ringed = !grand && flavour > 0.82;                 // a ring galaxy
  const armSharp = grand ? 0.16 + rnd() * 0.12 : 0.4 + rnd() * 0.4;  // arm scatter
  const barred = (morph === 'spiral') && rnd() < 0.5;
  const barStr = barred ? 0.5 + rnd() * 0.5 : 0;
  const barLen = R * (0.2 + rnd() * 0.16), barW = R * (0.03 + rnd() * 0.04);
  const bulgeFrac = morph === 'lenticular' ? 0.34 + rnd() * 0.18 : 0.08 + rnd() * 0.2;
  const bulgeR = R * (0.22 + rnd() * 0.16);
  const disc = 0.03 + rnd() * 0.05;                        // thin-disc half-thickness (×R)
  const thick = disc * (2.4 + rnd() * 1.6);                // thick-disc component
  const tilt = rnd() * Math.PI, roll = rnd() * Math.PI * 2;
  const spin = rnd() < 0.5 ? 1 : -1;
  const dustLane = morph === 'spiral' && rnd() < 0.7;      // most spirals carry a lane
  const ringR = R * (0.45 + rnd() * 0.28);                 // radius of a ring, if ringed
  const glob = morph === 'irregular' ? 0 : 10 + Math.floor(rnd() * 26);   // halo globular specks
  const tidal = morph === 'irregular' && rnd() < 0.55;     // a tidal tail
  const tailDir = rnd() * Math.PI * 2, tailCurve = (rnd() - 0.5) * 2;
  // elliptical shape: triaxial axis ratios + Sérsic-ish concentration
  const ebq = 0.55 + rnd() * 0.4, ecq = 0.4 + rnd() * 0.45;   // b/a, c/a
  const boxy = rnd() * 2 - 1;                                 // -1 disky … +1 boxy
  const eSersic = 0.42 + rnd() * 0.28;

  // palette shifts with stellar age (younger ⇒ bluer & brighter arms)
  const core = lerp3([1.0, 0.9, 0.66], [1.0, 0.72, 0.42], age);
  const bulge = lerp3([1.0, 0.86, 0.58], [1.0, 0.66, 0.4], age);
  const armC = lerp3([0.56, 0.72, 1.0], [0.86, 0.82, 0.66], age);
  const hii = [0.66, 0.86, 1.0];
  const halo = lerp3([0.86, 0.62, 0.5], [0.7, 0.42, 0.38], age);
  const globC = [1.0, 0.88, 0.66];
  const irr = lerp3([0.66, 0.82, 1.0], [0.82, 0.78, 0.66], age);

  // HII / star-forming knots seeded along the arms (spirals) or scattered (irregular)
  const KN = morph === 'spiral' ? (grand ? 18 : 40) + Math.floor(rnd() * 22) : (morph === 'irregular' ? 34 : 0);
  const knots = [];
  for (let k = 0; k < KN; k++) {
    const rr = (0.22 + 0.74 * rnd()) * R;
    const arm = Math.floor(rnd() * arms) * (Math.PI * 2 / arms);
    const a = arm + spin * Math.log(rr / (R * 0.06) + 1) / pitch;
    knots.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr, s: R * (0.02 + rnd() * 0.05) });
  }
  // globular specks orbiting the halo (fixed positions, bright golden points)
  const globs = [];
  for (let k = 0; k < glob; k++) {
    const rr = (0.4 + 1.2 * rnd()) * R, u = rnd() * 2 - 1, ph = rnd() * Math.PI * 2, s = Math.sqrt(Math.max(0, 1 - u * u));
    globs.push([rr * s * Math.cos(ph), rr * s * Math.sin(ph), rr * u * 0.7]);
  }

  for (let i = 0; i < N; i++) {
    let r, a, z, c, bright = 1, sz = 0.8;
    const u = rnd();

    if (morph === 'elliptical' || morph === 'dwarf') {
      const dwarf = morph === 'dwarf';
      // Sérsic-ish radial profile; dwarves flatter & more diffuse
      r = Math.pow(rnd(), dwarf ? 0.72 : eSersic) * R * (dwarf ? 1.05 : 0.98);
      const uu = rnd() * 2 - 1, ph = rnd() * Math.PI * 2, s = Math.sqrt(Math.max(0, 1 - uu * uu));
      let x = r * s * Math.cos(ph), y = r * s * Math.sin(ph) * (dwarf ? 0.82 : ebq), zz = r * uu * (dwarf ? 0.7 : ecq);
      // boxy/disky isophote distortion
      if (!dwarf && Math.abs(boxy) > 0.05) { const m = 1 + boxy * 0.18 * Math.cos(4 * Math.atan2(y, x)); x *= m; y *= m; }
      if (dwarf) { x += (rnd() - 0.5) * R * 0.25; y += (rnd() - 0.5) * R * 0.25; }   // lumpy
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = zz;
      c = lerp3(core, halo, Math.min(1, r / R)); bright = dwarf ? 0.6 + 0.3 * rnd() : 0.7 + 0.4 * (1 - r / R);
      sz = dwarf ? 0.5 + rnd() * 0.5 : 0.6 + 0.9 * Math.max(0, 1 - r / (R * 0.4));
      // some ellipticals wear a sprinkle of globular specks
      if (!dwarf && u < 0.03 && globs.length) { const g = globs[Math.floor(rnd() * globs.length)]; pos[i * 3] = g[0]; pos[i * 3 + 1] = g[1]; pos[i * 3 + 2] = g[2]; c = globC; bright = 1.4; sz = 1.6 + rnd(); }
      col[i * 3] = c[0] * bright; col[i * 3 + 1] = c[1] * bright; col[i * 3 + 2] = c[2] * bright; siz[i] = sz;
      continue;   // already placed in 3-D; skip the disc rotation below
    }

    if (morph === 'irregular') {
      if (tidal && u < 0.18) {                              // a tidal tail streaming off
        const t = rnd(); const rr = (0.3 + 1.4 * t) * R;
        a = tailDir + tailCurve * t * 1.6; r = rr; z = (rnd() - 0.5) * R * 0.1; c = lerp3(irr, halo, t); bright = 0.7;
      } else if (u < 0.55 && knots.length) {
        const kn = knots[Math.floor(rnd() * knots.length)]; const rr = kn.s * Math.sqrt(rnd()); const ph = rnd() * Math.PI * 2;
        const x = kn.x + Math.cos(ph) * rr, y = kn.y + Math.sin(ph) * rr; r = Math.hypot(x, y); a = Math.atan2(y, x); c = hii; bright = 1.25; sz = 1.3 + rnd() * 0.8;
      } else { r = Math.pow(rnd(), 0.5) * R; a = rnd() * Math.PI * 2 + Math.sin(r * 18) * 0.7; c = irr; sz = 0.6 + rnd() * 0.6; }
      z = z ?? (rnd() - 0.5) * R * 0.18;
    } else {                                                // spiral / lenticular
      const isBulge = u < bulgeFrac + 0.06;
      if (isBulge) {
        r = Math.pow(rnd(), 1.7) * bulgeR; a = rnd() * Math.PI * 2; z = (rnd() - 0.5) * R * 0.22 * (1 - r / bulgeR);
        c = lerp3(core, bulge, Math.min(1, r / bulgeR)); bright = 1.0 + 0.3 * (1 - r / bulgeR); sz = 0.7 + 1.2 * (1 - r / bulgeR);
        if (r < R * 0.03) { bright = 1.8; sz = 2.4 + rnd() * 1.2; }     // bright nucleus
      } else if (barStr > 0 && u < bulgeFrac + 0.06 + 0.2 * barStr) {   // central bar
        const t = rnd() * 2 - 1; const bx = t * barLen, by = (rnd() - 0.5) * barW;
        r = Math.hypot(bx, by); a = Math.atan2(by, bx); z = (rnd() - 0.5) * R * 0.05; c = lerp3(core, bulge, 0.5); sz = 0.7 + rnd() * 0.6;
      } else if (morph === 'lenticular') {                  // S0: smooth featureless disc
        r = Math.pow(rnd(), 0.7) * R; a = rnd() * Math.PI * 2; z = (rnd() - 0.5) * R * thick * (1 - 0.5 * r / R);
        c = lerp3(bulge, halo, Math.min(1, r / R)); bright = 0.8 + 0.2 * rnd(); sz = 0.6 + rnd() * 0.6;
      } else if (ringed && rnd() < 0.5) {                   // a bright star-forming ring
        r = ringR + (rnd() - 0.5) * R * 0.1; a = rnd() * Math.PI * 2; z = (rnd() - 0.5) * R * disc; c = hii; bright = 1.15; sz = 1.0 + rnd() * 0.8;
      } else if (rnd() < 0.34 && knots.length) {            // an HII knot along an arm
        const kn = knots[Math.floor(rnd() * knots.length)]; const rr = kn.s * Math.sqrt(rnd()); const ph = rnd() * Math.PI * 2;
        const x = kn.x + Math.cos(ph) * rr, y = kn.y + Math.sin(ph) * rr; r = Math.hypot(x, y); a = Math.atan2(y, x); z = (rnd() - 0.5) * R * disc; c = hii; bright = 1.3; sz = 1.3 + rnd() * 0.9;
      } else {                                              // the arms — log spiral with scatter
        r = Math.pow(rnd(), 0.55) * R;
        const arm = Math.floor(rnd() * arms) * (Math.PI * 2 / arms);
        a = arm + spin * Math.log(r / (R * 0.06) + 1) / pitch + (rnd() - 0.5) * armSharp;
        // thin + occasional thick-disc star
        z = (rnd() - 0.5) * R * (rnd() < 0.2 ? thick : disc);
        c = lerp3(armC, halo, Math.max(0, r / R - 0.6) / 0.4);
        bright = 0.8 + 0.35 * rnd(); sz = 0.5 + rnd() * 0.8;
        // dust lane: dim & redden stars in the very thin midplane (reads as a dark band edge-on)
        if (dustLane && Math.abs(z) < R * disc * 0.5 && r > bulgeR * 0.6) { bright *= 0.42; c = lerp3(c, [0.5, 0.3, 0.26], 0.5); }
      }
    }

    let x = Math.cos(a) * r, y = Math.sin(a) * r;
    const xr = x * Math.cos(roll) - y * Math.sin(roll); y = x * Math.sin(roll) + y * Math.cos(roll); x = xr;
    const yt = y * Math.cos(tilt) - z * Math.sin(tilt); z = y * Math.sin(tilt) + z * Math.cos(tilt); y = yt;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    col[i * 3] = c[0] * bright; col[i * 3 + 1] = c[1] * bright; col[i * 3 + 2] = c[2] * bright;
    siz[i] = sz;
  }
  return { positions: pos, colors: col, sizes: siz };
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
