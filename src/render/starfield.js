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
        uSizeUser: { value: 1.0 },   // per-layer user size (graphics panel)
        uGain: { value: 1.0 },       // per-layer brightness / glow gain
        uTint: { value: new THREE.Color(1, 1, 1) },
        uTintAmt: { value: 0.0 },    // 0 = native colour, 1 = full tint
        uTime: { value: 0 },
        uTwinkle: { value: 1 },      // 0/1 — subtle brightness shimmer on bright stars
        uShard: { value: 0 },        // 0/1 — animated RGB chromatic diffraction shards
      },
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aVisible;
        uniform float uPixelRatio;
        uniform float uSizeScale;
        uniform float uSizeUser;
        uniform float uTime;
        uniform float uTwinkle;
        uniform float uTintAmt;
        uniform vec3 uTint;
        varying vec3 vColor;
        varying float vVisible;
        varying float vBright;
        varying float vTw;
        varying float vPhase;
        void main() {
          vColor = mix(aColor, uTint, uTintAmt);
          vVisible = aVisible;
          // aSize encodes apparent magnitude (brighter star ⇒ bigger). Gate the
          // diffraction shards to the brightest, ramping in from aSize≈3 (~mag 2.5).
          vBright = clamp((aSize - 3.0) / 6.0, 0.0, 1.0);
          // subtle atmospheric twinkle: a per-star phase (hashed from position) drives
          // a gentle brightness shimmer, strongest on the brightest stars, off when uTwinkle=0.
          float phase = fract(sin(dot(position.xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          vPhase = phase;   // carried to the fragment stage for the animated shard flare
          vTw = 1.0 - uTwinkle * (0.10 + 0.22 * vBright) * (0.5 + 0.5 * sin(uTime * 2.6 + phase * 6.2831));
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float dist = max(-mv.z, 0.001);
          float att = 190.0 / dist;
          float px = aSize * (0.55 + att) * uSizeScale * uSizeUser * uPixelRatio;
          px = clamp(px, 1.0 * uPixelRatio, 21.0 * uPixelRatio);
          // give the brightest a little extra room so the shards can radiate
          px *= 1.0 + 0.7 * vBright;
          gl_PointSize = vVisible > 0.5 ? px : 0.0;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uGain;
        uniform float uTime;
        uniform float uShard;
        varying vec3 vColor;
        varying float vVisible;
        varying float vBright;
        varying float vTw;
        varying float vPhase;
        // one diffraction "cross" (horizontal + vertical + fainter diagonals) whose
        // arm length is passed in, so we can render it per-channel for RGB fringing.
        float spike(vec2 av, vec2 ar, float len) {
          float s = (1.0 - smoothstep(0.0, len, av.x)) * (1.0 - smoothstep(0.0, 0.05, av.y));
          s += (1.0 - smoothstep(0.0, len, av.y)) * (1.0 - smoothstep(0.0, 0.05, av.x));
          s += 0.5 * (1.0 - smoothstep(0.0, len, ar.x)) * (1.0 - smoothstep(0.0, 0.06, ar.y));
          s += 0.5 * (1.0 - smoothstep(0.0, len, ar.y)) * (1.0 - smoothstep(0.0, 0.06, ar.x));
          return s;
        }
        void main() {
          if (vVisible < 0.5) discard;
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          float core = smoothstep(0.5, 0.0, d);
          float glow = pow(core, 2.1);
          // RGB chromatic diffraction shards, brightest-only. Per-channel arm lengths
          // (R longest → B shortest) make the spikes fringe into colour toward the tips,
          // a cinematic prism/anamorphic flare. vBright is constant across the sprite,
          // so the branch lets the GPU skip the spike math for the (vast) faint majority.
          // uShard turns this into a live "shard twinkle": the arms breathe and the
          // RGB channels split apart on a per-star phase; a rotating flare adds sparkle.
          vec3 shardRGB = vec3(0.0);
          if (vBright > 0.001) {
            // per-star breathing pulse (0.6…1.0) and a slowly rotating shard cross
            float pulse = uShard > 0.5 ? (0.6 + 0.4 * (0.5 + 0.5 * sin(uTime * 3.1 + vPhase * 6.2831))) : 1.0;
            float rot = uShard * (0.35 * sin(uTime * 0.9 + vPhase * 6.2831));
            float cs = cos(rot), sn = sin(rot);
            vec2 ruv = mat2(cs, -sn, sn, cs) * uv;
            vec2 av = abs(ruv);
            vec2 r = vec2(ruv.x + ruv.y, ruv.x - ruv.y) * 0.70710678;
            vec2 ar = abs(r);
            // wider base arms + stronger RGB channel split when the shard option is on
            float grow = 1.0 + uShard * 0.35;
            float split = 0.07 + uShard * 0.10;   // chromatic separation of the arm tips
            float baseLen = 0.48 * grow * pulse;
            shardRGB = vec3(
              spike(av, ar, baseLen + split),
              spike(av, ar, baseLen),
              spike(av, ar, max(0.12, baseLen - split))
            ) * vBright;
          }
          float shard = dot(shardRGB, vec3(0.3333));
          float shardGain = 0.8 + uShard * 0.7;   // brighter, livelier flare when enabled
          float a = clamp(glow + shard * shardGain, 0.0, 1.0);
          if (a < 0.003) discard;
          // core keeps the star's own colour; the spikes fringe toward RGB at the tips
          vec3 spikeCol = mix(vColor, shardRGB, 0.6);
          vec3 outCol = (vColor * (0.45 + 0.95 * glow) + spikeCol * shard * shardGain) * vTw * uGain;
          gl_FragColor = vec4(outCol, a);
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
  setTwinkle(on) { this.material.uniforms.uTwinkle.value = on ? 1 : 0; }
  setShard(on) { this.material.uniforms.uShard.value = on ? 1 : 0; }
  // Per-layer visuals from the graphics panel: { size, gain, tint:[r,g,b], tintAmt }.
  setStyle(st = {}) {
    const u = this.material.uniforms;
    if (st.size != null) u.uSizeUser.value = st.size;
    if (st.gain != null) u.uGain.value = st.gain;
    if (Array.isArray(st.tint)) u.uTint.value.setRGB(st.tint[0], st.tint[1], st.tint[2]);
    if (st.tintAmt != null) u.uTintAmt.value = st.tintAmt;
  }
  tick(dt) { this.material.uniforms.uTime.value += dt; }

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
