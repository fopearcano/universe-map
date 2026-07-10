// Loads the preprocessed HYG working set and exposes it as typed arrays plus a
// convenience accessor. All heavy per-star data stays in flat typed arrays; only
// on demand (info panel, search) do we build JS objects.

import { cartesianToRaDec, luminosity, PC_TO_LY } from '../util/astro.js';
import { spectralClassOf } from '../util/color.js';

const BASE = import.meta.env.BASE_URL || '/';
const url = (p) => `${BASE}data/${p}`.replace(/\/\/+/g, '/');

export class Catalog {
  constructor() {
    this.count = 0;
    this.positions = null; // Float32Array 3N
    this.mag = null; this.absmag = null; this.ci = null;
    this.hip = null; this.hd = null; this.con = null;
    this.spect = null; // string[]
    this.meta = null;
    this.search = [];
    this.labels = [];
    this.voyages = [];
    this._conNames = new Map();
  }

  async load(onProgress = () => {}) {
    onProgress(0.05, 'fetching catalogue metadata');
    const meta = await fetch(url('stars-meta.json')).then((r) => r.json());
    this.meta = meta;
    this.count = meta.count;
    meta.constellations.forEach((c, i) => this._conNames.set(i, c));

    onProgress(0.15, 'fetching star positions');
    const buf = await fetchBinary(url('stars.bin'), (f) => onProgress(0.15 + f * 0.5, 'streaming 100,000 stars'));
    const L = meta.layout;
    const N = meta.count;
    this.positions = new Float32Array(buf, L.positions.offset, N * 3);
    this.mag = new Float32Array(buf, L.mag.offset, N);
    this.absmag = new Float32Array(buf, L.absmag.offset, N);
    this.ci = new Float32Array(buf, L.ci.offset, N);
    this.hip = new Int32Array(buf, L.hip.offset, N);
    this.hd = new Int32Array(buf, L.hd.offset, N);
    this.con = new Uint8Array(buf, L.con.offset, N);

    onProgress(0.7, 'loading spectral types');
    const [spectTxt, search, labels, voyages] = await Promise.all([
      fetch(url('stars-spect.txt')).then((r) => r.text()),
      fetch(url('search.json')).then((r) => r.json()),
      fetch(url('labels.json')).then((r) => r.json()),
      fetch(url('voyages.json')).then((r) => r.json()),
    ]);
    this.spect = spectTxt.split('\n');
    this.search = search;
    this.labels = labels;
    this.voyages = voyages;
    onProgress(1, 'ready');
    return this;
  }

  conName(i) {
    const c = this._conNames.get(i);
    return c ? c[1] : null;
  }
  conAbbr(i) {
    const c = this._conNames.get(i);
    return c ? c[0] : null;
  }

  x(i) { return this.positions[i * 3]; }
  y(i) { return this.positions[i * 3 + 1]; }
  z(i) { return this.positions[i * 3 + 2]; }

  distancePc(i) {
    return Math.hypot(this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]);
  }

  // Composed record for the info panel.
  star(i) {
    const x = this.x(i), y = this.y(i), z = this.z(i);
    const { ra, dec, r } = cartesianToRaDec(x, y, z);
    const s = this.search.find((e) => e.i === i); // named entry if any
    const name = s?.name || this._designation(i);
    return {
      i, name,
      isSun: i === 0,
      x, y, z,
      distPc: r,
      distLy: r * PC_TO_LY,
      ra, dec,
      mag: this.mag[i],
      absmag: this.absmag[i],
      lum: i === 0 ? 1 : luminosity(this.absmag[i]),
      ci: this.ci[i],
      spect: this.spect[i] || '—',
      specClass: spectralClassOf(this.spect[i]),
      hip: this.hip[i] > 0 ? this.hip[i] : null,
      hd: this.hd[i] > 0 ? this.hd[i] : null,
      conIndex: this.con[i],
      con: this.conName(this.con[i]),
      conAbbr: this.conAbbr(this.con[i]),
      bf: s?.bf || null,
      gl: s?.gl || null,
    };
  }

  _designation(i) {
    if (i === 0) return 'Sol';
    if (this.hip[i] > 0) return 'HIP ' + this.hip[i];
    if (this.hd[i] > 0) return 'HD ' + this.hd[i];
    return 'Star #' + i;
  }
}

// Stream an ArrayBuffer with coarse progress reporting.
async function fetchBinary(u, onFrac = () => {}) {
  const res = await fetch(u);
  if (!res.ok) throw new Error(`${u}: HTTP ${res.status}`);
  const total = +res.headers.get('content-length') || 0;
  if (!res.body || !total) return res.arrayBuffer();
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onFrac(received / total);
  }
  const out = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out.buffer;
}
