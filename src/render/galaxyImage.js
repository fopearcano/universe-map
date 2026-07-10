// Real galaxy imagery → point clouds.
//
// We pull rendered sky cutouts from CDS hips2fits (HiPS surveys: DSS2 all-sky,
// SDSS9 where available, 2MASS, …). The service is CORS-enabled
// (access-control-allow-origin: *), so a browser can fetch a PNG for any
// RA/Dec/FOV and read its pixels. `imageToCloud` then samples a 3-D star cloud
// whose density and colour follow the actual image — so a galaxy's illustrative
// cloud *reflects* its real light distribution (arms, bar, bulge), and you can
// fly inside it.
import { mulberry } from './morphology.js';

const HIPS2FITS = 'https://alasky.u-strasbg.fr/hips-image-services/hips2fits';

// Build a cutout URL. survey is a HiPS id; DSS2 colour is all-sky.
export function cutoutURL(ra, dec, fovDeg, { survey = 'CDS/P/DSS2/color', size = 384 } = {}) {
  const q = new URLSearchParams({
    hips: survey, width: size, height: size, fov: fovDeg,
    projection: 'TAN', coordsys: 'icrs', ra, dec, format: 'png',
  });
  return `${HIPS2FITS}?${q.toString()}`;
}

// Curated physical diameters (kpc, ~D25) for well-known galaxies, matched by a
// substring of the object name. Order: more specific first.
const GALAXY_KPC = [
  ['andromeda', 46], ['m31', 46], ['triangulum', 19], ['m33', 19],
  ['large magellanic', 9.9], ['lmc', 9.9], ['small magellanic', 5], ['smc', 5],
  ['whirlpool', 23], ['m51', 23], ['sombrero', 15], ['m104', 15],
  ['pinwheel', 52], ['m101', 52], ['sunflower', 30], ['m63', 30],
  ['black eye', 16], ['m64', 16], ['cigar', 12], ['m82', 12], ['bode', 29], ['m81', 29],
  ['centaurus a', 30], ['sculptor', 8], ['ngc 253', 27], ['ngc 300', 12],
  ['m87', 40], ['virgo a', 40], ['cartwheel', 44], ['tadpole', 85],
  ['fornax', 6], ['leo', 3], ['wlm', 3], ['ic 10', 2], ['ngc 6822', 3], ['sagittarius dwarf', 3],
  ['milky way', 30],
];

// Best physical diameter (kpc) for a galaxy: curated by name, else by type.
export function diameterKpcFor(info = {}) {
  const n = String(info.name || '').toLowerCase();
  for (const [k, v] of GALAXY_KPC) if (n.includes(k)) return v;
  const t = String(info.type || info.sub || '').toLowerCase();
  if (/dwarf|dsph|\bsm\b|magellanic|irr/.test(t)) return 7;
  if (/ellipt|lenticular|\bcd\b|\be\d|\bs0\b/.test(t)) return 38;
  if (/spiral|\bs[abc]|barred|grand-design|flocculent/.test(t)) return 30;
  return 26;
}

// Cutout FOV (deg) framing a galaxy of the given physical diameter at a distance.
export function fovForGalaxy(distMpc, diameterKpc = 30) {
  if (!distMpc || distMpc <= 0) return 0.15;
  const deg = ((diameterKpc / 1000) / distMpc) * 57.2958 * 1.5; // physical/dist → angular, +margin
  return Math.max(0.02, Math.min(3.0, deg));
}
export function fovForDistance(distMpc) { return fovForGalaxy(distMpc, 30); }

// Fetch a URL into an {data, w, h, canvas} pixel buffer via an anonymous-CORS image.
export async function loadImageData(url, { timeout = 12000 } = {}) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  const loaded = new Promise((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('image load failed')); });
  img.src = url;
  let to;
  const timer = new Promise((_, rej) => { to = setTimeout(() => rej(new Error('timeout')), timeout); });
  try { await Promise.race([loaded, timer]); } finally { clearTimeout(to); }
  const w = img.naturalWidth || 384, h = img.naturalHeight || 384;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h);
  return { data: d.data, w, h, url, canvas: cv };
}

