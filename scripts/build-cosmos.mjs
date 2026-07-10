#!/usr/bin/env node
// Build the cosmological layers of the universe map: real galaxy & quasar
// catalogues placed by redshift, spanning from the Local Group out to the CMB.
//
// Sources (fetched via curl, which honours the environment proxy; raw responses
// cached under scripts/.cache/cosmos/):
//   • 2MRS  — 2MASS Redshift Survey, ~44k all-sky galaxies      (VizieR J/ApJS/199/26)
//   • SDSS  — galaxy & quasar spectroscopic redshifts           (SkyServer DR17 SQL)
//   • Local Group — hand-curated nearby galaxies                (scripts/localgroup.mjs)
//
// Each object is stored as a unit sky-direction (equatorial, matching the star
// catalogue) plus its redshift z; the frontend converts z → comoving distance and
// places it on a logarithmic radial scale so the whole ~93-Gly-diameter observable
// universe fits one navigable scene.
//
// Outputs (public/data/):
//   cosmos-2mrs.bin, cosmos-sdss-gal.bin, cosmos-sdss-qso.bin   dir(3×f32)+z(f32)
//   cosmos-meta.json          layout, counts, cosmology, scale ladder, CMB radius
//   cosmos-localgroup.json    named nearby galaxies
//   cosmos-voyages.json       cosmic "scale ladder" voyage

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { comovingDistanceMpc, MPC_TO_LY, MPC_TO_PC, C_KM_S, H0, OMEGA_M, OMEGA_L } from './cosmology.mjs';
import { LOCAL_GROUP } from './localgroup.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'data');
const CACHE = path.join(__dirname, '.cache', 'cosmos');
const DECADE_UNIT = 3.0; // world units per factor-of-10 in distance
const CMB_Z = 1100;

function log(...a) { console.log('[build-cosmos]', ...a); }
const deg2rad = (d) => (d * Math.PI) / 180;

// direction unit vector in the equatorial frame used by the star catalogue.
function dirFromRaDec(raDeg, decDeg) {
  const ra = deg2rad(raDeg), dec = deg2rad(decDeg);
  const cd = Math.cos(dec);
  return [cd * Math.cos(ra), cd * Math.sin(ra), Math.sin(dec)];
}

function sleepSync(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

function curlCSV(url, params, cacheKey) {
  fs.mkdirSync(CACHE, { recursive: true });
  const cf = path.join(CACHE, cacheKey);
  if (fs.existsSync(cf) && fs.statSync(cf).size > 0) return fs.readFileSync(cf, 'utf8');
  const args = ['-sSL', '--max-time', '240', '--retry', '4', '--retry-delay', '3', '--retry-all-errors', '-G', url];
  for (const [k, v] of Object.entries(params)) { args.push('--data-urlencode', `${k}=${v}`); }
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const out = execFileSync('curl', args, { maxBuffer: 512 * 1024 * 1024 }).toString('utf8');
      if (out && out.length > 20) { fs.writeFileSync(cf, out); return out; }
      lastErr = new Error('empty response');
    } catch (e) { lastErr = e; }
    sleepSync(2000 * attempt);
  }
  throw lastErr;
}

// Parse CSV, skipping SkyServer '#'-prefixed lines; returns array of column arrays by header.
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l && !l.startsWith('#'));
  if (!lines.length) return { header: [], rows: [] };
  const header = lines[0].split(',').map((s) => s.trim().toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const f = lines[i].split(',');
    if (f.length < header.length) continue;
    rows.push(f);
  }
  return { header, rows };
}

// ---- 2MRS (all-sky galaxies) ----
function fetch2MRS() {
  const text = curlCSV('https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync', {
    request: 'doQuery', lang: 'ADQL', format: 'csv',
    query: 'SELECT RAJ2000,DEJ2000,cz FROM "J/ApJS/199/26/table3" WHERE cz>0',
  }, '2mrs.csv');
  const { header, rows } = parseCSV(text);
  const ir = header.indexOf('raj2000'), id = header.indexOf('dej2000'), ic = header.indexOf('cz');
  const objs = [];
  for (const f of rows) {
    const ra = +f[ir], dec = +f[id], cz = +f[ic];
    if (!Number.isFinite(ra) || !Number.isFinite(dec) || !(cz > 0)) continue;
    const z = cz / C_KM_S;
    if (z > 0.12) continue; // 2MRS is a local survey; drop stragglers
    objs.push([...dirFromRaDec(ra, dec), z]);
  }
  log('2MRS galaxies:', objs.length);
  return objs;
}

