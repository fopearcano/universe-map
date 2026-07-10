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

// A reasonable cutout FOV (deg) for a galaxy at a given distance, assuming a
// ~30 kpc disc. Clamped to a sensible range.
export function fovForDistance(distMpc) {
  if (!distMpc || distMpc <= 0) return 0.12;
  const deg = (0.03 / distMpc) * 57.2958 * 1.6; // 30 kpc across, +margin
  return Math.max(0.03, Math.min(3.0, deg));
}

// Fetch a URL into an {data, w, h} pixel buffer via an anonymous-CORS image.
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
  return { data: d.data, w, h, url };
}

// Convenience: fetch a galaxy cutout by sky position.
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
