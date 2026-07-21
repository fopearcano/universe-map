import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { PC_TO_LY } from '../util/astro.js';

// Colour-grade + vignette pass. Runs last (after tone mapping / sRGB conversion)
// so exposure, contrast, saturation and vignette operate predictably on the final
// image. All neutral by default (exposure 1, contrast 1, saturation 1, vignette 0),
// so with defaults it's a straight pass-through.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uExposure: { value: 1.0 },
    uContrast: { value: 1.0 },
    uSaturation: { value: 1.0 },
    uVignette: { value: 0.0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float uExposure, uContrast, uSaturation, uVignette;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      c *= uExposure;                                   // brightness
      c = (c - 0.5) * uContrast + 0.5;                  // contrast around mid-grey
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));   // Rec.709 luma
      c = mix(vec3(l), c, uSaturation);                 // saturation
      vec2 q = vUv - 0.5;                               // vignette (radial darken)
      float vig = smoothstep(0.85, 0.25, length(q));
      c *= mix(1.0, vig, uVignette);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

// Tone-mapping presets exposed to the graphics panel.
const TONE_MAP = {
  none: THREE.NoToneMapping,
  aces: THREE.ACESFilmicToneMapping,
  reinhard: THREE.ReinhardToneMapping,
  cineon: THREE.CineonToneMapping,
};

// World units = parsecs. Sol at the origin.
export class Scene {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: false, logarithmicDepthBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Deep near-black background — the bloom lifts the frame a little, so the base
    // is darker than the object colours to keep the void reading as the void.
    this.renderer.setClearColor(0x010208, 1);

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
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.24, 0.78);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    // colour-grade + vignette, applied last on the final image (neutral by default)
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.bloomEnabled = true;
    this.toneMode = 'none';

    this._tween = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // Cinematic controls.
  setBloom(on) { this.bloomEnabled = on !== false; this.bloom.enabled = this.bloomEnabled; }
  setBloomParams({ strength, radius, threshold } = {}) {
    if (strength != null) this.bloom.strength = strength;
    if (radius != null) this.bloom.radius = radius;
    if (threshold != null) this.bloom.threshold = threshold;
  }
  // Filmic (ACES) tone mapping — rolls off highlights and deepens the shadows for
  // a moodier, darker frame. OutputPass reads renderer.toneMapping each frame.
  setToneMap(on) { this.setToneMapMode(on ? 'aces' : 'none'); }
  // Richer tone-map selector: 'none' | 'aces' | 'reinhard' | 'cineon'.
  setToneMapMode(mode) {
    this.toneMode = TONE_MAP[mode] != null ? mode : 'none';
    this.renderer.toneMapping = TONE_MAP[this.toneMode];
    this.renderer.toneMappingExposure = this.toneMode === 'aces' ? 1.15 : 1.0;
  }
  // Colour grade (partial update): exposure, contrast, saturation, vignette.
  setGrade({ exposure, contrast, saturation, vignette } = {}) {
    const u = this.grade.uniforms;
    if (exposure != null) u.uExposure.value = exposure;
    if (contrast != null) u.uContrast.value = contrast;
    if (saturation != null) u.uSaturation.value = saturation;
    if (vignette != null) u.uVignette.value = vignette;
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
    // Always render through the composer so tone-map + colour grade apply even
    // when bloom is off (the bloom pass toggles via its own `enabled` flag).
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}

function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
