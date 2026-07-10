import * as THREE from 'three';

// Draws an active voyage: a poly-line through the waypoints plus constant-size
// ring markers at each stop, with the current stop highlighted.
export class VoyageLayer {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.ring = makeRingTexture();
    this._built = null;
  }

  clear() {
    for (const o of [...this.group.children]) {
      this.group.remove(o);
      o.geometry?.dispose?.();
      o.material?.dispose?.();
    }
    this._built = null;
  }

  setVoyage(voyage) {
    this.clear();
    const pts = voyage.waypoints.map((w) => new THREE.Vector3(w.pos[0], w.pos[1], w.pos[2]));

    // route line
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffb454, transparent: true, opacity: 0.55 }));
    line.frustumCulled = false;
    this.group.add(line);

    // markers (constant screen size)
    const mGeo = new THREE.BufferGeometry();
    const arr = new Float32Array(pts.length * 3);
    pts.forEach((p, i) => { arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z; });
    mGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mMat = new THREE.PointsMaterial({
      size: 16, map: this.ring, sizeAttenuation: false, transparent: true,
      color: 0xffb454, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const markers = new THREE.Points(mGeo, mMat);
    markers.frustumCulled = false;
    this.group.add(markers);

    // current-stop highlight (single point)
    const cGeo = new THREE.BufferGeometry();
    cGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([pts[0].x, pts[0].y, pts[0].z]), 3));
    const cMat = new THREE.PointsMaterial({
      size: 30, map: this.ring, sizeAttenuation: false, transparent: true,
      color: 0x5ce1ff, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const current = new THREE.Points(cGeo, cMat);
    current.frustumCulled = false;
    this.group.add(current);

    this._built = { pts, current };
    this.setActive(0);
  }

  setActive(i) {
    if (!this._built) return;
    const p = this._built.pts[i];
    if (!p) return;
    const attr = this._built.current.geometry.getAttribute('position');
    attr.setXYZ(0, p.x, p.y, p.z);
    attr.needsUpdate = true;
  }

  setVisible(v) { this.group.visible = v; }
}

function makeRingTexture() {
  const s = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2 - 6, 0, Math.PI * 2);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}
