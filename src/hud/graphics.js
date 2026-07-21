// The GRAPHICS panel — a floating, draggable tools panel (opened from the top
// dock's ◧ button) that gathers every look-and-feel control in one place:
//   · Look presets      — one-click styles (Deep Space, Neon, Documentary, …)
//   · Post-FX & grade   — bloom (glow / threshold / radius), exposure, contrast,
//                          saturation, vignette, tone-map mode, star twinkle
//   · Per-layer visuals — size, brightness (glow) and tint per catalogue, chosen
//                          from a mode-aware layer picker
// All state lives on the app (app.cine + app.layerStyle, both persisted); this
// module is a thin view that reads it and calls the app's setters.

const PRESETS = [
  ['deepspace', 'Deep Space'], ['neon', 'Neon'], ['documentary', 'Documentary'],
  ['bright', 'Bright'], ['mono', 'Mono'],
];
const TONES = [['none', 'None'], ['aces', 'ACES'], ['reinhard', 'Reinhard'], ['cineon', 'Cineon']];

// per-mode layer registry: [key, label]
const LAYERS = {
  local: [['stars', 'Stars']],
  cosmos: [
    ['starcore', 'Milky Way stars'], ['twomrs', '2MRS galaxies'], ['sdssgal', 'SDSS galaxies'],
    ['sdssqso', 'SDSS quasars'], ['proc', 'Procedural fill'], ['bridge', 'Galactic bridge'],
  ],
  deeptime: [['dt', 'Groups & galaxies']],
  system: [],
};
const LAYER_DEF = { size: 1, gain: 1, tint: [1, 1, 1], tintAmt: 0 };

