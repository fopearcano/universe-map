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
    // prefer the morphology's per-star size hint (nucleus/HII knots big, halo small);
    // fall back to a luminance-derived size for older clouds that don't carry one.
    const srcSizes = cloud.sizes;
    for (let i = 0; i < N; i++) {
      const lum = 0.3 * this.colors[i * 3] + 0.6 * this.colors[i * 3 + 1] + 0.1 * this.colors[i * 3 + 2];
      sizes[i] = srcSizes ? 0.5 + srcSizes[i] * 1.15 : 0.6 + lum * 1.9;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions.subarray(0, N * 3), 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.colors.subarray(0, N * 3), 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.computeBoundingSphere();

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }, uSizeScale: { value: sizeScale },
        uTime: { value: 0 }, uTwinkle: { value: 0 }, uShard: { value: 0 },
      },
      vertexShader: /* glsl */`
        attribute vec3 aColor; attribute float aSize;
        uniform float uPixelRatio, uSizeScale, uTime, uTwinkle;
        varying vec3 vC; varying float vB; varying float vPh; varying float vTw;
        void main(){
          vC = aColor;
          // brightest stars (nucleus, HII knots, globulars) earn a diffraction flare
          vB = clamp((aSize - 2.0) / 2.4, 0.0, 1.0);
          float phase = fract(sin(dot(position.xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          vPh = phase;
          vTw = 1.0 - uTwinkle * (0.10 + 0.24 * vB) * (0.5 + 0.5 * sin(uTime * 2.6 + phase * 6.2831));
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float dist = max(-mv.z, 0.001);
          float att = 7.0 / dist;
          float px = aSize * (0.6 + att) * uSizeScale * uPixelRatio;
          px *= 1.0 + 0.7 * vB;
          gl_PointSize = clamp(px, 1.0, 22.0 * uPixelRatio);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uShard;
        varying vec3 vC; varying float vB; varying float vPh; varying float vTw;
        float spike(vec2 av, vec2 ar, float len) {
          float s = (1.0 - smoothstep(0.0, len, av.x)) * (1.0 - smoothstep(0.0, 0.05, av.y));
          s += (1.0 - smoothstep(0.0, len, av.y)) * (1.0 - smoothstep(0.0, 0.05, av.x));
          s += 0.5 * (1.0 - smoothstep(0.0, len, ar.x)) * (1.0 - smoothstep(0.0, 0.06, ar.y));
          s += 0.5 * (1.0 - smoothstep(0.0, len, ar.y)) * (1.0 - smoothstep(0.0, 0.06, ar.x));
          return s;
        }
        void main(){
          vec2 uv = gl_PointCoord - 0.5; float d = length(uv);
          float core = smoothstep(0.5, 0.0, d); float glow = pow(core, 2.0);
          vec3 shardRGB = vec3(0.0);
          if (vB > 0.001) {
            float pulse = uShard > 0.5 ? (0.6 + 0.4 * (0.5 + 0.5 * sin(uTime * 3.1 + vPh * 6.2831))) : 1.0;
            float rot = uShard * (0.35 * sin(uTime * 0.9 + vPh * 6.2831));
            float cs = cos(rot), sn = sin(rot);
            vec2 ruv = mat2(cs, -sn, sn, cs) * uv;
            vec2 av = abs(ruv); vec2 rr = vec2(ruv.x + ruv.y, ruv.x - ruv.y) * 0.70710678; vec2 ar = abs(rr);
            float grow = 1.0 + uShard * 0.35, split = 0.07 + uShard * 0.10, baseLen = 0.46 * grow * pulse;
            shardRGB = vec3(spike(av, ar, baseLen + split), spike(av, ar, baseLen), spike(av, ar, max(0.12, baseLen - split))) * vB;
          }
          float shard = dot(shardRGB, vec3(0.3333));
          float sg = 0.7 + uShard * 0.7;
          float a = clamp(glow * 0.82 + shard * sg, 0.0, 1.0);
          if (a < 0.003) discard;
          vec3 spikeCol = mix(vC, shardRGB, 0.6);
          vec3 outCol = (vC * (0.42 + 0.7 * glow) + spikeCol * shard * sg) * vTw;
          gl_FragColor = vec4(outCol, a);
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
  setTwinkle(on) { this.material.uniforms.uTwinkle.value = on ? 1 : 0; }
  setShard(on) { this.material.uniforms.uShard.value = on ? 1 : 0; }
  tick(dt) { this.material.uniforms.uTime.value += dt; }
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
