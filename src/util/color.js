// Star colour from the B-V colour index.
//
// Step 1 — effective temperature via Ballesteros' formula:
//   T = 4600 K * ( 1/(0.92*BV + 1.7) + 1/(0.92*BV + 0.62) )
// Step 2 — approximate blackbody temperature -> RGB (after Tanner Helland).

export function tempFromBV(bv) {
  const b = 0.92 * bv;
  return 4600 * (1 / (b + 1.7) + 1 / (b + 0.62));
}

export function tempToRGB(kelvin) {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100;
  let r, g, b;
  // red
  if (t <= 66) r = 255;
  else r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
  // green
  if (t <= 66) g = 99.4708025861 * Math.log(t) - 161.1195681661;
  else g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  // blue
  if (t >= 66) b = 255;
  else if (t <= 19) b = 0;
  else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [clamp01(r / 255), clamp01(g / 255), clamp01(b / 255)];
}

export function bvToRGB(bv) {
  return tempToRGB(tempFromBV(bv));
}

// Slightly lift saturation/brightness so dim stars still read as coloured points.
export function bvToDisplayRGB(bv) {
  const [r, g, b] = bvToRGB(bv);
  const lift = 0.35; // pull toward white a touch for visibility
  return [r + (1 - r) * lift, g + (1 - g) * lift, b + (1 - b) * lift];
}

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

// Broad spectral class -> label + representative swatch (fallback when B-V missing).
export const SPECTRAL_CLASSES = [
  { key: 'O', label: 'O · blue',        temp: '≥ 30,000 K', color: '#9bb4ff' },
  { key: 'B', label: 'B · blue-white',  temp: '10–30k K',   color: '#aac6ff' },
  { key: 'A', label: 'A · white',       temp: '7.5–10k K',  color: '#e4ecff' },
  { key: 'F', label: 'F · yellow-white',temp: '6–7.5k K',   color: '#fbfae8' },
  { key: 'G', label: 'G · yellow',      temp: '5.2–6k K',   color: '#ffed9e' },
  { key: 'K', label: 'K · orange',      temp: '3.7–5.2k K', color: '#ffc07a' },
  { key: 'M', label: 'M · red',         temp: '≤ 3,700 K',  color: '#ff8a63' },
];

export function spectralClassOf(spect) {
  if (!spect) return '?';
  const c = spect.trim()[0].toUpperCase();
  return 'OBAFGKM'.includes(c) ? c : (['W', 'L', 'T', 'Y', 'C', 'S', 'D'].includes(c) ? c : '?');
}