export function initGraphics(app) {
  const el = document.createElement('div');
  el.id = 'gfxpanel';
  el.className = 'pnl-off';   // hidden until opened from the dock
  document.body.appendChild(el);

  let selLayer = null;        // currently-edited per-layer key

  const slider = (id, label, min, max, step, sub) => `
    <div class="gfx-row">
      <label>${label}<span class="gfx-v" id="${id}-v"></span></label>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${step}">
      ${sub ? `<div class="gfx-sub">${sub}</div>` : ''}
    </div>`;

  function build() {
    const layers = LAYERS[app.mode] || [];
    if (!layers.some((l) => l[0] === selLayer)) selLayer = layers[0]?.[0] ?? null;
    el.innerHTML = `
      <div class="gfx-h"><span class="gfx-t">◧ GRAPHICS</span><button class="gfx-x" title="hide (bring back from the top toolbar)">✕</button></div>
      <div class="gfx-body">
        <div class="gfx-sec-t">Look presets</div>
        <div class="gfx-presets">
          ${PRESETS.map(([k, l]) => `<button class="gfx-preset" data-preset="${k}">${l}</button>`).join('')}
          <button class="gfx-preset gfx-reset" data-preset="__reset" title="reset every graphics control">↺ reset</button>
        </div>

        <div class="hr"></div>
        <div class="gfx-sec-t">Post-FX &amp; colour grade</div>
        <div class="toggle" data-cine="bloom"><span>Glow <span class="muted">· bloom</span></span><span class="sw"></span></div>
        ${slider('gfx-glow', 'Glow strength', 0.1, 1.6, 0.01)}
        ${slider('gfx-threshold', 'Glow threshold', 0, 1, 0.01, 'lower = more objects glow')}
        ${slider('gfx-radius', 'Glow radius', 0, 1.2, 0.01, 'halo spread')}
        ${slider('gfx-exposure', 'Exposure', 0.3, 2.2, 0.01)}
        ${slider('gfx-contrast', 'Contrast', 0.5, 1.8, 0.01)}
        ${slider('gfx-saturation', 'Saturation', 0, 2, 0.01)}
        ${slider('gfx-vignette', 'Vignette', 0, 1, 0.01)}
        <div class="gfx-row">
          <label>Tone mapping</label>
          <div class="seg gfx-tone">${TONES.map(([k, l]) => `<button class="segbtn" data-tone="${k}">${l}</button>`).join('')}</div>
        </div>
        <div class="toggle" data-cine="twinkle"><span>Star twinkle</span><span class="sw"></span></div>

        <div class="hr"></div>
        <div class="gfx-sec-t">Per-layer visuals</div>
        ${layers.length ? `
          <div class="gfx-row">
            <label>Layer</label>
            <select id="gfx-layer">${layers.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
          </div>
          ${slider('gfx-lsize', 'Size', 0.3, 3, 0.01)}
          ${slider('gfx-lgain', 'Brightness / glow', 0.2, 3, 0.01)}
          <div class="gfx-row gfx-tint-row">
            <label>Tint <span class="gfx-v" id="gfx-ltintamt-v"></span></label>
            <div class="gfx-tint">
              <input type="color" id="gfx-ltint" />
              <input type="range" id="gfx-ltintamt" min="0" max="1" step="0.01" title="tint amount" />
            </div>
          </div>
          <button class="btn sm" id="gfx-lreset">↺ reset this layer</button>
        ` : '<div class="muted">No adjustable layers in this mode.</div>'}
      </div>`;

    // ---- wire: presets ----
    el.querySelectorAll('[data-preset]').forEach((b) => {
      b.onclick = () => { b.dataset.preset === '__reset' ? app.resetGraphics() : app.applyGraphicsPreset(b.dataset.preset); };
    });
    // ---- wire: cinematic toggles ----
    el.querySelectorAll('[data-cine]').forEach((t) => {
      t.onclick = () => { t.classList.toggle('on'); app.setCinematic(t.dataset.cine, t.classList.contains('on')); };
    });
    // ---- wire: bloom + grade sliders ----
    bindSlider('gfx-glow', (v) => app.setGlow(v), (v) => `${v.toFixed(2)}×`);
    bindSlider('gfx-threshold', (v) => app.setBloomThreshold(v), (v) => v.toFixed(2));
    bindSlider('gfx-radius', (v) => app.setBloomRadius(v), (v) => v.toFixed(2));
    bindSlider('gfx-exposure', (v) => app.setGrade({ exposure: v }), (v) => `${v.toFixed(2)}×`);
    bindSlider('gfx-contrast', (v) => app.setGrade({ contrast: v }), (v) => `${v.toFixed(2)}×`);
    bindSlider('gfx-saturation', (v) => app.setGrade({ saturation: v }), (v) => `${v.toFixed(2)}×`);
    bindSlider('gfx-vignette', (v) => app.setGrade({ vignette: v }), (v) => v.toFixed(2));
    // ---- wire: tone map ----
    el.querySelectorAll('[data-tone]').forEach((b) => { b.onclick = () => app.setToneMapMode(b.dataset.tone); });
    // ---- wire: per-layer ----
    const lsel = el.querySelector('#gfx-layer');
    if (lsel) lsel.onchange = () => { selLayer = lsel.value; syncLayer(); };
    bindSlider('gfx-lsize', (v) => selLayer && app.setLayerStyle(selLayer, { size: v }), (v) => `${v.toFixed(2)}×`);
    bindSlider('gfx-lgain', (v) => selLayer && app.setLayerStyle(selLayer, { gain: v }), (v) => `${v.toFixed(2)}×`);
    const tint = el.querySelector('#gfx-ltint');
    if (tint) tint.oninput = () => selLayer && app.setLayerStyle(selLayer, { tint: fromHex(tint.value), tintAmt: Math.max(0.001, curLayer().tintAmt || 0.6) });
    bindSlider('gfx-ltintamt', (v) => selLayer && app.setLayerStyle(selLayer, { tintAmt: v }), null, '#gfx-ltintamt-v', (v) => `${Math.round(v * 100)}%`);
    const lreset = el.querySelector('#gfx-lreset');
    if (lreset) lreset.onclick = () => { if (selLayer) { app.setLayerStyle(selLayer, { ...LAYER_DEF }); syncLayer(); } };

    el.querySelector('.gfx-x')?.addEventListener('click', () => { el.classList.add('pnl-off'); app._syncDock?.(); });
    syncValues();
  }

  // set a slider's value + label from state without firing its handler
  function setSlider(id, val, fmt, vId) {
    const s = el.querySelector('#' + id); if (!s) return;
    s.value = val;
    const lbl = el.querySelector(vId || `#${id}-v`); if (lbl && fmt) lbl.textContent = fmt(+val);
  }
  function bindSlider(id, apply, fmt, vId, vFmt) {
    const s = el.querySelector('#' + id); if (!s) return;
    s.oninput = () => {
      const v = +s.value; apply(v);
      const lbl = el.querySelector(vId || `#${id}-v`); if (lbl && (vFmt || fmt)) lbl.textContent = (vFmt || fmt)(v);
    };
  }
  function curLayer() { return { ...LAYER_DEF, ...(selLayer ? app.getLayerStyle(selLayer) : {}) }; }

  // reflect the whole render state (bloom + grade + toggles + preset highlight)
  function syncValues() {
    const c = app.cine;
    el.querySelector('[data-cine="bloom"]')?.classList.toggle('on', !!c.bloom);
    el.querySelector('[data-cine="twinkle"]')?.classList.toggle('on', !!c.twinkle);
    setSlider('gfx-glow', c.glow, (v) => `${v.toFixed(2)}×`);
    setSlider('gfx-threshold', c.threshold, (v) => v.toFixed(2));
    setSlider('gfx-radius', c.radius, (v) => v.toFixed(2));
    setSlider('gfx-exposure', c.exposure, (v) => `${v.toFixed(2)}×`);
    setSlider('gfx-contrast', c.contrast, (v) => `${v.toFixed(2)}×`);
    setSlider('gfx-saturation', c.saturation, (v) => `${v.toFixed(2)}×`);
    setSlider('gfx-vignette', c.vignette, (v) => v.toFixed(2));
    el.querySelectorAll('[data-tone]').forEach((b) => b.classList.toggle('on', b.dataset.tone === c.tonemap));
    el.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('on', b.dataset.preset === c.preset));
    syncLayer();
  }
  function syncLayer() {
    if (!selLayer) return;
    const lsel = el.querySelector('#gfx-layer'); if (lsel) lsel.value = selLayer;
    const st = curLayer();
    setSlider('gfx-lsize', st.size, (v) => `${v.toFixed(2)}×`);
    setSlider('gfx-lgain', st.gain, (v) => `${v.toFixed(2)}×`);
    const tint = el.querySelector('#gfx-ltint'); if (tint) tint.value = toHex(st.tint);
    setSlider('gfx-ltintamt', st.tintAmt, (v) => `${Math.round(v * 100)}%`, '#gfx-ltintamt-v');
  }

  build();
  app.on('graphics', () => syncValues());
  app.on('mode', () => build());  // per-layer list is mode-aware
}

// [r,g,b] in 0..1  ↔  #rrggbb
function toHex(rgb) {
  const h = (rgb || [1, 1, 1]).map((c) => Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, '0'));
  return '#' + h.join('');
}
function fromHex(hex) {
  const h = String(hex || '#ffffff').replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
