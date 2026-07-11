// The Tekné NAVCOM drive ladder — propulsion from the QTR "Immeasurable Spaces"
// canon. In that universe velocity is a function of vacuum DEPTH, not thrust: the
// Ship-Relative Speed Law grants exponentially more crossing speed each time a hull
// dives to a deeper OCT rung, and a ship's *class* is the maximum depth it can reach.
// The Sōrn drive ("the threader") drives the local region toward the seam 𝔍 until a
// phase-lock opens an Idrenes bridge (an ER=EPR throat) and rides the crossing to a
// definite elsewhere. Tekné is the Idrenes Composite — the reconfigurable Class-ω
// hull coordinated by a Solaris.Ai core, the only NAVCOM that runs this fast.
//
//   sc  = crossing speed in multiples of c (Class 0 is sub-light, β<1).
//   ptf = crew (proper) time as a fraction of coordinate time for a bridge crossing
//         — the diver's determinate-regime "offset"; deeper dives compress it more.
export const DRIVES = [
  { id: 'crawl',   cls: '0',  klass: 'Crawler',      name: 'Casimir Sailer',        jp: 'カシミール帆船',   sc: 0.1,   regime: 'sub-light',     drive: 'field-sail',       note: 'Rides a strait of favourable vacuum modes. Sub-light, no crossing — the most human ship; wind, sail and helm map straight to the crew.' },
  { id: 'rel',     cls: '0',  klass: 'Crawler',      name: 'Relativistic run',      jp: '相対論的航走',     sc: 0.994, regime: 'sub-light',     drive: 'field-sail',       note: 'Hull pushed to 0.994 c. Real Lorentz dilation — the crew badly outlives the mission clock.' },
  { id: 'bridge',  cls: 'I',  klass: 'Bridge-runner', name: 'Idrenes–Sōrn · OCT-0',  jp: 'イドレネス・ソーン機関', sc: 1e10,  ptf: 0.35, regime: 'determinate',   drive: 'Sōrn threader',    note: 'The civilized standard. Threads to the seam 𝔍 and opens an Idrenes bridge — mass-produced ≈10¹⁰c FTL, intra-universe.' },
  { id: 'unruh',   cls: 'II', klass: 'Wanderer',     name: 'Unruh Catamaran',       jp: 'ウンルー双胴船',   sc: 1e13,  ptf: 0.10, regime: 'determinate',   drive: 'thermal descent',  note: 'Twin hulls accelerate to change the vacuum they perceive, diving deeper OCT rungs. Class II — inter-universe crossings.' },
  { id: 'squeeze', cls: 'III',klass: 'Sovereign',    name: 'Squeezing Bathyscaphe', jp: '圧搾潜水艇',       sc: 1e16,  ptf: 0.02, regime: 'indeterminate', drive: 'squeezed window',  note: 'Opens the negative-energy window that discounts the seam approach. Class III — inter-pocket; the Undertow rebound debt bites hard.' },
  { id: 'tekne',   cls: 'ω',  klass: 'Solaris.Ai',   name: 'Idrenes Composite · Tekné', jp: 'イドレネス複合船・テクネー', sc: 1e20, ptf: 0.002, regime: 'seam-locked', drive: 'Solaris.Ai core',  note: "Tekné's own reconfigurable hull — Casimir sail, Unruh hull, squeezing cavity and Penrose anchor in sequence, opening a bridge with no supporting flotilla. Class ω. The only NAVCOM that runs this fast." },
];

export const DEFAULT_DRIVE = 'bridge';

export function driveById(id) { return DRIVES.find((d) => d.id === id) || DRIVES.find((d) => d.id === DEFAULT_DRIVE); }

// Snap an arbitrary crossing speed (multiples of c) to the nearest drive on the
// ladder, matched in log-space so it behaves sensibly across the huge sc range.
export function nearestDriveBySc(sc) {
  const t = Math.log10(Math.max(1e-9, sc || 0));
  let best = DRIVES[0], bd = Infinity;
  for (const d of DRIVES) { const e = Math.abs(Math.log10(d.sc) - t); if (e < bd) { bd = e; best = d; } }
  return best;
}

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sup = (n) => String(n).split('').map((c) => SUP[c] || c).join('');

// Crossing speed as a label: sub-light as "0.99 c" / "km/s", FTL as "10¹⁰ c".
export function fmtDriveSpeed(sc) {
  if (sc >= 1) {
    const e = Math.round(Math.log10(sc));
    return Math.abs(Math.pow(10, e) - sc) < sc * 0.05 ? `10${sup(e)} c` : `${(sc / Math.pow(10, e)).toFixed(1)}×10${sup(e)} c`;
  }
  if (sc >= 0.01) return `${sc.toFixed(sc < 0.1 ? 3 : 2)} c`;
  return `${Math.round(sc * 299792.458).toLocaleString('en-US')} km/s`;
}
