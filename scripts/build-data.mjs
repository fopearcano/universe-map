#!/usr/bin/env node
// Preprocess the HYG v4.1 star catalog into compact binary + JSON assets for the
// universe map. Downloads the CSV on first run (cached), filters to a navigable
// ~100k-star working set (always keeping named / nearby / catalogued stars),
// resolves the voyage waypoints against real catalog coordinates, and writes:
//   public/data/stars.bin        struct-of-arrays: positions, mag, absmag, ci, hip, hd, con
//   public/data/stars-meta.json  layout, constellation table, bounds, counts
//   public/data/stars-spect.txt  index-aligned spectral type strings
//   public/data/search.json      searchable index of named / bright stars
//   public/data/labels.json      always-on HUD labels for the brightest named stars
//   public/data/voyages.json     voyages with waypoints resolved to star indices
//
// Usage: node scripts/build-data.mjs [path-to-hygdata.csv]

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import { CONSTELLATIONS } from './constellations.mjs';
import { VOYAGES } from './voyages.source.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'data');
const CSV_URL =
  'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv';
const CACHE = path.join(__dirname, '.cache', 'hygdata_v41.csv');
const TARGET = 100000; // navigable working-set size ("initial db range of 100,000 elements")
const PC_TO_LY = 3.261563777;

function log(...a) { console.log('[build-data]', ...a); }

function download(url, dest) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const file = fs.createWriteStream(dest);
    const req = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(); fs.rmSync(dest, { force: true });
        return download(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(dest)));
    });
    req.on('error', (e) => { fs.rmSync(dest, { force: true }); reject(e); });
  });
}

// Minimal RFC-4180-ish CSV line splitter (handles quoted fields with commas).
function splitCSV(line) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

