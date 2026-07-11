import * as THREE from 'three';
import { displayRadiusFromMpc } from '../util/cosmology.js';

// Curated real cosmic supervoids — vast, near-empty regions of the cosmic web.
// Positions/sizes are approximate (voids have soft, irregular boundaries). RA in
// HOURS, Dec in DEGREES, distance and radius in Mpc. These both (a) render as
// zone indicators and (b) keep the procedural "known-universe" fill honest by
// staying empty where the real universe is empty.
export const SUPERVOIDS = [
  { name: 'Boötes Void', ra: 14.83, dec: 26, distMpc: 210, radiusMpc: 50, note: 'the "Great Nothing" — ~330 Mly across, among the largest known voids' },
  { name: 'Local Void', ra: 18.5, dec: 5, distMpc: 30, radiusMpc: 30, note: 'begins at the edge of the Local Group; strikingly empty of galaxies' },
  { name: 'Eridanus Supervoid', ra: 3.2, dec: -19, distMpc: 700, radiusMpc: 160, note: 'the proposed cause of the CMB "Cold Spot"' },
  { name: 'Giant Void', ra: 12.9, dec: 10, distMpc: 310, radiusMpc: 100, note: 'in Canes Venatici — one of the largest voids known' },
  { name: 'Sculptor Void', ra: 1.0, dec: -33, distMpc: 60, radiusMpc: 28, note: 'a nearby southern void' },
  { name: 'Taurus Void', ra: 4.6, dec: 20, distMpc: 55, radiusMpc: 25, note: 'a nearby void toward the galactic anticentre' },
  { name: 'Microscopium Void', ra: 20.8, dec: -35, distMpc: 110, radiusMpc: 45, note: 'a southern supervoid' },
  { name: 'Capricornus Void', ra: 21.5, dec: -18, distMpc: 90, radiusMpc: 35, note: 'a void in Capricornus' },
];

// Add display-space geometry: unit direction, radial display position, angular
// half-size (cosR), and the ellipsoid extents used by the shape and the fill
// exclusion. In the log-radial view a void is a lens — wide across the sky, thin
// in depth — so the transverse extent dominates.
export function computeSupervoids(decadeUnit = 3) {
  return SUPERVOIDS.map((v) => {
    const ra = v.ra * 15 * Math.PI / 180, dec = v.dec * Math.PI / 180, cd = Math.cos(dec);
    const dir = [cd * Math.cos(ra), cd * Math.sin(ra), Math.sin(dec)];
    const rIn = displayRadiusFromMpc(Math.max(0.1, v.distMpc - v.radiusMpc), decadeUnit);
    const rOut = displayRadiusFromMpc(v.distMpc + v.radiusMpc, decadeUnit);
    // Log compression makes the near/far edges asymmetric about the distance point,
    // so centre the lens on the true display-space midpoint, not on displayR(dist).
    const displayR = (rIn + rOut) / 2;
    const band = Math.max(0.4, (rOut - rIn) / 2);                    // radial half-extent (display)
    const theta = Math.asin(Math.min(0.99, v.radiusMpc / v.distMpc)); // angular radius
    const transverse = Math.max(0.6, displayR * Math.tan(theta));     // across-sky half-extent (display)
    return { ...v, type: 'void', dir, displayR, band, transverse, cosR: Math.cos(theta) };
  });
}

// Translucent flattened-ellipsoid "bubble" + wireframe for each supervoid, sized
// to its real angular extent and flattened along the line of sight (the log-radial
// depth compression). One shared low-poly sphere, scaled/oriented per void.
export class VoidShapes {
  constructor(voids) {
    this.group = new THREE.Group();
    this.group.visible = false;
    const geo = new THREE.SphereGeometry(1, 20, 14);
    const up = new THREE.Vector3(0, 0, 1);
    for (const v of voids) {
      const center = new THREE.Vector3(v.dir[0] * v.displayR, v.dir[1] * v.displayR, v.dir[2] * v.displayR);
      const radial = Math.max(v.band, v.transverse * 0.32);          // keep the lens visibly thick
      const q = new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(v.dir[0], v.dir[1], v.dir[2]));
      const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x2f2a5c, transparent: true, opacity: 0.10, side: THREE.BackSide, depthWrite: false }));
      const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x9184e6, wireframe: true, transparent: true, opacity: 0.24, depthWrite: false }));
      for (const m of [fill, wire]) {
        m.position.copy(center); m.quaternion.copy(q); m.scale.set(v.transverse, v.transverse, radial);
        m.frustumCulled = false; m.renderOrder = 2;
        this.group.add(m);
      }
    }
  }
  setVisible(v) { this.group.visible = v; }
  dispose() { this.group.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); }
}
