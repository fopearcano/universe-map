#!/usr/bin/env node
// Reproject the real WMAP 9-year ILC cosmic-microwave-background map onto an
// equirectangular texture for the COSMOS-mode boundary shell.
//
// The source (NASA LAMBDA) is a HEALPix FITS map: Nside 512, NESTED ordering,
// galactic coordinates, temperatures as big-endian float32. For every pixel of
// the output image we take its equatorial (RA/Dec) direction, rotate it into
// galactic coordinates, find the HEALPix pixel with ang2pix_nest, and colour it
// with a diverging CMB palette. Output: public/data/cmb.png (dependency-free PNG).
//
// Usage: node scripts/build-cmb.mjs   (downloads + caches the 25 MB FITS)

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import https from 'node:https';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'public', 'data');
const CACHE = path.join(__dirname, '.cache', 'wmap_ilc_9yr_v5.fits');
const FITS_URL = 'https://lambda.gsfc.nasa.gov/data/map/dr5/dfp/ilc/wmap_ilc_9yr_v5.fits';
const NSIDE = 512, ORDER = 9, NPIX = 12 * NSIDE * NSIDE;
const DATA_OFFSET = 5760, ROW_BYTES = 8; // temperature float32 at row start
const W = 1024, H = 512;

const log = (...a) => console.log('[build-cmb]', ...a);

// ---- equatorial (J2000) -> galactic rotation matrix ----
const A_G = [
  [-0.0548755604162154, -0.8734370902348850, -0.4838350155487132],
  [0.4941094278755837, -0.4448296299600112, 0.7469822444972189],
  [-0.8676661490190047, -0.1980763734312015, 0.4559837761750669],
];

// ---- HEALPix NESTED ang2pix ----
function spread(v) {
  v &= 0xffff;
  v = (v ^ (v << 8)) & 0x00ff00ff;
  v = (v ^ (v << 4)) & 0x0f0f0f0f;
  v = (v ^ (v << 2)) & 0x33333333;
  v = (v ^ (v << 1)) & 0x55555555;
  return v >>> 0;
}
function xyf2nest(ix, iy, face) {
  return face * NSIDE * NSIDE + (spread(ix) | (spread(iy) << 1));
}
function ang2pixNest(theta, phi) {
  const z = Math.cos(theta), za = Math.abs(z);
  let tt = ((phi * (2 / Math.PI)) % 4 + 4) % 4; // [0,4)
  let ix, iy, face;
  if (za <= 2 / 3) {
    const temp1 = NSIDE * (0.5 + tt), temp2 = NSIDE * (z * 0.75);
    const jp = Math.floor(temp1 - temp2), jm = Math.floor(temp1 + temp2);
    const ifp = jp >> ORDER, ifm = jm >> ORDER;
    face = ifp === ifm ? (ifp & 3) + 4 : ifp < ifm ? ifp & 3 : (ifm & 3) + 8;
    ix = jm & (NSIDE - 1);
    iy = NSIDE - (jp & (NSIDE - 1)) - 1;
  } else {
    const ntt = Math.min(3, Math.floor(tt));
    const tp = tt - ntt, tmp = NSIDE * Math.sqrt(3 * (1 - za));
    let jp = Math.floor(tp * tmp), jm = Math.floor((1 - tp) * tmp);
    if (jp >= NSIDE) jp = NSIDE - 1;
    if (jm >= NSIDE) jm = NSIDE - 1;
    if (z >= 0) { face = ntt; ix = NSIDE - jm - 1; iy = NSIDE - jp - 1; }
    else { face = ntt + 8; ix = jp; iy = jm; }
  }
  return xyf2nest(ix, iy, face);
}

// ---- diverging CMB palette ----
const STOPS = [
  [0.0, [0, 0, 80]], [0.25, [0, 110, 255]], [0.5, [235, 235, 235]],
  [0.75, [255, 120, 0]], [1.0, [130, 0, 0]],
];
function palette(t) {
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i], k = (t - a) / (b - a);
      return [ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

// ---- minimal RGB PNG encoder ----
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(buf) { let c = ~0; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (~c) >>> 0; }
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgb) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit, colour type 2 (RGB)
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) { raw[y * (stride + 1)] = 0; rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    try { execFileSync('curl', ['-sSL', '--max-time', '180', '-o', dest, url]); resolve(dest); }
    catch (e) { reject(e); }
  });
}

async function main() {
  if (!fs.existsSync(CACHE)) { log('downloading WMAP ILC 9yr map (~25 MB)…'); fs.mkdirSync(path.dirname(CACHE), { recursive: true }); await download(FITS_URL, CACHE); }
  const fd = fs.readFileSync(CACHE);
  log('reading', NPIX.toLocaleString(), 'HEALPix pixels');
  const temp = new Float32Array(NPIX);
  for (let i = 0; i < NPIX; i++) temp[i] = fd.readFloatBE(DATA_OFFSET + i * ROW_BYTES);

  // robust normalisation range (percentiles from a subsample)
  const sample = [];
  for (let i = 0; i < NPIX; i += 37) sample.push(temp[i]);
  sample.sort((a, b) => a - b);
  const pc = (p) => sample[Math.floor(p * (sample.length - 1))];
  const lo = pc(0.005), hi = pc(0.995), mid = pc(0.5), half = Math.max(hi - mid, mid - lo) || 1;
  log(`temperature range mK: p0.5=${lo.toFixed(3)} median=${mid.toFixed(3)} p99.5=${hi.toFixed(3)}`);

  const rgb = Buffer.alloc(W * H * 3);
  const deg = Math.PI / 180;
  for (let y = 0; y < H; y++) {
    const dec = (90 - ((y + 0.5) / H) * 180) * deg;
    const cd = Math.cos(dec), sd = Math.sin(dec);
    for (let x = 0; x < W; x++) {
      const ra = (((x + 0.5) / W) + 0.5) * 360 % 360 * deg; // see derivation in cosmos.js
      // equatorial unit vector
      const ex = cd * Math.cos(ra), ey = cd * Math.sin(ra), ez = sd;
      // rotate to galactic
      const gx = A_G[0][0] * ex + A_G[0][1] * ey + A_G[0][2] * ez;
      const gy = A_G[1][0] * ex + A_G[1][1] * ey + A_G[1][2] * ez;
      const gz = A_G[2][0] * ex + A_G[2][1] * ey + A_G[2][2] * ez;
      let phi = Math.atan2(gy, gx); if (phi < 0) phi += 2 * Math.PI;
      const theta = Math.acos(Math.max(-1, Math.min(1, gz)));
      const v = temp[ang2pixNest(theta, phi)];
      const [r, g, b] = palette((v - mid) / (2 * half) + 0.5);
      const o = (y * W + x) * 3;
      rgb[o] = r; rgb[o + 1] = g; rgb[o + 2] = b;
    }
  }
  fs.mkdirSync(OUT, { recursive: true });
  const png = encodePNG(W, H, rgb);
  fs.writeFileSync(path.join(OUT, 'cmb.png'), png);
  log('wrote public/data/cmb.png', (png.length / 1e6).toFixed(2), 'MB', `(${W}×${H})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
