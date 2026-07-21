import * as THREE from 'three';
import { SpatialGrid } from './spatialGrid.js';

// A navigable galaxy interior: the selected galaxy's star field as its own scene
// you can fly inside, pick stars in, and trace routes through. The cloud is
// image-derived (mirrors the real cutout) or procedural; positions are in local
// "interior units", with pcPerUnit converting to parsecs so routes report true
// intra-galaxy distances and travel times.
export class GalaxyInterior {
  constructor(cloud, { pcPerUnit, name, imageDerived = false, sizeScale = 1 } = {}) {
    this.name = name;
    this.pcPerUnit = pcPerUnit;
    this.imageDerived = imageDerived;
    this.count = cloud.count;
    this.positions = cloud.positions;
    this.colors = cloud.colors;

    const N = this.count;
    const sizes = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const lum = 0.3 * this.colors[i * 3] + 0.6 * this.colors[i * 3 + 1] + 0.1 * this.colors[i * 3 + 2];
      sizes[i] = 0.6 + lum * 1.9;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions.subarray(0, N * 3), 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.colors.subarray(0, N * 3), 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.computeBoundingSphere();

    const mat = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }, uSizeScale: { value: sizeScale } },
      vertexShader: /* glsl */`
        attribute vec3 aColor; attribute float aSize;
        uniform float uPixelRatio, uSizeScale; varying vec3 vC;
        void main(){
          vC = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float dist = max(-mv.z, 0.001);
          float att = 7.0 / dist;
          gl_PointSize = clamp(aSize * (0.6 + att) * uSizeScale * uPixelRatio, 1.0, 16.0 * uPixelRatio);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vC;
        void main(){
          vec2 uv = gl_PointCoord - 0.5; float d = length(uv);
          if (d > 0.5) discard;
          float core = smoothstep(0.5, 0.0, d); float glow = pow(core, 2.0);
          gl_FragColor = vec4(vC * (0.42 + 0.7 * glow), glow * 0.82);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.material = mat;
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.group = new THREE.Group();
    this.group.add(this.points);
    this._extent = geo.boundingSphere ? geo.boundingSphere.radius : 30;
    // spatial index for fast picking once the field gets large
    this._grid = N > 40000 ? new SpatialGrid(this.positions, N, { cells: 56 }) : null;
  }

  extent() { return this._extent; }
  setVisible(v) { this.group.visible = v; }
  setSizeScale(s) { this.material.uniforms.uSizeScale.value = s; }
  starWorld(i, out = new THREE.Vector3()) { return out.set(this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]); }
  // distance of star i from the galactic centre, in parsecs
  starDistPc(i) { return Math.hypot(this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]) * this.pcPerUnit; }

  // nearest-ray pick over the interior stars (spatial-indexed when large)
  pick(raycaster, camera, thresholdPx = 14) {
    if (this._grid) return this._grid.pick(raycaster, camera, thresholdPx);
    const ray = raycaster.ray, o = ray.origin, dir = ray.direction;
    const maxAng = thresholdPx * ((camera.fov * Math.PI / 180) / window.innerHeight);
    let best = -1, bestAng = maxAng; const p = new THREE.Vector3();
    for (let i = 0; i < this.count; i++) {
      p.set(this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]).sub(o);
      const t = p.dot(dir); if (t <= 0) continue;
      const ang = Math.sqrt(Math.max(0, p.lengthSq() - t * t)) / t;
      if (ang < bestAng) { best = i; bestAng = ang; }
    }
    return best;
  }

  dispose() { this.points.geometry.dispose(); this.material.dispose(); }
}
