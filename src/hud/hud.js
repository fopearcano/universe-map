import { cartesianToRaDec, fmtRA, fmtDec, fmtNum, PC_TO_LY } from '../util/astro.js';
import { buildLocalFilters } from './filters.js';
import { buildLocalVoyageList, buildCosmosVoyageList } from './voyages.js';
import { buildCosmosFilters, buildCosmosLayers } from './cosmosHud.js';
import { buildAtlasBrowser } from './atlasBrowser.js';

export function initHUD(app) {
  initModeSwitch(app);
  initTabs();
  buildDock(app);
  app.on('mode', () => buildDock(app));
  initTelemetry(app);
  initFps();
  initHoverTip(app);
  initGalaxyBanner(app);
}

// Banner shown while flying inside a galaxy: name, field source, a star-count
// quality selector (raise it for a strong GPU), and an exit button.
function initGalaxyBanner(app) {
  const b = document.createElement('div');
  b.id = 'galaxybanner'; b.hidden = true;
  document.body.appendChild(b);
  app.on('galaxy', (e) => {
    if (!e || !e.inside) { b.hidden = true; b.innerHTML = ''; return; }
    if (e.loading) { b.hidden = false; b.innerHTML = `<span class="gb-load">⛶ entering <b>${esc(e.name)}</b> · fetching sky image…</span>`; return; }
    b.hidden = false;
    const q = app.qualityStarCount();
    b.innerHTML = `
      <span class="gb-name">⛶ INSIDE <b>${esc(e.name)}</b></span>
      <span class="gb-src">${e.imageDerived ? `${e.survey && e.survey !== 'custom' ? e.survey + ' ' : ''}image-derived field` : 'procedural field'} · ${(e.count || 0).toLocaleString('en-US')} stars${e.diameterKpc ? ` · ⌀ ${Math.round(e.diameterKpc)} kpc` : ''}</span>
      <label class="gb-q">stars
        <select id="gb-q">
          <option value="60000">60k</option>
          <option value="120000">120k</option>
          <option value="250000">250k · high</option>
          <option value="450000">450k · ultra</option>
          <option value="1000000">1M · extreme</option>
        </select>
      </label>
      <button id="gb-exit" class="btn sm">⤴ exit galaxy</button>`;
    const sel = b.querySelector('#gb-q');
    sel.value = String([60000, 120000, 250000, 450000, 1000000].reduce((a, v) => Math.abs(v - q) < Math.abs(a - q) ? v : a));
    sel.onchange = () => { app.setInteriorQuality(+sel.value); app.enterGalaxy(app._lastGalaxyInfo); };
    b.querySelector('#gb-exit').onclick = () => {
      if (app.autopilot && app.autopilot.atGalaxy) app.resumeFromGalaxy(); // rejoin the course
      else if (app.cruise) app.stopCruise();
      else app.exitGalaxy();
    };
  });
}

function initModeSwitch(app) {
  const btns = document.querySelectorAll('#modeswitch .ms');
  btns.forEach((b) => b.addEventListener('click', () => app.setMode(b.dataset.mode)));
  app.on('mode', (m) => btns.forEach((b) => b.classList.toggle('active', b.dataset.mode === m)));
}

function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach((t) => t.addEventListener('click', () => {
    tabs.forEach((x) => x.classList.remove('active'));
    document.querySelectorAll('.tabpanel').forEach((p) => p.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('tab-' + t.dataset.tab).classList.add('active');
  }));
}

function buildDock(app) {
  app._syncSystemTimeUI = null;
  if (app.mode === 'cosmos') {
    buildCosmosFilters(app); buildCosmosVoyageList(app); buildCosmosLayers(app);
  } else if (app.mode === 'system') {
    buildSystemPanel(app);
    const note = (id, txt) => { const el = document.getElementById(id); if (el) el.innerHTML = `<div class="muted" style="line-height:1.6">${txt}</div>`; };
    note('tab-voyages', 'Expeditions apply to the LOCAL & COSMOS scales. Press <b>1</b> or <b>2</b> to leave the Solar System.');
    note('tab-layers', 'Overlays apply to the LOCAL & COSMOS scales.');
  } else {
    buildLocalFilters(app); buildLocalVoyageList(app); buildLocalLayers(app);
  }
  buildAtlasBrowser(app); // mode-independent
  // reset to the filters tab
  document.querySelectorAll('.tab').forEach((x, i) => x.classList.toggle('active', i === 0));
  document.querySelectorAll('.tabpanel').forEach((p, i) => p.classList.toggle('active', i === 0));
}

