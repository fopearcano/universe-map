import * as THREE from 'three';

// A labelled marker layer. Each marker is a screen-space billboard that samples a
// glyph from a shared icon atlas (so different object classes get different icons)
// and can carry a per-item size multiplier. Positions are world-space Vector3s;
// each item carries a colour, a glyph index and a label.
export class MarkerLayer {
  constructor(items, { size = 13, atlas, ring } = {}) {
    this.items = items; // [{ pos, color:[r,g,b], label, glyph?, scale?, prio?, data? }]
    this.positions = items.map((it) => it.pos.clone());
    const N = items.length;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const glyph = new Float32Array(N), scale = new Float32Array(N);
    items.forEach((it, i) => {
      pos[i * 3] = it.pos.x; pos[i * 3 + 1] = it.pos.y; pos[i * 3 + 2] = it.pos.z;
      col[i * 3] = it.color[0]; col[i * 3 + 1] = it.color[1]; col[i * 3 + 2] = it.color[2];
      glyph[i] = it.glyph ?? GLYPH.ring;
      scale[i] = it.scale ?? 1;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aGlyph', new THREE.BufferAttribute(glyph, 1));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    // Backward-compatible single-texture mode (a lone ring); otherwise the atlas.
    const useAtlas = !!atlas;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uSize: { value: size },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uMap: { value: useAtlas ? atlas.texture : ring },
        uCols: { value: useAtlas ? atlas.cols : 1 },
        uRows: { value: useAtlas ? atlas.rows : 1 },
        uAtlas: { value: useAtlas ? 1 : 0 },
      },
      vertexShader: /* glsl */`
        attribute vec3 aColor; attribute float aGlyph; attribute float aScale;
        uniform float uSize, uPixelRatio; varying vec3 vColor; varying float vGlyph;
        void main(){
          vColor = aColor; vGlyph = aGlyph;
          gl_PointSize = uSize * aScale * uPixelRatio;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uMap; uniform float uCols, uRows, uAtlas;
        varying vec3 vColor; varying float vGlyph;
        void main(){
          vec2 uv = gl_PointCoord;
          if (uAtlas > 0.5) {
            float col = mod(vGlyph, uCols);
            float row = floor(vGlyph / uCols);
            uv = (vec2(col, row) + gl_PointCoord) / vec2(uCols, uRows);
          }
          vec4 t = texture2D(uMap, uv);
          if (t.a < 0.05) discard;
          gl_FragColor = vec4(vColor, t.a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  setVisible(v) { this.points.visible = v; }

  labelItems() {
    return this.items.map((it) => ({ pos: it.pos.clone(), text: it.label, prio: it.prio ?? 5 }));
  }
}

// Nearest-ray pick over a list of Vector3 positions. Returns { i, ang } or null.
export function pickPositions(raycaster, positions, camera, thresholdPx = 15) {
  const ray = raycaster.ray, o = ray.origin, d = ray.direction;
  const maxAng = thresholdPx * ((camera.fov * Math.PI / 180) / window.innerHeight);
  let best = -1, bestAng = maxAng;
  const p = new THREE.Vector3();
  for (let i = 0; i < positions.length; i++) {
    p.copy(positions[i]).sub(o);
    const t = p.dot(d);
    if (t <= 0) continue;
    const ang = Math.sqrt(Math.max(0, p.lengthSq() - t * t)) / t;
    if (ang < bestAng) { best = i; bestAng = ang; }
  }
  return best >= 0 ? { i: best, ang: bestAng } : null;
}

// ---- The icon atlas ------------------------------------------------------------
// A single canvas holding one distinct glyph per object/event class, laid out on a
// COLS×ROWS grid. MarkerLayer samples a cell via the per-point aGlyph index.
const CELL = 128, COLS = 6, ROWS = 3;
export const GLYPH = {
  ring: 0, blackhole: 1, pulsar: 2, supernova: 3, nebula: 4, exoplanet: 5,
  galaxy: 6, quasar: 7, transient: 8, hyperstar: 9, star: 10, open: 11,
  globular: 12, supercluster: 13, wall: 14, void: 15, attractor: 16, sparkle: 17,
};

// Relative on-screen size per class, so a galaxy or supercluster reads bigger than
// a pulsar or exoplanet. Multiplied into the layer's base size.
export const GLYPH_SCALE = {
  ring: 1.0, blackhole: 1.15, pulsar: 0.9, supernova: 1.0, nebula: 1.25, exoplanet: 0.8,
  galaxy: 1.35, quasar: 1.1, transient: 1.0, hyperstar: 1.05, star: 0.85, open: 1.05,
  globular: 1.0, supercluster: 1.5, wall: 1.4, void: 1.4, attractor: 1.3, sparkle: 1.0,
};

export function makeGlyphAtlas() {
  const cv = document.createElement('canvas');
  cv.width = COLS * CELL; cv.height = ROWS * CELL;
  const ctx = cv.getContext('2d');
  for (const [name, idx] of Object.entries(GLYPH)) {
    ctx.save();
    ctx.translate((idx % COLS) * CELL, Math.floor(idx / COLS) * CELL);
    ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff';
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    drawGlyph(ctx, name);
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.flipY = false; tex.needsUpdate = true;
  return { texture: tex, cols: COLS, rows: ROWS };
}

const C = CELL / 2; // 64, cell centre
function drawGlyph(ctx, name) {
  switch (name) {
    case 'ring':
      ctx.lineWidth = 8; circle(ctx, C, C, 44); ctx.stroke(); break;

    case 'blackhole': // bright accretion annulus + thin photon ring, transparent core
      ctx.globalAlpha = 0.85; ctx.lineWidth = 15; circle(ctx, C, C, 40); ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineWidth = 4; circle(ctx, C, C, 24); ctx.stroke();
      ctx.globalAlpha = 1; break;

    case 'pulsar': { // twin beams + rotation ring + core
      ctx.globalAlpha = 0.45;
      tri(ctx, C, C, C - 15, 2, C + 15, 2); // up beam
      tri(ctx, C, C, C - 15, CELL - 2, C + 15, CELL - 2); // down beam
      ctx.globalAlpha = 1; ctx.lineWidth = 5; ellipse(ctx, C, C, 42, 15, 0); ctx.stroke();
      dot(ctx, C, C, 9); break;
    }

    case 'supernova': { // radiating spikes + core
      ctx.lineWidth = 5;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2, r0 = 15, r1 = k % 2 ? 40 : 52;
        line(ctx, C + Math.cos(a) * r0, C + Math.sin(a) * r0, C + Math.cos(a) * r1, C + Math.sin(a) * r1);
      }
      dot(ctx, C, C, 10); break;
    }

    case 'nebula': { // soft overlapping cloud lobes
      const blobs = [[C, C, 42], [C - 22, C + 8, 28], [C + 24, C - 6, 26], [C + 6, C + 22, 24], [C - 10, C - 20, 22]];
      for (const [x, y, r] of blobs) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; circle(ctx, x, y, r); ctx.fill();
      }
      ctx.fillStyle = '#fff'; break;
    }

    case 'exoplanet': // ringed planet
      ctx.globalAlpha = 1; dot(ctx, C, C, 20);
      ctx.lineWidth = 5; ctx.save(); ctx.translate(C, C); ctx.rotate(-0.42);
      ellipse(ctx, 0, 0, 46, 15, 0); ctx.stroke(); ctx.restore(); break;

    case 'galaxy': { // two logarithmic arms + core
      ctx.lineWidth = 6;
      for (let arm = 0; arm < 2; arm++) {
        ctx.beginPath();
        for (let t = 0; t <= 1.0001; t += 0.05) {
          const r = 6 + t * 46, a = arm * Math.PI + t * 3.2;
          const x = C + Math.cos(a) * r, y = C + Math.sin(a) * r * 0.72;
          t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      dot(ctx, C, C, 8); break;
    }

    case 'quasar': { // bright core + collimated jets + faint disc
      ctx.globalAlpha = 0.4; ctx.lineWidth = 5; ellipse(ctx, C, C, 40, 12, 0); ctx.stroke();
      ctx.globalAlpha = 0.9; ctx.lineWidth = 7;
      line(ctx, C, C, C, 4); line(ctx, C, C, C, CELL - 4);
      ctx.globalAlpha = 1; dot(ctx, C, C, 12);
      // glow
      const g = ctx.createRadialGradient(C, C, 0, C, C, 20);
      g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; circle(ctx, C, C, 20); ctx.fill(); ctx.fillStyle = '#fff'; break;
    }

    case 'transient': // expanding flash rings
      ctx.lineWidth = 4;
      ctx.globalAlpha = 1; circle(ctx, C, C, 16); ctx.stroke();
      ctx.globalAlpha = 0.6; circle(ctx, C, C, 30); ctx.stroke();
      ctx.globalAlpha = 0.3; circle(ctx, C, C, 46); ctx.stroke();
      ctx.globalAlpha = 1; dot(ctx, C, C, 7); break;

    case 'hyperstar': star(ctx, C, C, 5, 52, 22, -Math.PI / 2, true); break;

    case 'star': star(ctx, C, C, 4, 46, 14, -Math.PI / 2, true); break;

    case 'open': { // loose scatter of stars
      const pts = [[C, C - 30], [C - 32, C - 6], [C + 30, C - 12], [C - 14, C + 26], [C + 20, C + 24], [C + 4, C + 2], [C - 26, C + 30]];
      for (const [x, y] of pts) dot(ctx, x, y, 8); break;
    }

    case 'globular': { // dense concentrated ball of stars
      const g = ctx.createRadialGradient(C, C, 0, C, C, 50);
      g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.28)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; circle(ctx, C, C, 50); ctx.fill(); ctx.fillStyle = '#fff';
      let s = 7;
      const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
      for (let i = 0; i < 40; i++) {
        const a = rnd() * Math.PI * 2, r = Math.pow(rnd(), 0.6) * 46;
        dot(ctx, C + Math.cos(a) * r, C + Math.sin(a) * r, 3);
      }
      break;
    }

    case 'supercluster': { // hexagonal web node with satellites
      ctx.lineWidth = 5; ctx.beginPath();
      for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI * 2 - Math.PI / 2, x = C + Math.cos(a) * 44, y = C + Math.sin(a) * 44; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 - Math.PI / 2; dot(ctx, C + Math.cos(a) * 44, C + Math.sin(a) * 44, 5); }
      dot(ctx, C, C, 9); break;
    }

    case 'wall': { // a sheet: hatched slab
      ctx.lineWidth = 5; ctx.strokeRect(18, 30, CELL - 36, CELL - 60);
      ctx.lineWidth = 3; ctx.globalAlpha = 0.7;
      for (let x = 30; x < CELL - 24; x += 16) line(ctx, x, 32, x - 12, CELL - 32);
      ctx.globalAlpha = 1; break;
    }

    case 'void': // empty dashed circle
      ctx.lineWidth = 5; ctx.setLineDash([10, 9]); circle(ctx, C, C, 44); ctx.stroke(); ctx.setLineDash([]); break;

    case 'attractor': { // convergence target
      ctx.lineWidth = 4; circle(ctx, C, C, 20); ctx.stroke();
      ctx.globalAlpha = 0.6; circle(ctx, C, C, 40); ctx.stroke(); ctx.globalAlpha = 1;
      for (let k = 0; k < 4; k++) { // inward arrows
        const a = (k / 4) * Math.PI * 2; const ox = Math.cos(a), oy = Math.sin(a);
        const bx = C + ox * 54, by = C + oy * 54, tx = C + ox * 30, ty = C + oy * 30;
        line(ctx, bx, by, tx, ty);
        line(ctx, tx, ty, tx + Math.cos(a + 2.5) * 12, ty + Math.sin(a + 2.5) * 12);
        line(ctx, tx, ty, tx + Math.cos(a - 2.5) * 12, ty + Math.sin(a - 2.5) * 12);
      }
      dot(ctx, C, C, 6); break;
    }

    case 'sparkle': // 4-point diamond for user/imagined objects
      ctx.lineWidth = 6; ctx.beginPath();
      ctx.moveTo(C, 8); ctx.lineTo(CELL - 8, C); ctx.lineTo(C, CELL - 8); ctx.lineTo(8, C); ctx.closePath(); ctx.stroke();
      dot(ctx, C, C, 6); break;

    default: ctx.lineWidth = 8; circle(ctx, C, C, 44); ctx.stroke();
  }
}

// small canvas helpers
function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }
function dot(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function line(ctx, x0, y0, x1, y1) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
function tri(ctx, x0, y0, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.closePath(); ctx.fill(); }
function ellipse(ctx, x, y, rx, ry, rot) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); }
function star(ctx, cx, cy, points, rOuter, rInner, rot, fill) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? rInner : rOuter, a = rot + (i / (points * 2)) * Math.PI * 2;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath(); if (fill) ctx.fill(); else { ctx.lineWidth = 5; ctx.stroke(); }
}

// A 4-point sparkle/diamond used to distinguish user-contributed objects (kept for
// callers that want a standalone texture rather than the atlas).
export function makeSparkleTexture(color = '#ffffff') {
  const s = 64, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const ctx = cv.getContext('2d'); const c = s / 2;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(c, 6); ctx.lineTo(s - 6, c); ctx.lineTo(c, s - 6); ctx.lineTo(6, c); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.arc(c, c, 3, 0, Math.PI * 2); ctx.fill();
  const t = new THREE.CanvasTexture(cv); t.needsUpdate = true; return t;
}

// A targeting reticle (ring + crosshair ticks + centre dot) for the route tracker.
// Every stroke is laid down twice — a dark halo first, the bright colour on top —
// and the core is a white dot, so it reads crisply on a bright dense starfield as
// well as on the void (plain additive green washed out over the pink cosmic web).
export function makeReticleTexture(color = '#7bf0a0') {
  const s = 128, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const ctx = cv.getContext('2d'); const c = s / 2;
  ctx.lineCap = 'round';
  const RING = 38, TICK0 = 17, TICK1 = 54;
  const ring = (lw, stroke) => { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.beginPath(); ctx.arc(c, c, RING, 0, Math.PI * 2); ctx.stroke(); };
  const ticks = (lw, stroke) => {
    ctx.lineWidth = lw; ctx.strokeStyle = stroke;
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2, dx = Math.cos(a), dy = Math.sin(a);
      ctx.beginPath(); ctx.moveTo(c + dx * TICK0, c + dy * TICK0); ctx.lineTo(c + dx * TICK1, c + dy * TICK1); ctx.stroke();
    }
  };
  const halo = 'rgba(0,10,6,0.72)';
  ring(10, halo); ticks(9, halo);              // dark outline for contrast on any background
  ring(4.5, color); ticks(4, color);           // bright reticle
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(c, c, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(c, c, 4.5, 0, Math.PI * 2); ctx.fill();   // white ship core
  const t = new THREE.CanvasTexture(cv); t.needsUpdate = true; return t;
}

export function makeRingTexture(color = '#ffffff', dot = false) {
  const s = 64, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  ctx.strokeStyle = color; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - 7, 0, Math.PI * 2); ctx.stroke();
  if (dot) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(s / 2, s / 2, 4, 0, Math.PI * 2); ctx.fill(); }
  const t = new THREE.CanvasTexture(cv); t.needsUpdate = true; return t;
}
