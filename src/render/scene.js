import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { PC_TO_LY } from '../util/astro.js';

// World units = parsecs. Sol at the origin.
export class Scene {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: false, logarithmicDepthBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x04070d, 1);

    this.scene = new THREE.Scene();
    this.scene.fog = null;

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 30000);
    this.camera.position.set(14, 9, 17);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.7;
    this.controls.zoomSpeed = 1.1;
    this.controls.panSpeed = 0.8;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 0.02;
    this.controls.maxDistance = 6000;
    this.controls.target.set(0, 0, 0);

    this.reference = this._buildReference();
    this.scene.add(this.reference.group);

    // ---- cinematic post-processing: bloom glow over the whole starfield ----
    // The HUD is DOM overlaid on the canvas, so this never touches the UI.
    const pr = this.renderer.getPixelRatio();
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(pr);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.45, 0.4, 0.7);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.bloomEnabled = true;

    this._tween = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // Cinematic bloom controls (no UI — programmatic).
  setBloom(on) { this.bloomEnabled = on !== false; }
  setBloomParams({ strength, radius, threshold } = {}) {
    if (strength != null) this.bloom.strength = strength;
    if (radius != null) this.bloom.radius = radius;
    if (threshold != null) this.bloom.threshold = threshold;
  }

  // ---- reference infographic geometry: equatorial plane rings + axes + Sol cross ----
  _buildReference() {
    const group = new THREE.Group();
    const ringRadii = [5, 10, 25, 50, 100, 250, 500];
    const ringMat = new THREE.LineBasicMaterial({ color: 0x2c5566, transparent: true, opacity: 0.55 });
    const rings = new THREE.Group();
    const ringLabels = [];
    for (const r of ringRadii) {
      const seg = 128;
      const pts = [];
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      rings.add(new THREE.Line(g, ringMat));
      ringLabels.push({ pos: new THREE.Vector3(r * 0.707, r * 0.707, 0), text: `${Math.round(r * PC_TO_LY)} ly`, cls: 'lbl-ring' });
    }
    group.add(rings);

    // axes: +x (RA 0h), +z (north celestial pole)
    const axisLen = 260;
    const mkAxis = (dir, color) => {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), dir.clone().multiplyScalar(axisLen)]);
      return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.4 }));
    };
    const axes = new THREE.Group();
    axes.add(mkAxis(new THREE.Vector3(1, 0, 0), 0x3a6b7a));
    axes.add(mkAxis(new THREE.Vector3(0, 0, 1), 0x5a4a7a));
    group.add(axes);
    const axisLabels = [
      { pos: new THREE.Vector3(axisLen, 0, 0), text: 'RA 0h', cls: 'lbl-axis' },
      { pos: new THREE.Vector3(0, 0, axisLen), text: 'NCP +90°', cls: 'lbl-axis' },
    ];

    // Sol origin cross
    const sol = new THREE.Group();
    const crossMat = new THREE.LineBasicMaterial({ color: 0xffdf9a, transparent: true, opacity: 0.8 });
    const s = 0.9;
    for (const d of [[s, 0, 0], [0, s, 0], [0, 0, s]]) {
      const v = new THREE.Vector3(...d);
      sol.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([v.clone().negate(), v]), crossMat));
    }
    group.add(sol);

    return { group, rings, axes, labels: [...ringLabels, ...axisLabels] };
  }

  setReferenceVisible(v) { this.reference.group.visible = v; }
  setRingsVisible(v) { this.reference.rings.visible = v; }
  setAxesVisible(v) { this.reference.axes.visible = v; }

  // Instantly place the camera (used on mode switches).
  setView(pos, target) {
    this._tween = null;
    this.camera.position.copy(pos);
    this.controls.target.copy(target);
    this.controls.update();
  }

  // ---- camera flight ----
  flyTo(targetVec, opts = {}) {
    const target = targetVec.clone();
    const distFromSol = target.length();
    let camPos;
    if (opts.camPos) {
      camPos = opts.camPos.clone();
    } else {
      const approach = opts.approach ?? clamp(0.06 * distFromSol, 1.4, 30);
      // approach from the Sun-facing side so Sol stays in context, lifted a little.
      let dir;
      if (distFromSol < 1e-4) dir = new THREE.Vector3(0.6, 0.4, 0.8).normalize();
      else dir = target.clone().normalize().multiplyScalar(-0.85).add(new THREE.Vector3(0, 0, 0.5)).normalize();
      camPos = target.clone().add(dir.multiplyScalar(approach));
    }
    this._tween = {
      fromPos: this.camera.position.clone(), toPos: camPos,
      fromTarget: this.controls.target.clone(), toTarget: target,
      t: 0, dur: opts.dur ?? 1.1,
    };
  }

  update(dt) {
    if (this._tween) {
      const tw = this._tween;
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const k = easeInOut(tw.t);
      this.camera.position.lerpVectors(tw.fromPos, tw.toPos, k);
      this.controls.target.lerpVectors(tw.fromTarget, tw.toTarget, k);
      if (tw.t >= 1) this._tween = null;
    }
    this.controls.update();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.setSize(w, h); this.bloom.setSize(w, h); }
  }

  render() {
    if (this.bloomEnabled && this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}

function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
