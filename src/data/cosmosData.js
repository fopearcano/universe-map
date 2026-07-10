// Loads the cosmological layers (galaxy & quasar catalogues, Local Group, CMB
// parameters, scale-ladder voyage). Each point layer is a flat Float32Array with
// stride 4: [dirX, dirY, dirZ, z].
const BASE = import.meta.env.BASE_URL || '/';
const url = (p) => `${BASE}data/${p}`.replace(/\/\/+/g, '/');

export class CosmosData {
  constructor() {
    this.meta = null;
    this.layers = {};        // key -> { count, data: Float32Array(4N) }
    this.localGroup = [];
    this.voyages = [];
    this.loaded = false;
  }

  async load(onProgress = () => {}) {
    onProgress(0.05, 'cosmology metadata');
    const meta = await fetch(url('cosmos-meta.json')).then((r) => r.json());
    this.meta = meta;

    const keys = Object.keys(meta.layers); // twomrs, sdssGal, sdssQso
    let done = 0;
    await Promise.all(keys.map(async (k) => {
      const info = meta.layers[k];
      const buf = await fetch(url(info.file)).then((r) => r.arrayBuffer());
      this.layers[k] = { count: info.count, zmin: info.zmin, zmax: info.zmax, data: new Float32Array(buf) };
      done++; onProgress(0.1 + (done / keys.length) * 0.7, `galaxies & quasars (${k})`);
    }));

    const [lg, voy] = await Promise.all([
      fetch(url('cosmos-localgroup.json')).then((r) => r.json()),
      fetch(url('cosmos-voyages.json')).then((r) => r.json()),
    ]);
    this.localGroup = lg;
    this.voyages = voy;
    this.loaded = true;
    onProgress(1, 'cosmos ready');
    return this;
  }

  totalCount() {
    return Object.values(this.layers).reduce((s, l) => s + l.count, 0);
  }
}
