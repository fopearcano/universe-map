#!/usr/bin/env node
// Curated extras: notable star clusters (open + globular) for LOCAL/COSMOS, and
// named large-scale structures (clusters, superclusters, walls, voids) for COSMOS.
// Positions are computed in the same equatorial frame as the star catalogue.
// Values are catalogue-approximate, for orientation/labelling.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'public', 'data');
const DECADE_UNIT = 3.0;
const PC_TO_LY = 3.2615638;

const dir = (raH, decD) => {
  const ra = raH * 15 * Math.PI / 180, dec = decD * Math.PI / 180, cd = Math.cos(dec);
  return [cd * Math.cos(ra), cd * Math.sin(ra), Math.sin(dec)];
};
const round = (n, d = 4) => { const p = 10 ** d; return Math.round(n * p) / p; };

// ---- star clusters: [name, type, RA(h), Dec(deg), distance(pc)] ----
const CLUSTERS = [
  ['Hyades', 'open', 4.45, 15.87, 47], ['Pleiades (M45)', 'open', 3.79, 24.11, 136],
  ['Beehive (M44)', 'open', 8.67, 19.67, 187], ['Coma Star Cluster', 'open', 12.37, 26.1, 86],
  ['Alpha Persei Cluster', 'open', 3.40, 49.0, 172], ['Southern Pleiades (IC 2602)', 'open', 10.72, -64.4, 150],
  ['IC 2391', 'open', 8.68, -53.0, 147], ['Ptolemy Cluster (M7)', 'open', 17.90, -34.8, 300],
  ['Butterfly Cluster (M6)', 'open', 17.67, -32.25, 490], ['NGC 752', 'open', 1.96, 37.8, 400],
  ['Double Cluster (NGC 869)', 'open', 2.32, 57.13, 2300], ['M35', 'open', 6.15, 24.33, 860],
  ['M67', 'open', 8.85, 11.8, 850], ['Wild Duck Cluster (M11)', 'open', 18.85, -6.27, 1900],
  ['Jewel Box (NGC 4755)', 'open', 12.89, -60.35, 1976],
  ['Omega Centauri', 'globular', 13.45, -47.48, 5200], ['47 Tucanae', 'globular', 0.40, -72.08, 4000],
  ['Hercules Cluster (M13)', 'globular', 16.69, 36.46, 7700], ['M22', 'globular', 18.61, -23.9, 3200],
  ['M5', 'globular', 15.31, 2.08, 7500], ['M4', 'globular', 16.39, -26.53, 2200],
  ['M15', 'globular', 21.50, 12.17, 10400], ['M3', 'globular', 13.70, 28.38, 10400],
  ['M92', 'globular', 17.29, 43.14, 8300], ['M2', 'globular', 21.56, -0.82, 11500],
  ['NGC 6752', 'globular', 19.18, -59.98, 4000],
];

// ---- large-scale structures: [name, type, RA(h), Dec(deg), distance(Mpc), note] ----
const STRUCTURES = [
  ['Virgo Cluster', 'cluster', 12.45, 12.72, 16.5, 'the nearest large galaxy cluster; heart of our supercluster'],
  ['Fornax Cluster', 'cluster', 3.63, -35.45, 19, 'the second-nearest rich cluster'],
  ['Coma Cluster', 'cluster', 12.99, 27.98, 100, 'a very rich cluster of over 1,000 galaxies'],
  ['Centaurus Cluster', 'cluster', 12.79, -41.3, 52, 'a bright cluster in the Hydra-Centaurus Supercluster'],
  ['Perseus Cluster', 'cluster', 3.33, 41.5, 74, 'one of the most massive nearby objects'],
  ['Norma Cluster · Great Attractor', 'attractor', 16.25, -60.9, 65, 'the gravitational focus pulling in the Local Group'],
  ['Shapley Supercluster', 'supercluster', 13.42, -31.0, 200, 'the largest concentration of mass in the nearby universe'],
  ['Hercules Supercluster', 'supercluster', 16.10, 17.75, 100, 'a chain of clusters forming part of the Great Wall'],
  ['Perseus-Pisces Supercluster', 'supercluster', 2.50, 41.0, 70, 'one of the largest nearby structures'],
  ['Laniakea Supercluster', 'supercluster', 10.5, -46.0, 80, 'our home supercluster, 500 Mly across'],
  ['Sloan Great Wall', 'wall', 12.5, 8.0, 300, 'a wall of galaxies ~1.4 Gly long'],
  ['CfA2 Great Wall', 'wall', 13.0, 32.0, 100, 'the first "great wall" ever mapped'],
  ['Boötes Void', 'void', 14.83, 26.0, 210, 'a near-empty region ~330 Mly across'],
  ['Bullet Cluster', 'cluster', 6.98, -55.95, 1140, 'colliding clusters; key evidence for dark matter'],
];

const clusters = CLUSTERS.map(([name, type, ra, dec, distPc]) => {
  const d = dir(ra, dec);
  return {
    name, type, ra, dec, distPc, distLy: round(distPc * PC_TO_LY, 1),
    pos: [round(d[0] * distPc), round(d[1] * distPc), round(d[2] * distPc)], // parsec cartesian (LOCAL)
    dir: d.map((v) => round(v, 6)),
    displayR: round(DECADE_UNIT * Math.log10(distPc), 4), // COSMOS
  };
});

const structures = STRUCTURES.map(([name, type, ra, dec, distMpc, note]) => {
  const d = dir(ra, dec);
  return {
    name, type, note, ra, dec, distMpc, distGly: round(distMpc * PC_TO_LY / 1000, 3),
    dir: d.map((v) => round(v, 6)),
    displayR: round(DECADE_UNIT * Math.log10(distMpc * 1e6), 4),
  };
});

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'clusters.json'), JSON.stringify(clusters));
fs.writeFileSync(path.join(OUT, 'structures.json'), JSON.stringify(structures));
console.log('[build-extras] wrote clusters.json', clusters.length, '· structures.json', structures.length);