// ---- SDSS spectroscopic sample, fetched in redshift slices ----
function fetchSDSS(cls, slices, tag) {
  const objs = [];
  for (const [zlo, zhi, top] of slices) {
    let text;
    try {
      const cmd =
        `SELECT TOP ${top} ra,dec,z FROM SpecObj ` +
        `WHERE class='${cls}' AND zWarning=0 AND z BETWEEN ${zlo} AND ${zhi}`;
      text = curlCSV('https://skyserver.sdss.org/dr17/SkyServerWS/SearchTools/SqlSearch',
        { cmd, format: 'csv' }, `sdss-${tag}-${zlo}-${zhi}.csv`);
    } catch (e) {
      log(`SDSS ${tag} z[${zlo},${zhi}]: FAILED (${e.message.split('\n')[0]}) — skipping`);
      continue;
    }
    const { header, rows } = parseCSV(text);
    const ir = header.indexOf('ra'), id = header.indexOf('dec'), iz = header.indexOf('z');
    let n = 0;
    for (const f of rows) {
      const ra = +f[ir], dec = +f[id], z = +f[iz];
      if (!Number.isFinite(ra) || !Number.isFinite(dec) || !(z > 0)) continue;
      objs.push([...dirFromRaDec(ra, dec), z]); n++;
    }
    log(`SDSS ${tag} z[${zlo},${zhi}]:`, n);
    sleepSync(800); // be gentle between requests
  }
  return objs;
}

