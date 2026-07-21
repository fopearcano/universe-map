import { comovingMpc, MPC_TO_LY } from '../util/cosmology.js';
import { ROUTE_GROUPS } from '../data/routeGroups.js';
import { cinematicSection, wireCinematic } from './cinematic.js';

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
      <div class="toggle on" data-l="bridge"><span>Galactic bridge <span class="muted">· cyan · modelled</span></span><span class="sw"></span></div>
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

  const show = { starCore: true, bridge: true, localGroup: true, twomrs: true, sdssGal: true, sdssQso: true };
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
    // CMB image stays off on reset — keep the Layers-tab checkbox in sync.
    document.querySelector('#tab-layers [data-l="cmb"]')?.classList.remove('on');
    app.setCosmosFilter({ zMax: 6, sizeScale: 1, show: { ...show, cmb: false } });
  };

  app.setCosmosFilter({ zMax: 6, sizeScale: 1, show: { ...show, cmb: false } });
}

export function buildCosmosLayers(app) {
  const root = document.getElementById('tab-layers');
  const m = app.cosmos.data.meta;
  root.innerHTML = `
    <div class="muted" style="margin-bottom:10px">Structures, clusters & the cosmic microwave background.</div>
    <div class="toggle on" data-l="structures"><span>Large-scale structures</span><span class="sw"></span></div>
    <div class="toggle on" data-l="clusters"><span>Star clusters</span><span class="sw"></span></div>
    <div class="toggle on" data-l="atlas"><span>Cosmic atlas objects</span><span class="sw"></span></div>
    <div class="toggle on" data-l="custom"><span>My library (✦ custom)</span><span class="sw"></span></div>
    <div class="toggle" data-l="sector"><span>Sector grid <span class="muted">· map</span></span><span class="sw"></span></div>
    <div class="toggle ${app.showScaleBar !== false ? 'on' : ''}" data-l="scalebar"><span>True-scale ribbon <span class="muted">· linear</span></span><span class="sw"></span></div>
    <div class="toggle on" data-l="resolve"><span>Resolve galaxies (shapes)</span><span class="sw"></span></div>
    <div class="toggle" data-l="clustershapes"><span>Star cluster shapes</span><span class="sw"></span></div>
    <div class="toggle" data-l="voids"><span>Supervoid zones <span class="muted">· shapes</span></span><span class="sw"></span></div>
    <div class="toggle" data-l="ways"><span>Trade &amp; war routes <span class="muted">· ⟿ Ledger of Ways</span></span><span class="sw"></span></div>
    <div class="ways-box" id="c-ways" hidden></div>
    <div class="toggle" data-l="imagery"><span>Galaxy imagery <span class="muted">· HiPS</span></span><span class="sw"></span></div>
    <div class="toggle ${app.cosmos.state.show.procedural ? 'on' : ''}" data-l="procedural"><span>Procedural fill <span class="muted">· imagined</span></span><span class="sw"></span></div>
    <div class="seg" id="c-proc-color" ${app.cosmos.state.show.procedural ? '' : 'hidden'}>
      <button class="segbtn ${app.cosmos.procMode === 'green' ? 'on' : ''}" data-pc="green">green</button>
      <button class="segbtn ${app.cosmos.procMode === 'match' ? 'on' : ''}" data-pc="match">match data</button>
    </div>
    <div class="muted" id="c-proc-note" style="margin:-2px 0 6px"></div>
    <div class="seg" id="c-proc-density" ${app.cosmos.state.show.procedural ? '' : 'hidden'}>
      <button class="segbtn ${app.cosmos.densityMode() === 'standard' ? 'on' : ''}" data-dn="standard">standard</button>
      <button class="segbtn ${app.cosmos.densityMode() === 'ultra' ? 'on' : ''}" data-dn="ultra" title="personal high-density mode — needs a beefy GPU (3090+)">ultra · 3090+</button>
    </div>
    <div class="muted" id="c-proc-density-note" style="margin:-2px 0 6px"></div>
    <div class="toggle ${app.cosmos.state.show.cmb ? 'on' : ''}" data-l="cmb"><span>CMB radiation image <span class="muted">· off by default</span></span><span class="sw"></span></div>
    <div class="ctl" style="margin-top:10px">
      <label>CMB radiation opacity <span class="val" id="c-cmb-v">auto</span></label>
      <input type="range" id="c-cmb-op" min="0" max="100" step="1" value="0" />
      <div class="muted">0 = auto-fade with distance</div>
    </div>
    <button class="btn" id="c-home" style="margin-top:6px">⌂ recenter on the Sun</button>
    ${cinematicSection(app)}
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
  const structs = root.querySelector('[data-l="structures"]');
  structs.onclick = () => { structs.classList.toggle('on'); app.setLayerVisible('structures', structs.classList.contains('on')); };
  const clus = root.querySelector('[data-l="clusters"]');
  clus.onclick = () => { clus.classList.toggle('on'); app.setLayerVisible('clusters', clus.classList.contains('on')); };
  const atl = root.querySelector('[data-l="atlas"]');
  atl.onclick = () => { atl.classList.toggle('on'); app.setLayerVisible('atlas', atl.classList.contains('on')); };
  const cus = root.querySelector('[data-l="custom"]');
  cus.onclick = () => { cus.classList.toggle('on'); app.setLayerVisible('custom', cus.classList.contains('on')); };
  // Resolve structures: procedural galaxy/cluster shapes on approach (LOD)
  const sector = root.querySelector('[data-l="sector"]');
  sector.classList.toggle('on', !!app.showSectorGrid);
  sector.onclick = () => { sector.classList.toggle('on'); app.setSectorGrid(sector.classList.contains('on')); };
  const scalebar = root.querySelector('[data-l="scalebar"]');
  scalebar.onclick = () => { scalebar.classList.toggle('on'); app.setScaleBar(scalebar.classList.contains('on')); };
  wireCinematic(root, app);
  const res = root.querySelector('[data-l="resolve"]');
  res.classList.toggle('on', !!app.resolveStructures);
  res.onclick = () => { res.classList.toggle('on'); app.setResolveStructures(res.classList.contains('on')); };
  const clsh = root.querySelector('[data-l="clustershapes"]');
  clsh.classList.toggle('on', !!app.showClusterShapes);
  clsh.onclick = () => { clsh.classList.toggle('on'); app.setClusterShapes(clsh.classList.contains('on')); };
  const voids = root.querySelector('[data-l="voids"]');
  voids.classList.toggle('on', !!app.showVoids);
  voids.onclick = () => { voids.classList.toggle('on'); app.setVoids(voids.classList.contains('on')); };
  // ⟿ Ledger of Ways — the trade & war route overlay + browser
  const ways = root.querySelector('[data-l="ways"]');
  const waysBox = root.querySelector('#c-ways');
  ways.classList.toggle('on', !!app.showRouteNetwork);
  const MAX_ROWS = 220;
  const buildWays = () => {
    // flagships (curated) first, then the procedural spread
    const list = app.tradeRouteList().sort((a, b) => (a.id.startsWith('way-') ? 1 : 0) - (b.id.startsWith('way-') ? 1 : 0));
    let text = '';
    const nComm = list.filter((r) => r.category === 'commercial').length;
    // per-group on/off state, keyed "cat:group" — all on to start
    const on = {};
    const count = {};
    for (const cat of ['commercial', 'military']) for (const g of ROUTE_GROUPS[cat]) { const k = `${cat}:${g.key}`; on[k] = true; count[k] = 0; }
    for (const r of list) { const k = `${r.category}:${r.group}`; if (k in count) count[k]++; }
    const catOn = (cat) => ROUTE_GROUPS[cat].every((g) => on[`${cat}:${g.key}`]);
    const catAny = (cat) => ROUTE_GROUPS[cat].some((g) => on[`${cat}:${g.key}`]);

    const catBlock = (cat, col, name) => `
      <div class="ways-gcat">
        <label class="ways-gc-h" style="--wc:${col}"><input type="checkbox" data-catall="${cat}" checked> ${name} <span class="muted">${fmt(list.filter((r) => r.category === cat).length)}</span></label>
        ${ROUTE_GROUPS[cat].map((g) => `<label class="ways-gc"><input type="checkbox" data-gkey="${cat}:${g.key}" checked> <span class="ways-gdot" style="background:${col}"></span>${esc(g.label)} <span class="muted">${fmt(count[`${cat}:${g.key}`] || 0)}</span></label>`).join('')}
      </div>`;

    const row = (r) => `<div class="ways-row" data-way="${r.id}" title="${esc(r.lore)}">
        <div class="ways-r1"><span class="ways-dot" style="background:${r.category === 'military' ? '#ff6b6b' : '#ffb454'}"></span><span class="ways-name">${esc(r.name)}</span><button class="ways-load" data-load="${r.id}" title="load into NAV COMPUTER">▶</button></div>
        <div class="ways-r2 muted">${esc(r.kind)} · ${esc(r.operator)} · Class ${esc(r.driveClass)} · ${esc(r.traffic)}</div>
      </div>`;
    waysBox.innerHTML = `
      <div class="ways-h muted">${fmt(list.length)} charted ways · ${fmt(nComm)} commercial · ${fmt(list.length - nComm)} military</div>
      <details class="ways-groups">
        <summary>▾ groups <span class="muted" id="c-ways-gsum"></span></summary>
        <div class="ways-gmenu">${catBlock('commercial', '#ffb454', 'Commercial')}${catBlock('military', '#ff6b6b', 'Military')}</div>
      </details>
      <input class="ways-search" id="c-ways-search" type="text" placeholder="search ${fmt(list.length)} ways by name, operator, kind…" />
      <div class="ways-count muted" id="c-ways-count"></div>
      <div class="ways-list" id="c-ways-list"></div>`;
    const listEl = waysBox.querySelector('#c-ways-list');
    const countEl = waysBox.querySelector('#c-ways-count');
    const gsum = waysBox.querySelector('#c-ways-gsum');
    const nGroups = Object.keys(on).length;
    const render = () => {
      const nOn = Object.values(on).filter(Boolean).length;
      gsum.textContent = nOn === nGroups ? '(all)' : `(${nOn}/${nGroups})`;
      const matches = list.filter((r) => on[`${r.category}:${r.group}`] && (!text || `${r.name} ${r.kind} ${r.operator} ${r.lore}`.toLowerCase().includes(text)));
      listEl.innerHTML = matches.slice(0, MAX_ROWS).map(row).join('');
      countEl.textContent = matches.length > MAX_ROWS ? `showing ${MAX_ROWS} of ${fmt(matches.length)} — search to narrow` : `${fmt(matches.length)} shown`;
    };
    // sync a category's parent checkbox (checked / indeterminate / empty)
    const syncCat = (cat) => {
      const cb = waysBox.querySelector(`[data-catall="${cat}"]`); if (!cb) return;
      cb.checked = catOn(cat); cb.indeterminate = !catOn(cat) && catAny(cat);
    };
    render(); syncCat('commercial'); syncCat('military');

    waysBox.querySelectorAll('[data-gkey]').forEach((cb) => { cb.onchange = () => {
      const k = cb.dataset.gkey; on[k] = cb.checked; app.setRouteNetworkFilter(k, cb.checked); syncCat(k.slice(0, k.indexOf(':'))); render();
    }; });
    waysBox.querySelectorAll('[data-catall]').forEach((cb) => { cb.onchange = () => {
      const cat = cb.dataset.catall; app.setRouteNetworkCategory(cat, cb.checked);
      for (const g of ROUTE_GROUPS[cat]) { const k = `${cat}:${g.key}`; on[k] = cb.checked; const el = waysBox.querySelector(`[data-gkey="${k}"]`); if (el) el.checked = cb.checked; }
      cb.indeterminate = false; render();
    }; });
    waysBox.querySelector('#c-ways-search').oninput = (e) => { text = e.target.value.toLowerCase().trim(); render(); };
    // event delegation (rows are re-rendered on every filter)
    listEl.onclick = (e) => {
      const loadBtn = e.target.closest('.ways-load'); if (loadBtn) { app.loadTradeRoute(loadBtn.dataset.load); return; }
      const rw = e.target.closest('.ways-row'); if (!rw) return;
      listEl.querySelectorAll('.ways-row').forEach((x) => x.classList.remove('sel')); rw.classList.add('sel');
      app.highlightTradeRoute(rw.dataset.way);
    };
  };
  ways.onclick = () => {
    ways.classList.toggle('on');
    const on = ways.classList.contains('on');
    app.setRouteNetwork(on);
    waysBox.hidden = !on;
    if (on && !waysBox.childElementCount) buildWays();
  };
  if (app.showRouteNetwork) { waysBox.hidden = false; buildWays(); }
  const imagery = root.querySelector('[data-l="imagery"]');
  imagery.classList.toggle('on', !!app.showGalaxyImagery);
  imagery.onclick = () => { imagery.classList.toggle('on'); app.setGalaxyImagery(imagery.classList.contains('on')); };
  // Procedural fill + its colour switch + density profile
  const proc = root.querySelector('[data-l="procedural"]');
  const procColor = root.querySelector('#c-proc-color');
  const procNote = root.querySelector('#c-proc-note');
  const procDensity = root.querySelector('#c-proc-density');
  const procDensityNote = root.querySelector('#c-proc-density-note');
  const setDensityNote = () => {
    procDensityNote.innerHTML = app.cosmos.densityMode() === 'ultra'
      ? 'ultra · a much denser imagined universe — personal mode for a beefy GPU (RTX&nbsp;3090+)'
      : 'standard · runs anywhere · switch to ultra only on a powerful GPU';
  };
  const setNote = () => {
    if (!proc.classList.contains('on')) { procNote.textContent = ''; return; }
    const frac = app.cosmos.proceduralFraction();
    const dens = frac >= 0.99 ? 'at full survey density' : `at ${Math.round(frac * 100)}% of peak survey density`;
    procNote.textContent = `${fmt(app.cosmos.proceduralCount())} imagined objects completing the universe ${dens} · selectable & route-able (not real data)`;
  };
  setNote(); setDensityNote();
  proc.onclick = () => {
    proc.classList.toggle('on');
    const on = proc.classList.contains('on');
    app.setCosmosFilter({ show: { procedural: on } });
    procColor.hidden = !on; procDensity.hidden = !on; setNote();
  };
  procColor.querySelectorAll('[data-pc]').forEach((b) => {
    b.onclick = () => { procColor.querySelectorAll('[data-pc]').forEach((x) => x.classList.toggle('on', x === b)); app.cosmos.setProceduralColor(b.dataset.pc); };
  });
  procDensity.querySelectorAll('[data-dn]').forEach((b) => {
    b.onclick = () => {
      if (b.classList.contains('on')) return;
      procDensity.querySelectorAll('[data-dn]').forEach((x) => x.classList.toggle('on', x === b));
      procDensityNote.textContent = 'regenerating the imagined universe…';
      // let the note paint before the (synchronous) rebuild blocks the frame
      requestAnimationFrame(() => requestAnimationFrame(() => { app.cosmos.setDensity(b.dataset.dn); setNote(); setDensityNote(); }));
    };
  });
  const op = root.querySelector('#c-cmb-op'), opv = root.querySelector('#c-cmb-v');
  op.oninput = () => {
    const val = +op.value;
    if (val === 0) { opv.textContent = 'auto'; app.cosmos.setCmbOpacity(null); }
    else { opv.textContent = (val / 100).toFixed(2); app.cosmos.setCmbOpacity(val / 100); }
  };
  root.querySelector('#c-home').onclick = () => app.home();
}

function fmt(n) { return n.toLocaleString('en-US'); }
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
