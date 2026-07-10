import * as THREE from 'three';

// A labelled marker layer (ring sprites at constant screen size) used for star
// clusters and large-scale structures. Positions are world-space Vector3s; each
// item carries a colour and a label.
export class MarkerLayer {
  constructor(items, { size = 13, ring } = {}) {
    this.items = items; // [{ pos: Vector3, color: [r,g,b], label, data }]
    this.positions = items.map((it) => it.pos.clone());
    const N = items.length;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    items.forEach((it, i) => {
      pos[i * 3] = it.pos.x; pos[i * 3 + 1] = it.pos.y; pos[i * 3 + 2] = it.pos.z;
      col[i * 3] = it.color[0]; col[i * 3 + 1] = it.color[1]; col[i * 3 + 2] = it.color[2];
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uSize: { value: size }, uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }, uMap: { value: ring } },
      vertexShader: /* glsl */`
        attribute vec3 aColor; uniform float uSize, uPixelRatio; varying vec3 vColor;
        void main(){ vColor=aColor; gl_PointSize=uSize*uPixelRatio; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uMap; varying vec3 vColor;
        void main(){ vec4 t=texture2D(uMap, gl_PointCoord); if(t.a<0.05) discard; gl_FragColor=vec4(vColor, t.a); }`,
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

export function makeRingTexture(color = '#ffffff', dot = false) {
  const s = 64, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  ctx.strokeStyle = color; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - 7, 0, Math.PI * 2); ctx.stroke();
  if (dot) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(s / 2, s / 2, 4, 0, Math.PI * 2); ctx.fill(); }
  const t = new THREE.CanvasTexture(cv); t.needsUpdate = true; return t;
}