// The SYSTEM-mode filters tab: a picker for the Sun, planets & dwarf planets.
function buildSystemPanel(app) {
  const root = document.getElementById('tab-filters');
  const ss = app.solarSystem;
  const rows = ss.nodes.map((n, i) => ({ n, i })).filter(({ n }) => n.kind !== 'moon');
  const sw = (i) => { const c = ss.info(i).color || [0.8, 0.8, 0.9]; return `rgb(${(c[0] * 255) | 0},${(c[1] * 255) | 0},${(c[2] * 255) | 0})`; };
  root.innerHTML = `
    <div class="muted" style="margin-bottom:10px">The Solar System, to scale — orbits are real (in AU); bodies are size-exaggerated so they stay visible. Planets revolve and moons circle them; click a world to fly to it.</div>
    <div class="sys-time">
      <button class="btn sm" id="sys-pause"></button>
      <span class="sys-speed">
        <label>time</label>
        <input type="range" id="sys-speed" min="0" max="4" step="0.25" value="${ss.timeScale}">
        <span class="sys-speed-v" id="sys-speed-v"></span>
      </span>
    </div>
    <div class="sys-list">${rows.map(({ n, i }) => `<button class="sys-row" data-i="${i}"><span class="sys-sw" style="background:${sw(i)}"></span><span class="sys-nm">${esc(n.name)}</span><span class="muted">${esc(n.kind)}</span></button>`).join('')}</div>
    <div class="hr"></div>
    <button class="btn" id="sys-home">⊙ frame the whole system</button>
    <div class="muted" style="margin-top:12px;line-height:1.6">Sun + ${rows.length - 1} worlds · ${ss.nodes.length} bodies incl. moons.<br>Keys <b>1</b> · <b>2</b> · <b>3</b> switch LOCAL · COSMOS · SYSTEM.</div>`;
  root.querySelectorAll('.sys-row').forEach((b) => { b.onclick = () => app.selectBody(+b.dataset.i, { fly: true }); });
  root.querySelector('#sys-home').onclick = () => { const v = ss.defaultView(); app.scene.setView(v.pos, v.target); };

  // ---- orbital-animation controls (kept in sync with agent-driven changes) ----
  const pauseBtn = root.querySelector('#sys-pause');
  const speed = root.querySelector('#sys-speed');
  const speedV = root.querySelector('#sys-speed-v');
  const sync = () => {
    pauseBtn.textContent = ss.paused ? '▶ play' : '❚❚ pause';
    pauseBtn.classList.toggle('on', !ss.paused);
    speed.value = String(ss.timeScale);
    speedV.textContent = `${ss.timeScale.toFixed(2).replace(/0$/, '')}×`;
  };
  pauseBtn.onclick = () => { ss.setPaused(!ss.paused); sync(); };
  speed.oninput = () => { ss.setTimeScale(+speed.value); if (ss.paused && +speed.value > 0) ss.setPaused(false); sync(); };
  app._syncSystemTimeUI = sync;
  sync();
}

function buildLocalLayers(app) {
  const root = document.getElementById('tab-layers');
  root.innerHTML = `
    <div class="muted" style="margin-bottom:10px">Reference infographics and overlays.</div>
    <div class="toggle on" data-l="grid"><span>Reference grid</span><span class="sw"></span></div>
    <div class="toggle on" data-l="rings"><span>Distance rings (ly)</span><span class="sw"></span></div>
    <div class="toggle" data-l="sector"><span>Sector grid <span class="muted">· map</span></span><span class="sw"></span></div>
    <div class="toggle on" data-l="axes"><span>Celestial axes</span><span class="sw"></span></div>
    <div class="toggle on" data-l="labels"><span>Star name labels</span><span class="sw"></span></div>
    <div class="toggle on" data-l="clusters"><span>Star clusters</span><span class="sw"></span></div>
    <div class="toggle on" data-l="atlas"><span>Cosmic atlas objects</span><span class="sw"></span></div>
    <div class="toggle on" data-l="custom"><span>My library (✦ custom)</span><span class="sw"></span></div>
    <div class="hr"></div>
    <button class="btn" id="l-home">⌂ recenter on Sol</button>
    <div class="muted" style="margin-top:12px;line-height:1.6">100,000 stars · HYG v4.1<br>positions in parsecs, equatorial J2000<br>Sol fixed at origin.</div>`;
  const handlers = {
    grid: (on) => app.scene.setReferenceVisible(on),
    rings: (on) => app.scene.setRingsVisible(on),
    sector: (on) => app.setSectorGrid(on),
    axes: (on) => app.scene.setAxesVisible(on),
    labels: (on) => app.labels.setStarsVisible(on),
    clusters: (on) => app.setLayerVisible('clusters', on),
    atlas: (on) => app.setLayerVisible('atlas', on),
    custom: (on) => app.setLayerVisible('custom', on),
  };
  root.querySelectorAll('.toggle').forEach((el) => { if (el.dataset.l === 'sector') el.classList.toggle('on', !!app.showSectorGrid); });
  root.querySelectorAll('.toggle').forEach((el) => {
    el.onclick = () => { el.classList.toggle('on'); handlers[el.dataset.l](el.classList.contains('on')); };
  });
  root.querySelector('#l-home').onclick = () => app.home();
}

