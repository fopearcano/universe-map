import * as THREE from 'three';

// Flat, camera-facing image billboards: the real sky cutout of a galaxy shown as
// a floating quad at its position in the COSMOS view (alongside the point-cloud
// data). Textures are fetched lazily from CDS hips2fits (CORS-enabled) the first
// time the layer is shown. Additive blending means the image's black background
// drops out, so each galaxy floats as light, not a black card.
export class GalaxyBillboards {
  constructor(parent, items, { loadTexture } = {}) {
    this.items = items;            // [{ pos:Vector3, size, ... }]
    this.loadTexture = loadTexture; // async (item) => THREE.Texture | null (auto-picks survey)
    this.meshes = [];
    this._loaded = false;
    this.group = new THREE.Group();
    this.group.visible = false;
    parent.add(this.group);
  }

  setVisible(v) { this.group.visible = v; if (v) this._load(); }

  _load() {
    if (this._loaded) return;
    this._loaded = true;
    for (const it of this.items) {
      const geo = new THREE.PlaneGeometry(it.size, it.size);
      const mat = new THREE.MeshBasicMaterial({
        transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(it.pos);
      m.frustumCulled = false;
      this.group.add(m);
      this.meshes.push(m);
      this.loadTexture(it)
        .then((tex) => { if (!tex) return; tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true; mat.map = tex; mat.opacity = 0.92; mat.needsUpdate = true; })
        .catch(() => { /* offline / blocked — leave the quad invisible */ });
    }
  }

  // billboard: face the camera every frame
  update(camera) {
    if (!this.group.visible) return;
    for (const m of this.meshes) m.quaternion.copy(camera.quaternion);
  }

  loadedCount() { return this.meshes.filter((m) => m.material.map).length; }
}
