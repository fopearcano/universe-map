import * as THREE from 'three';
import { bvToDisplayRGB, spectralClassOf } from '../util/color.js';
import { PC_TO_LY } from '../util/astro.js';

// 100k stars as a single GL_POINTS draw. Colour comes from the B-V index, screen
// size from apparent magnitude with clamped distance attenuation, and a per-vertex
// visibility attribute lets filters hide stars on the GPU without rebuilding data.
export class Starfield {
  constructor(catalog) {
    this.catalog = catalog;
    const N = catalog.count;
    this.count = N;

    const colors = new Float32Array(N * 3);
    const sizes = new Float32Array(N);
    const visible = new Float32Array(N).fill(1);
    this.classByte = new Uint8Array(N); // spectral class index for filtering
    this.named = new Uint8Array(N);
    this.pinned = new Uint8Array(N);    // always-visible (e.g. active voyage stops)
    for (const e of catalog.search) this.named[e.i] = 1;

    const CLASS_ORDER = 'OBAFGKM';
    for (let i = 0; i < N; i++) {
      const [r, g, b] = bvToDisplayRGB(catalog.ci[i]);
      colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
      const mag = catalog.mag[i];
      sizes[i] = clamp((7.0 - mag) * 0.5 + 1.2, 0.55, 9.0);
      const cls = spectralClassOf(catalog.spect[i]);
      const idx = CLASS_ORDER.indexOf(cls);
      this.classByte[i] = idx < 0 ? 7 : idx; // 7 = other/unknown
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(catalog.positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    this.visibleAttr = new THREE.BufferAttribute(visible, 1);
    geo.setAttribute('aVisible', this.visibleAttr);
    geo.computeBoundingSphere();

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uSizeScale: { value: 1.0 },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aVisible;
        uniform float uPixelRatio;
        uniform float uSizeScale;
        varying vec3 vColor;
        varying float vVisible;
        varying float vBright;
        void main() {
          vColor = aColor;
          vVisible = aVisible;
          // aSize encodes apparent magnitude (brighter star ⇒ bigger). Gate the
          // diffraction shards to the brightest, ramping in from aSize≈3 (~mag 2.5).
          vBright = clamp((aSize - 3.0) / 6.0, 0.0, 1.0);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float dist = max(-mv.z, 0.001);
          float att = 190.0 / dist;
          float px = aSize * (0.55 + att) * uSizeScale * uPixelRatio;
          px = clamp(px, 1.0 * uPixelRatio, 21.0 * uPixelRatio);
          // give the brightest a little extra room so the shards can radiate
          px *= 1.0 + 0.7 * vBright;
          gl_PointSize = vVisible > 0.5 ? px : 0.0;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vVisible;
        varying float vBright;
        void main() {
          if (vVisible < 0.5) discard;
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          float core = smoothstep(0.5, 0.0, d);
          float glow = pow(core, 2.1);
          // subtle four-point diffraction shards (+ fainter diagonals), brightest-only
          float sp = 0.0;
          vec2 av = abs(uv);
          sp += (1.0 - smoothstep(0.0, 0.5, av.x)) * (1.0 - smoothstep(0.0, 0.05, av.y));
          sp += (1.0 - smoothstep(0.0, 0.5, av.y)) * (1.0 - smoothstep(0.0, 0.05, av.x));
          vec2 r = vec2(uv.x + uv.y, uv.x - uv.y) * 0.70710678;
          vec2 ar = abs(r);
          sp += 0.5 * (1.0 - smoothstep(0.0, 0.5, ar.x)) * (1.0 - smoothstep(0.0, 0.06, ar.y));
          sp += 0.5 * (1.0 - smoothstep(0.0, 0.5, ar.y)) * (1.0 - smoothstep(0.0, 0.06, ar.x));
          float shard = sp * vBright;
          float a = clamp(glow + shard * 0.8, 0.0, 1.0);
          if (a < 0.003) discard;
          gl_FragColor = vec4(vColor * (0.45 + 0.95 * glow + shard), a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.material = mat;
    this._visible = visible;

    // classes = set of allowed spectral-class indices (0..6 = OBAFGKM, 7 = other)
    this.filter = { magMax: 21, distMaxLy: 300, classes: new Set([0, 1, 2, 3, 4, 5, 6, 7]), namedOnly: false, con: -1 };
    this.visibleCount = N;
  }

  setSizeScale(s) { this.material.uniforms.uSizeScale.value = s; }

  applyFilter(f = {}) {
    Object.assign(this.filter, f);
    const { magMax, distMaxLy, classes, namedOnly, con } = this.filter;
    const c = this.catalog;
    const distMaxPc = distMaxLy / PC_TO_LY;
    let n = 0;
    for (let i = 0; i < this.count; i++) {
      let v = 1;
      if (c.mag[i] > magMax) v = 0;
      else if (namedOnly && !this.named[i]) v = 0;
      else if (con >= 0 && c.con[i] !== con) v = 0;
      else if (!classes.has(this.classByte[i])) v = 0;
      else {
        const dpc = Math.hypot(c.positions[i * 3], c.positions[i * 3 + 1], c.positions[i * 3 + 2]);
        if (dpc > distMaxPc) v = 0;
      }
      if (i === 0 || this.pinned[i]) v = 1; // Sol and pinned voyage stops always show
      this._visible[i] = v;
      n += v;
    }
    this.visibleAttr.needsUpdate = true;
    this.visibleCount = n;
    return n;
  }

  isVisible(i) { return this._visible[i] > 0.5; }

  setPinned(indices) {
    this.pinned.fill(0);
    for (const i of indices) this.pinned[i] = 1;
  }
}

function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
