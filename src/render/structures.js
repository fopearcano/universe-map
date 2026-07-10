import * as THREE from 'three';
import { structureCloud } from './morphology.js';

// A single merged point cloud that resolves many structured objects (galaxies,
// clusters) into their illustrative shapes, with GPU level-of-detail: each point
// carries its cloud centre, and the vertex shader fades it in only when the
// camera is close, so far-away structures stay as their icon/point and near ones
// bloom into shape. One draw call; per-frame cost is a single uniform update.
export class StructureShapes {
  constructor(targets, { near = 1.6, far = 6.5, size = 1.7 } = {}) {
    // targets: [{ center: Vector3, morph, R, seed }]
    const parts = targets.map((t) => ({ t, cloud: structureCloud(t.morph, t.R, t.seed) }));
    let total = 0;
    for (const p of parts) total += p.cloud.positions.length / 3;

    const pos = new Float32Array(total * 3), cen = new Float32Array(total * 3), col = new Float32Array(total * 3);
    let o = 0;
    for (const { t, cloud } of parts) {
      const n = cloud.positions.length / 3;
      for (let i = 0; i < n; i++) {
        const j = (o + i) * 3;
        pos[j] = cloud.positions[i * 3] + t.center.x;
        pos[j + 1] = cloud.positions[i * 3 + 1] + t.center.y;
        pos[j + 2] = cloud.positions[i * 3 + 2] + t.center.z;
        cen[j] = t.center.x; cen[j + 1] = t.center.y; cen[j + 2] = t.center.z;
        col[j] = cloud.colors[i * 3]; col[j + 1] = cloud.colors[i * 3 + 1]; col[j + 2] = cloud.colors[i * 3 + 2];
      }
      o += n;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aCenter', new THREE.BufferAttribute(cen, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uCam: { value: new THREE.Vector3() },
        uNear: { value: near }, uFar: { value: far }, uSize: { value: size },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: /* glsl */`
        attribute vec3 aColor; attribute vec3 aCenter;
        uniform vec3 uCam; uniform float uNear, uFar, uSize, uPixelRatio;
        varying vec3 vColor; varying float vFade;
        void main(){
          vColor = aColor;
          float d = distance(uCam, aCenter);
          vFade = 1.0 - smoothstep(uNear, uFar, d);   // 1 near, 0 far
          gl_PointSize = uSize * vFade * uPixelRatio;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vColor; varying float vFade;
        void main(){
          if (vFade < 0.02) discard;
          vec2 uv = gl_PointCoord - 0.5;
          float dd = length(uv);
          if (dd > 0.5) discard;
          float a = smoothstep(0.5, 0.0, dd) * vFade * 0.85;
          gl_FragColor = vec4(vColor, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.mat = mat;
    this._cam = new THREE.Vector3();
  }

  setVisible(v) { this.points.visible = v; }
  update(camera) { camera.getWorldPosition(this._cam); this.mat.uniforms.uCam.value.copy(this._cam); }
}
