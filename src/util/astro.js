// Astronomical conversions & formatting. Catalog positions are equatorial
// Cartesian (J2000) in parsecs with Sol at the origin: +x -> (RA 0h, Dec 0°),
// +y -> (RA 6h, Dec 0°), +z -> Dec +90° (north celestial pole).

export const PC_TO_LY = 3.261563777;
export const SUN_ABSMAG = 4.83;

export function cartesianToRaDec(x, y, z) {
  const r = Math.hypot(x, y, z);
  if (r === 0) return { ra: 0, dec: 0, r: 0 };
  const dec = Math.asin(z / r) * 180 / Math.PI;
  let raDeg = Math.atan2(y, x) * 180 / Math.PI;
  if (raDeg < 0) raDeg += 360;
  return { ra: raDeg / 15, dec, r }; // ra in hours
}

export function fmtRA(hours) {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  const s = Math.round(((hours - h) * 60 - m) * 60);
  return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

export function fmtDec(deg) {
  const sign = deg < 0 ? '−' : '+';
  const a = Math.abs(deg);
  const d = Math.floor(a);
  const m = Math.floor((a - d) * 60);
  const s = Math.round(((a - d) * 60 - m) * 60);
  return `${sign}${pad(d)}° ${pad(m)}′ ${pad(s)}″`;
}

// Luminosity in solar units from absolute (visual) magnitude.
export function luminosity(absmag) {
  return Math.pow(10, 0.4 * (SUN_ABSMAG - absmag));
}

export function fmtDist(pc) {
  const ly = pc * PC_TO_LY;
  if (ly < 0.05) return '0 ly';
  if (ly < 1000) return `${ly.toFixed(ly < 10 ? 2 : 1)} ly`;
  return `${(ly / 1000).toFixed(2)}k ly`;
}

export function fmtLum(l) {
  if (l >= 1000) return `${(l / 1000).toFixed(1)}k L☉`;
  if (l >= 1) return `${l.toFixed(l < 10 ? 2 : 0)} L☉`;
  if (l >= 0.001) return `${l.toFixed(4)} L☉`;
  return `${l.toExponential(1)} L☉`;
}

export function fmtNum(n, d = 0) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function pad(n) { return String(n).padStart(2, '0'); }