async function main() {
  const csvArg = process.argv[2];
  let csvPath = csvArg && fs.existsSync(csvArg) ? csvArg : CACHE;
  if (!fs.existsSync(csvPath)) {
    log('catalog not cached; downloading HYG v4.1 (~34 MB)…');
    await download(CSV_URL, CACHE);
    csvPath = CACHE;
  }
  log('reading', csvPath);
  const text = fs.readFileSync(csvPath, 'utf8');
  const lines = text.split(/\r?\n/);
  const header = splitCSV(lines[0]);
  const col = Object.fromEntries(header.map((h, i) => [h.replace(/"/g, ''), i]));
  const need = ['id', 'hip', 'hd', 'gl', 'bf', 'proper', 'dist', 'mag', 'absmag', 'spect', 'ci', 'x', 'y', 'z', 'con', 'lum'];
  for (const n of need) if (!(n in col)) throw new Error('missing column: ' + n);

  // ---- parse ----
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const f = splitCSV(line);
    const id = +f[col.id];
    const dist = +f[col.dist];
    const x = +f[col.x], y = +f[col.y], z = +f[col.z];
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    // Drop the HYG "no parallax" sentinel (dist == 100000) — those stars have no
    // real position. Keep Sol (id 0, dist 0).
    if (id !== 0 && (!(dist > 0) || dist >= 100000)) continue;
    rows.push({
      id,
      hip: f[col.hip] ? +f[col.hip] : -1,
      hd: f[col.hd] ? +f[col.hd] : -1,
      gl: f[col.gl] || '',
      bf: f[col.bf] || '',
      proper: f[col.proper] || '',
      dist,
      mag: f[col.mag] !== '' ? +f[col.mag] : 15,
      absmag: f[col.absmag] !== '' ? +f[col.absmag] : 15,
      spect: (f[col.spect] || '').trim(),
      ci: f[col.ci] !== '' ? +f[col.ci] : 0.6,
      x, y, z,
      con: (f[col.con] || '').trim(),
      lum: f[col.lum] !== '' ? +f[col.lum] : 0,
    });
  }
  log('valid stars parsed:', rows.length);

  // ---- select working set: keep all "important" stars, fill rest by brightness ----
  const importantIdx = new Set();
  const nearbyPc = 25; // ~81 ly
  rows.forEach((r, i) => {
    if (r.id === 0 || r.proper || r.bf || r.gl || r.dist <= nearbyPc) importantIdx.add(i);
  });
  let selected;
  if (rows.length <= TARGET) {
    selected = rows.map((_, i) => i);
  } else {
    const rest = [];
    rows.forEach((_, i) => { if (!importantIdx.has(i)) rest.push(i); });
    rest.sort((a, b) => rows[a].mag - rows[b].mag); // brightest first
    selected = [...importantIdx];
    for (const i of rest) { if (selected.length >= TARGET) break; selected.push(i); }
  }
  // Ensure Sol is index 0 for a stable origin reference.
  selected.sort((a, b) => (rows[a].id === 0 ? -1 : rows[b].id === 0 ? 1 : 0));
  const stars = selected.map((i) => rows[i]);
  const N = stars.length;
  log('working set:', N, `(important=${importantIdx.size}, target=${TARGET})`);

  // ---- constellation table ----
  const conIndex = {}; const conList = [];
  for (const s of stars) {
    if (s.con && !(s.con in conIndex)) { conIndex[s.con] = conList.length; conList.push(s.con); }
  }
  if (conList.length > 254) throw new Error('too many constellations for Uint8');
  const CON_NONE = 255;

  // ---- typed arrays (struct of arrays) ----
  const positions = new Float32Array(N * 3);
  const mag = new Float32Array(N);
  const absmag = new Float32Array(N);
  const ci = new Float32Array(N);
  const hip = new Int32Array(N);
  const hd = new Int32Array(N);
  const con = new Uint8Array(N);
  let maxR = 0, magMin = Infinity, magMax = -Infinity;
  for (let i = 0; i < N; i++) {
    const s = stars[i];
    positions[i * 3] = s.x; positions[i * 3 + 1] = s.y; positions[i * 3 + 2] = s.z;
    mag[i] = s.mag; absmag[i] = s.absmag; ci[i] = s.ci;
    hip[i] = s.hip; hd[i] = s.hd;
    con[i] = s.con in conIndex ? conIndex[s.con] : CON_NONE;
    const r = Math.hypot(s.x, s.y, s.z);
    if (r > maxR) maxR = r;
    if (s.mag < magMin) magMin = s.mag;
    if (s.mag > magMax) magMax = s.mag;
  }

  // ---- pack into one buffer: [pos f32*3N][mag f32*N][absmag f32*N][ci f32*N][hip i32*N][hd i32*N][con u8*N] ----
  const layout = {};
  let off = 0;
  const put = (name, bytes) => { layout[name] = { offset: off, bytes }; off += bytes; };
  put('positions', N * 3 * 4);
  put('mag', N * 4);
  put('absmag', N * 4);
  put('ci', N * 4);
  put('hip', N * 4);
  put('hd', N * 4);
  put('con', N * 1);
  const buf = Buffer.alloc(off);
  Buffer.from(positions.buffer).copy(buf, layout.positions.offset);
  Buffer.from(mag.buffer).copy(buf, layout.mag.offset);
  Buffer.from(absmag.buffer).copy(buf, layout.absmag.offset);
  Buffer.from(ci.buffer).copy(buf, layout.ci.offset);
  Buffer.from(hip.buffer).copy(buf, layout.hip.offset);
  Buffer.from(hd.buffer).copy(buf, layout.hd.offset);
  Buffer.from(con.buffer).copy(buf, layout.con.offset);

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'stars.bin'), buf);
  log('wrote stars.bin', (buf.length / 1e6).toFixed(2), 'MB');

  // ---- meta ----
  const meta = {
    count: N,
    generatedFrom: 'HYG v4.1 (astronexus/HYG-Database)',
    units: { positions: 'parsecs (equatorial J2000, Sol at origin)' },
    pcToLy: PC_TO_LY,
    layout,
    bounds: { maxRadiusPc: maxR },
    magRange: [magMin, magMax],
    constellations: conList.map((abbr) => [abbr, CONSTELLATIONS[abbr] || abbr]),
    conNone: CON_NONE,
  };
  fs.writeFileSync(path.join(OUT, 'stars-meta.json'), JSON.stringify(meta));
  log('wrote stars-meta.json');

  // ---- spectral strings (index-aligned, newline separated) ----
  fs.writeFileSync(path.join(OUT, 'stars-spect.txt'), stars.map((s) => s.spect).join('\n'));
  log('wrote stars-spect.txt');

  // ---- search index: named / Bayer-Flamsteed / naked-eye stars ----
  const search = [];
  for (let i = 0; i < N; i++) {
    const s = stars[i];
    if (!(s.proper || s.bf || s.mag < 6.5)) continue;
    const name = s.proper || cleanBf(s.bf) || (s.hip > 0 ? 'HIP ' + s.hip : s.hd > 0 ? 'HD ' + s.hd : 'Star ' + i);
    search.push({
      i, name,
      bf: cleanBf(s.bf), gl: s.gl,
      hip: s.hip > 0 ? s.hip : undefined, hd: s.hd > 0 ? s.hd : undefined,
      mag: round(s.mag, 2), dist: round(s.dist * PC_TO_LY, 2),
      con: s.con, spect: s.spect,
    });
  }
  search.sort((a, b) => a.mag - b.mag);
  fs.writeFileSync(path.join(OUT, 'search.json'), JSON.stringify(search));
  log('wrote search.json', search.length, 'entries');

  // ---- labels: brightest named stars for always-on HUD text ----
  const labels = [];
  for (let i = 0; i < N; i++) {
    const s = stars[i];
    if (s.proper && s.mag < 3.4) labels.push({ i, name: s.proper });
  }
  fs.writeFileSync(path.join(OUT, 'labels.json'), JSON.stringify(labels));
  log('wrote labels.json', labels.length, 'entries');

  // ---- resolve voyages against the working set ----
  const byHip = new Map(), byHd = new Map(), byProper = new Map(), byGl = new Map();
  for (let i = 0; i < N; i++) {
    const s = stars[i];
    if (s.hip > 0 && !byHip.has(s.hip)) byHip.set(s.hip, i);
    if (s.hd > 0 && !byHd.has(s.hd)) byHd.set(s.hd, i);
    if (s.proper) byProper.set(s.proper.toLowerCase(), i);
    if (s.gl) byGl.set(s.gl.toLowerCase(), i);
  }
  const resolveMatch = (m) => {
    if (m.id === 0) return byHip.has(0) ? byHip.get(0) : 0; // Sol pinned to index 0
    if (m.hip != null && byHip.has(m.hip)) return byHip.get(m.hip);
    if (m.hd != null && byHd.has(m.hd)) return byHd.get(m.hd);
    if (m.proper && byProper.has(m.proper.toLowerCase())) return byProper.get(m.proper.toLowerCase());
    if (m.gl && byGl.has(m.gl.toLowerCase())) return byGl.get(m.gl.toLowerCase());
    return -1;
  };
  const voyagesOut = [];
  let unresolved = 0;
  for (const v of VOYAGES) {
    const wps = [];
    for (const w of v.waypoints) {
      const idx = w.match.id === 0 ? 0 : resolveMatch(w.match);
      if (idx < 0) { log('  ⚠ UNRESOLVED', v.id, JSON.stringify(w.match), w.title); unresolved++; continue; }
      const s = stars[idx];
      wps.push({
        i: idx,
        title: w.title,
        narrative: w.narrative,
        name: s.proper || cleanBf(s.bf) || w.title,
        pos: [round(s.x, 4), round(s.y, 4), round(s.z, 4)],
        catalogDistLy: round(s.dist * PC_TO_LY, 2),
        distanceLy: w.distance_ly,
        spect: s.spect,
        mag: round(s.mag, 2),
        con: s.con,
      });
    }
    voyagesOut.push({ id: v.id, title: v.title, subtitle: v.subtitle, kind: v.kind, intro: v.intro, waypoints: wps });
  }
  fs.writeFileSync(path.join(OUT, 'voyages.json'), JSON.stringify(voyagesOut));
  log('wrote voyages.json', voyagesOut.length, 'voyages,', unresolved, 'unresolved waypoints');

  log('DONE. working set =', N, 'stars');
}

function cleanBf(bf) {
  if (!bf) return '';
  // HYG bf like "9Alp CMa" or "61    Cyg" -> tidy spacing.
  return bf.replace(/\s+/g, ' ').trim();
}
function round(n, d) { const p = 10 ** d; return Math.round(n * p) / p; }

main().catch((e) => { console.error(e); process.exit(1); });