// Fraction of pixels that carry actual sky coverage (opaque + non-black). HiPS
// tiles outside a survey's footprint come back fully transparent, so this cleanly
// separates "in footprint" from "not covered".
export function coveredFraction(imgData) {
  const d = imgData.data, N = imgData.w * imgData.h;
  let covered = 0;
  for (let p = 0; p < N; p++) {
    const a = d[p * 4 + 3];
    if (a > 24 && (d[p * 4] + d[p * 4 + 1] + d[p * 4 + 2]) > 12) covered++;
  }
  return covered / N;
}

// The default survey preference: SDSS colour (sharp) where covered, DSS2 all-sky
// everywhere else.
export const DEFAULT_SURVEYS = ['CDS/P/SDSS9/color', 'CDS/P/DSS2/color'];

// Fetch a cutout, auto-selecting the sharpest survey that actually covers the
// position. Tries each survey in order; the first with enough real coverage wins,
// otherwise the last (all-sky DSS2) is used. Returns { imgData, survey }.
export async function pickSurveyImage(raDeg, dec, fovDeg, { surveys = DEFAULT_SURVEYS, size = 384, minCover = 0.12, timeout = 12000 } = {}) {
  let last = null;
  for (let i = 0; i < surveys.length; i++) {
    const survey = surveys[i];
    try {
      const imgData = await loadImageData(cutoutURL(raDeg, dec, fovDeg, { survey, size }), { timeout });
      last = { imgData, survey };
      if (i === surveys.length - 1) return last;         // last option: take it as-is
      if (coveredFraction(imgData) >= minCover) return last; // covered → sharpest wins
    } catch (e) { /* try the next survey */ }
  }
  if (last) return last;
  throw new Error('no survey returned an image');
}

// Convenience: fetch a galaxy cutout by sky position (single survey).
export async function fetchGalaxyImage(ra, dec, distMpc, opts = {}) {
  const fov = opts.fovDeg || fovForDistance(distMpc);
  return loadImageData(cutoutURL(ra, dec, fov, opts), opts);
}

// Sample a point cloud whose density follows image luminance and whose colour
// follows the image. Returns { positions, colors, count } centred at the origin,
// lying in the XY plane with a little Z thickness (bulge thicker than disc).
//   R         : half-extent of the cloud (world units)
//   thickness : disc half-thickness as a fraction of R
export function imageToCloud(img, { count = 80000, R = 1, thickness = 0.06, seed = 1234, bg = 0.05, gamma = 0.8 } = {}) {
  const { data, w, h } = img;
  const NP = w * h;
  // luminance CDF (background-subtracted, contrast-shaped)
  const cum = new Float64Array(NP);
  let total = 0;
  for (let p = 0; p < NP; p++) {
    const r = data[p * 4], g = data[p * 4 + 1], b = data[p * 4 + 2];
    let lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    lum = lum <= bg ? 0 : (lum - bg) / (1 - bg);
    lum = Math.pow(lum, 1 + gamma); // emphasise bright structure
    total += lum; cum[p] = total;
  }
  const rnd = mulberry(seed | 0);
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
  if (total <= 0) return { positions: pos.subarray(0, 0), colors: col.subarray(0, 0), count: 0 };
  let k = 0;
  for (let i = 0; i < count; i++) {
    const t = rnd() * total;
    let lo = 0, hi = NP - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < t) lo = m + 1; else hi = m; }
    const p = lo, px = p % w, py = (p / w) | 0;
    const r = data[p * 4], g = data[p * 4 + 1], b = data[p * 4 + 2];
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const u = ((px + rnd()) / w - 0.5) * 2 * R;
    const v = (0.5 - (py + rnd()) / h) * 2 * R;          // flip image Y → +Y up
    const zt = (rnd() - 0.5) * thickness * R * (0.35 + lum * 1.8); // bright = thicker
    pos[k * 3] = u; pos[k * 3 + 1] = v; pos[k * 3 + 2] = zt;
    col[k * 3] = Math.min(1, r / 255 * 1.18); col[k * 3 + 1] = Math.min(1, g / 255 * 1.14); col[k * 3 + 2] = Math.min(1, b / 255 * 1.2);
    k++;
  }
  return { positions: pos, colors: col, count: k };
}
