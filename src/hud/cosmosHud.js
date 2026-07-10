import { comovingMpc, MPC_TO_LY } from '../util/cosmology.js';

// Cosmos-mode dock panels: redshift/object filters, survey layers, and the legend.

export function buildCosmosFilters(app) {
  const root = document.getElementById('tab-filters');
  const layers = app.cosmos.data.layers;
  root.innerHTML = `
    <div class="muted" style="margin-bottom:10px">Peel back the universe by redshift and toggle the catalogues that populate each shell.</div>
    <div class="ctl">
      <label>Redshift z ≤ <span class="val" id="c-z-v">6.0</span></label>
      <input type="range" id="c-z" min="0.01" max="6" step="0.01" value="6" />
      <div class="muted" id="c-z-d">look-back to the cosmic horizon</div>
    </div>
    <div class="ctl">
      <label>Object catalogues</label>
      <div class="toggle on" data-l="starCore"><span>Milky Way stars</span><span class="sw"></span></div>
      <div class="toggle on" data-l="localGroup"><span>Local Group galaxies</span><span class="sw"></span></div>
      <div class="toggle on" data-l="twomrs"><span>2MRS galaxies · ${fmt(layers.twomrs.count)}</span><span class="sw"></span></div>
      <div class="toggle on" data-l="sdssGal"><span>SDSS galaxies · ${fmt(layers.sdssGal.count)}</span><span class="sw"></span></div>
      <div class="toggle on" data-l="sdssQso"><span>SDSS quasars · ${fmt(layers.sdssQso.count)}</span><span class="sw"></span></div>
    </div>
    <div class="hr"></div>
    <div class="ctl">
      <label>Object size <span class="val" id="c-size-v">1.0×</span></label>
      <input type="range" id="c-size" min="0.4" max="3" step="0.1" value="1" />
    </div>
    <button class="btn" id="c-reset">↺ reset</button>`;

  const z = root.querySelector('#c-z'), zv = root.querySelector('#c-z-v'), zd = root.querySelector('#c-z-d');
  z.oninput = () => {
    const val = +z.value; zv.textContent = val.toFixed(2);
    const gly = (comovingMpc(val) * MPC_TO_LY / 1e9).toFixed(1);
    zd.textContent = `shows out to ≈ ${gly} Gly`;
    app.setCosmosFilter({ zMax: val });
  };

  const show = { starCore: true, localGroup: true, twomrs: true, sdssGal: true, sdssQso: true };
  root.querySelectorAll('.toggle').forEach((el) => {
    el.onclick = () => { el.classList.toggle('on'); show[el.dataset.l] = el.classList.contains('on'); app.setCosmosFilter({ show: { ...show } }); };
  });

  const size = root.querySelector('#c-size'), sv = root.querySelector('#c-size-v');
  size.oninput = () => { sv.textContent = (+size.value).toFixed(1) + '×'; app.setCosmosFilter({ sizeScale: +size.value }); };

  root.querySelector('#c-reset').onclick = () => {
    z.value = 6; zv.textContent = '6.0'; zd.textContent = 'look-back to the cosmic horizon';
    size.value = 1; sv.textContent = '1.0×';
    for (const k in show) show[k] = true;
    root.querySelectorAll('.toggle').forEach((el) => el.classList.add('on'));
    app.setCosmosFilter({ zMax: 6, sizeScale: 1, show: { ...show, cmb: true } });
  };

  app.setCosmosFilter({ zMax: 6, sizeScale: 1, show: { ...show, cmb: true } });
}

export function buildCosmosLayers(app) {
  const root = document.getElementById('tab-layers');
  const m = app.cosmos.data.meta;
  root.innerHTML = `
    <div class="muted" style="margin-bottom:10px">Reference shells & the cosmic microwave background.</div>
    <div class="toggle on" data-l="cmb"><span>CMB boundary shell</span><span class="sw"></span></div>
    <button class="btn" id="c-home" style="margin-top:10px">⌂ recenter on the Sun</button>
    <div class="hr"></div>
    <div class="muted" style="line-height:1.7">
      <b style="color:var(--cyan)">Distance colour</b><br>
      <span style="display:flex;height:8px;border-radius:4px;margin:4px 0;
        background:linear-gradient(90deg,#8ce6ff,#85ffb8,#ffea6a,#ff9e52,#ff6161,#c7395f)"></span>
      near · Local Group → far · cosmic horizon
    </div>
    <div class="hr"></div>
    <div class="muted" style="line-height:1.7">
      cosmology · flat ΛCDM (Planck 2018)<br>
      H₀ ${m.cosmology.H0} · Ωm ${m.cosmology.OmegaM.toFixed(3)} · ΩΛ ${m.cosmology.OmegaL.toFixed(3)}<br>
      radius plotted on a logarithmic scale (${m.decadeUnit} units / decade)<br>
      CMB shell z≈${m.cmb.z} · ${(m.cmb.radiusLy / 1e9).toFixed(1)} Gly radius<br>
      observable diameter ≈ ${m.cmb.diameterGly.toFixed(0)} Gly<br>
      <span style="color:var(--dim)">CMB map: real WMAP 9-yr ILC, reprojected to equatorial</span>
    </div>`;
  const cmb = root.querySelector('[data-l="cmb"]');
  cmb.onclick = () => { cmb.classList.toggle('on'); app.setCosmosFilter({ show: { cmb: cmb.classList.contains('on') } }); };
  root.querySelector('#c-home').onclick = () => app.home();
}

function fmt(n) { return n.toLocaleString('en-US'); }