function initTelemetry(app) {
  const el = document.getElementById('telemetry');
  app.on('frame', (f) => {
    const { ra, dec } = cartesianToRaDec(f.dir.x, f.dir.y, f.dir.z);
    const focus = f.focus ? cell('FOCUS', esc(f.focus)) : '';
    const sec = f.sector ? cell('SECTOR', f.sector) : '';
    if (f.mode === 'galaxy' && f.galaxy) {
      const ly = f.galaxy.rangeLy;
      const rng = ly >= 1e3 ? `${(ly / 1e3).toFixed(1)} kly` : `${ly.toFixed(0)} ly`;
      el.innerHTML = [
        cell('INSIDE', esc(f.galaxy.name)),
        cell('STARS', fmtNum(f.galaxy.stars)),
        cell('RANGE', rng), sec,
        cell('HDG', `${fmtRA(ra)} ${fmtDec(dec)}`),
        cell('FOV', `${f.fov.toFixed(0)}°`), focus,
      ].join('');
    } else if (f.mode === 'cosmos') {
      el.innerHTML = [
        cell('OBJECTS', fmtNum(f.visible)),
        cell('SCALE', scaleAt(Math.min(f.camRadius, f.cmbR), f.decadeUnit)), sec,
        cell('HDG', `${fmtRA(ra)} ${fmtDec(dec)}`),
        cell('FOV', `${f.fov.toFixed(0)}°`), focus,
      ].join('');
    } else if (f.mode === 'system') {
      const au = f.sys ? f.sys.rangeAu : 0;
      el.innerHTML = [
        cell('SYSTEM', 'Sol'),
        cell('BODIES', fmtNum(f.sys ? f.sys.bodies : 0)),
        cell('RANGE', `${au.toFixed(au < 10 ? 2 : au < 100 ? 1 : 0)} AU`),
        cell('FOV', `${f.fov.toFixed(0)}°`), focus,
      ].join('');
    } else {
      el.innerHTML = [
        cell('STARS', `${fmtNum(f.visible)}/100k`),
        cell('RANGE', fmtRange(f.camRadius)), sec,
        cell('HDG', `${fmtRA(ra)} ${fmtDec(dec)}`),
        cell('FOV', `${f.fov.toFixed(0)}°`), focus,
      ].join('');
    }
  });
}

function scaleAt(camR, decadeUnit) {
  const pc = Math.pow(10, camR / decadeUnit);
  const ly = pc * PC_TO_LY;
  if (ly >= 1e9) return `${(ly / 1e9).toFixed(2)} Gly`;
  if (ly >= 1e6) return `${(ly / 1e6).toFixed(1)} Mly`;
  if (ly >= 1e3) return `${(ly / 1e3).toFixed(0)} kly`;
  return `${ly.toFixed(0)} ly`;
}
function fmtRange(pc) {
  const ly = pc * PC_TO_LY;
  return ly < 1000 ? `${ly.toFixed(ly < 10 ? 2 : 0)} ly` : `${(ly / 1000).toFixed(2)}k ly`;
}
function cell(k, v) { return `<span><span class="k">${k}</span> <span class="v">${v}</span></span>`; }

function initFps() {
  const el = document.getElementById('fps');
  let last = performance.now(), frames = 0, acc = 0;
  const loop = (now) => {
    frames++; acc += now - last; last = now;
    if (acc >= 500) { el.textContent = `${Math.round((frames * 1000) / acc)} fps`; frames = 0; acc = 0; }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function initHoverTip(app) {
  const tip = document.createElement('div');
  tip.id = 'hovertip';
  Object.assign(tip.style, {
    position: 'fixed', zIndex: '7', pointerEvents: 'none', padding: '2px 7px',
    background: 'rgba(6,14,22,0.9)', border: '1px solid var(--line-strong)', borderRadius: '4px',
    color: 'var(--ink)', fontSize: '11px', transform: 'translate(12px, 12px)', display: 'none', whiteSpace: 'nowrap',
  });
  document.body.appendChild(tip);
  app.on('hover', (h) => {
    if (!h) { tip.style.display = 'none'; return; }
    tip.style.display = 'block';
    tip.style.left = h.x + 'px'; tip.style.top = h.y + 'px';
    tip.innerHTML = h.text;
  });
  app.on('mode', () => { tip.style.display = 'none'; });
}

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