function writeLayer(name, objs) {
  const N = objs.length;
  const buf = Buffer.alloc(N * 16);
  const f32 = new Float32Array(buf.buffer, buf.byteOffset, N * 4);
  let zmin = Infinity, zmax = -Infinity;
  for (let i = 0; i < N; i++) {
    f32[i * 4] = objs[i][0]; f32[i * 4 + 1] = objs[i][1]; f32[i * 4 + 2] = objs[i][2]; f32[i * 4 + 3] = objs[i][3];
    if (objs[i][3] < zmin) zmin = objs[i][3];
    if (objs[i][3] > zmax) zmax = objs[i][3];
  }
  fs.writeFileSync(path.join(OUT, name), buf);
  log('wrote', name, (buf.length / 1e6).toFixed(2), 'MB');
  return { file: name, count: N, zmin, zmax, stride: 16, layout: 'dir3_f32 + z_f32' };
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const twomrs = fetch2MRS();
  const sdssGal = fetchSDSS('GALAXY', [
    [0.02, 0.05, 45000], [0.05, 0.08, 30000], [0.08, 0.11, 28000], [0.11, 0.15, 24000],
    [0.15, 0.20, 20000], [0.20, 0.28, 16000], [0.28, 0.40, 12000], [0.40, 0.55, 8000], [0.55, 0.75, 6000],
  ], 'gal');
  const sdssQso = fetchSDSS('QSO', [
    [0.30, 0.70, 16000], [0.70, 1.10, 18000], [1.10, 1.60, 18000], [1.60, 2.20, 18000],
    [2.20, 2.80, 12000], [2.80, 3.60, 8000], [3.60, 5.50, 5000],
  ], 'qso');

  const layers = {
    twomrs: writeLayer('cosmos-2mrs.bin', twomrs),
    sdssGal: writeLayer('cosmos-sdss-gal.bin', sdssGal),
    sdssQso: writeLayer('cosmos-sdss-qso.bin', sdssQso),
  };

  // Local Group (distance-based, not redshift) — precompute display radius.
  const localGroup = LOCAL_GROUP.map((g) => ({
    ...g,
    dir: dirFromRaDec(g.ra, g.dec),
    displayR: DECADE_UNIT * Math.log10(g.distMpc * MPC_TO_PC),
    distLy: g.distMpc * MPC_TO_LY,
  }));
  fs.writeFileSync(path.join(OUT, 'cosmos-localgroup.json'), JSON.stringify(localGroup));
  log('wrote cosmos-localgroup.json', localGroup.length, 'galaxies');

  // Scale ladder rings: powers-of-ten distances with a human label.
  const decades = [
    [1e3, '1 kly'], [1e4, '10 kly'], [1e5, '100 kly'], [1e6, '1 Mly'], [1e7, '10 Mly'],
    [1e8, '100 Mly'], [1e9, '1 Gly'], [1e10, '10 Gly'],
  ].map(([ly, label]) => ({ ly, pc: ly / 3.2615638, label, displayR: DECADE_UNIT * Math.log10(ly / 3.2615638) }));

  const cmbDcMpc = comovingDistanceMpc(CMB_Z);
  const meta = {
    decadeUnit: DECADE_UNIT,
    cosmology: { H0, OmegaM: OMEGA_M, OmegaL: OMEGA_L, model: 'flat ΛCDM (Planck 2018)' },
    layers,
    cmb: {
      z: CMB_Z,
      comovingMpc: cmbDcMpc,
      radiusLy: cmbDcMpc * MPC_TO_LY,
      displayR: DECADE_UNIT * Math.log10(cmbDcMpc * MPC_TO_PC),
      diameterGly: (2 * cmbDcMpc * MPC_TO_LY) / 1e9,
    },
    decades,
    mpcToLy: MPC_TO_LY,
  };
  fs.writeFileSync(path.join(OUT, 'cosmos-meta.json'), JSON.stringify(meta));
  log('wrote cosmos-meta.json · CMB shell at', (cmbDcMpc * MPC_TO_LY / 1e9).toFixed(1), 'Gly, displayR', meta.cmb.displayR.toFixed(2));

  // Cosmic "scale ladder" voyage — zoom from the Sun to the edge of the universe.
  const rOf = (distLy) => (distLy <= 0 ? 0 : DECADE_UNIT * Math.log10(distLy / 3.2615638));
  const stop = (label, distLy, zMax, narrative) => ({ label, distLy, displayR: rOf(distLy), zMax, narrative });
  const voyage = {
    id: 'to-the-edge', title: 'To the Edge of the Universe', kind: 'scale',
    subtitle: 'A zoom out through every scale, from the Sun to the cosmic horizon',
    intro: 'The observable universe spans ~93 billion light-years, yet on this logarithmic map it fits one view. This voyage pulls back one power of ten at a time — star, galaxy, supercluster, cosmic web, and finally the microwave glow of the Big Bang itself.',
    stops: [
      stop('The Sun', 0, 0, 'Home. Every shell on this map is centred here — not because we are special, but because this is where we look from.'),
      stop('The stars', 1000, 0, 'The nearest thousand light-years: the naked-eye stars, all inside one spiral arm of one galaxy.'),
      stop('The Milky Way', 1e5, 0, 'Pull back to 100,000 light-years and the whole galaxy — 100+ billion stars — is a single disc.'),
      stop('The Local Group', 3e6, 0.004, 'Andromeda, Triangulum and dozens of dwarfs — our galactic neighbourhood, a few million light-years across.'),
      stop('The Local Supercluster', 1e8, 0.04, 'The nearest galaxies from 2MRS trace the Virgo Cluster and the sheets threading the local universe.'),
      stop('The cosmic web', 2e9, 0.35, 'Billions of light-years out, SDSS galaxies trace filaments and voids — the largest structures that exist.'),
      stop('The age of quasars', 1.5e10, 4.0, 'Farther still we see only the brightest beacons: quasars, the blazing cores of young galaxies, their light billions of years old.'),
      stop('The cosmic horizon', meta.cmb.radiusLy, 6, 'The final shell is the cosmic microwave background at z≈1100 — the oldest light there is, released 380,000 years after the Big Bang. Beyond it lies the unobservable.'),
    ],
  };
  fs.writeFileSync(path.join(OUT, 'cosmos-voyages.json'), JSON.stringify([voyage]));
  log('wrote cosmos-voyages.json');

  const total = layers.twomrs.count + layers.sdssGal.count + layers.sdssQso.count;
  log('DONE. cosmological objects:', total, `(2MRS ${layers.twomrs.count}, SDSS gal ${layers.sdssGal.count}, QSO ${layers.sdssQso.count})`);
}

main();
