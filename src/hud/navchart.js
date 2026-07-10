import { fmtRA, fmtDec } from '../util/astro.js';

// The nautical-chart / spaceship navigation console: a focus chip, a NAV COMPUTER
// (plot course, edit waypoints, cruise speed → travel & ship time, save/load) and
// an AUTOPILOT heads-up display shown while flying a plotted course.
const SPEEDS = [
  { label: 'Voyager 1 · 17 km/s', beta: 17 / 299792.458 },
  { label: '0.01 c', beta: 0.01 }, { label: '0.1 c', beta: 0.1 }, { label: '0.5 c', beta: 0.5 },
  { label: '0.9 c', beta: 0.9 }, { label: '0.99 c', beta: 0.99 }, { label: '0.999 c', beta: 0.999 },
  { label: 'light speed · c', beta: 1 },
];

export function initNavChart(app) {
  const focusChip = el('div', 'focuschip'); focusChip.hidden = true; document.body.appendChild(focusChip);
  const panel = el('div', 'routepanel'); panel.hidden = true; document.body.appendChild(panel);
  const hud = el('div', 'navhud'); hud.hidden = true; document.body.appendChild(hud);
  const plotBanner = el('div', 'plotbanner'); plotBanner.hidden = true;
  plotBanner.innerHTML = '◉ PLOT COURSE — click the map to drop waypoints';
  document.body.appendChild(plotBanner);
  let summary = null;
  let expedition = null;

  app.on('mode', () => { focusChip.hidden = true; hud.hidden = true; });
  app.on('plot', (on) => { plotBanner.hidden = !on; render(); });
  app.on('expedition', (e) => { expedition = e; render(); });

  app.on('focus', (f) => {
    if (!f) { focusChip.hidden = true; return; }
    focusChip.hidden = false;
    focusChip.innerHTML = `<span class="fc-k">◎ FOCUS</span> <span class="fc-v">${esc(f.label)}</span> <button class="fc-x" title="recenter on Sol">✕</button>`;
    focusChip.querySelector('.fc-x').onclick = () => app.home();
  });

  app.on('route', (s) => { summary = s; render(); });
  app.on('routes', () => render());

  function render() {
    const s = summary;
    if (!s || !s.points.length) { panel.hidden = true; panel.innerHTML = ''; expedition = null; return; }
    panel.hidden = false;
    const expHdr = expedition ? `<div class="rp-exped"><div class="rp-exped-t">◈ ${esc(expedition.title)}</div><div class="rp-exped-p">${esc(expedition.premise)}</div></div>` : '';
    const beta = s.cruiseC, gamma = beta >= 1 ? Infinity : 1 / Math.sqrt(1 - beta * beta);
    const wpRows = s.points.map((p, i) => {
      const leg = i > 0 ? s.legs[i - 1] : null;
      const legInfo = leg ? `<div class="rp-leginfo">↳ ${fmtLy(leg.ly)} · ${fmtRA(leg.ra)} ${fmtDec(leg.dec)} · ${fmtYr(leg.years)}</div>` : '';
      return `<div class="rp-wp">
          <span class="rp-wi">${i}</span>
          <span class="rp-wn">${esc(p.label)}${p.kind === 'free' ? ' <span class="rp-free">◇</span>' : ''}</span>
          <span class="rp-wc"><button data-up="${i}" title="up">▲</button><button data-down="${i}" title="down">▼</button><button data-del="${i}" title="remove">✕</button></span>
        </div>${legInfo}`;
    }).join('');
    const savedRows = app.routeStore.all().map((r) =>
      `<div class="rp-saved"><span class="rp-sname" data-load="${r.id}">${esc(r.name)}</span><span class="muted">${r.waypoints.length} wp</span><button data-delr="${r.id}" title="delete">🗑</button></div>`).join('') || '<div class="muted" style="padding:2px 0">no saved routes</div>';

    panel.innerHTML = `
      <div class="rp-top">
        <div class="rp-title">◈ NAV COMPUTER · <b>${s.points.length}</b> wp</div>
        <button class="rp-x" title="clear route">✕</button>
      </div>
      ${expHdr}
      <div class="rp-tools">
        <button class="btn sm ${app.plotCourse ? 'on' : ''}" id="rp-plot" title="click the map to drop waypoints">◉ plot</button>
        <button class="btn sm" id="rp-viewpt" title="drop a free-space waypoint where you're looking">＋ pt</button>
        <button class="btn sm" id="rp-rev" title="reverse">⇄</button>
        <button class="btn sm" id="rp-save" title="save route">💾</button>
      </div>
      <div class="rp-cruise">
        <span>cruise</span>
        <select id="rp-speed">${SPEEDS.map((sp) => `<option value="${sp.beta}" ${near(sp.beta, beta) ? 'selected' : ''}>${sp.label}</option>`).join('')}</select>
        <span class="muted">γ=${gamma === Infinity ? '∞' : gamma.toFixed(2)}</span>
      </div>
      <div class="rp-wps">${wpRows}</div>
      <div class="rp-total">
        <div><span>path</span><span class="v">${fmtLy(s.totalLy)}</span></div>
        <div><span>mission time</span><span class="v">${fmtYr(s.years)}</span></div>
        <div><span>ship time (relativistic)</span><span class="v">${beta >= 1 ? '0 (photon)' : fmtYr(s.shipYears)}</span></div>
      </div>
      <div class="rp-ctrls">
        <button class="btn sm rp-engage" id="rp-engage" ${s.points.length < 2 ? 'disabled' : ''}>⏵ ENGAGE</button>
      </div>
      <div class="rp-saved-h muted">saved routes <span class="rp-io"><button id="rp-imp">⇩</button><button id="rp-exp">⇧</button></span></div>
      <div class="rp-saved-list">${savedRows}</div>
      <input id="rp-file" type="file" accept="application/json,.json" hidden />
      <div class="rp-hint muted">plot: ◉ then click · or select an object → <b>＋ route</b></div>`;

    panel.querySelector('.rp-x').onclick = () => app.clearRoute();
    panel.querySelector('#rp-plot').onclick = () => app.setPlotCourse(!app.plotCourse);
    panel.querySelector('#rp-viewpt').onclick = () => app.addViewPoint();
    panel.querySelector('#rp-rev').onclick = () => app.reverseRoute();
    panel.querySelector('#rp-engage').onclick = () => app.engageRoute();
    panel.querySelector('#rp-speed').onchange = (e) => app.setCruiseSpeed(+e.target.value);
    panel.querySelector('#rp-save').onclick = () => { const n = prompt('Name this route:', `route ${app.routeStore.all().length + 1}`); if (n) app.saveRoute(n); };
    panel.querySelectorAll('[data-up]').forEach((b) => { b.onclick = () => app.moveRouteWaypoint(+b.dataset.up, -1); });
    panel.querySelectorAll('[data-down]').forEach((b) => { b.onclick = () => app.moveRouteWaypoint(+b.dataset.down, 1); });
    panel.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => app.removeRouteWaypoint(+b.dataset.del); });
    panel.querySelectorAll('[data-load]').forEach((b) => { b.onclick = () => app.loadRoute(b.dataset.load); });
    panel.querySelectorAll('[data-delr]').forEach((b) => { b.onclick = () => app.deleteRoute(b.dataset.delr); });
    panel.querySelector('#rp-exp').onclick = () => download('universe-map-routes.json', app.exportRoutes());
    const file = panel.querySelector('#rp-file');
    panel.querySelector('#rp-imp').onclick = () => file.click();
    file.onchange = async () => { const f = file.files[0]; if (f) app.importRoutes(await f.text()); file.value = ''; };
  }

  // ---- autopilot HUD ----
  app.on('nav', (n) => {
    if (!n) { hud.hidden = true; hud.innerHTML = ''; return; }
    hud.hidden = false;
    if (n.arrived) {
      hud.innerHTML = `<div class="nh-arrived">✦ ARRIVED · <b>${esc(n.at)}</b></div>`;
      setTimeout(() => { hud.hidden = true; }, 2600);
      return;
    }
    if (n.descending) {
      hud.innerHTML = `<div class="nh-row nh-top"><span class="nh-leg">STOP ${n.seg}/${n.total}</span><span class="nh-to nh-descend">⛶ descending into the galaxy…</span></div>`;
      return;
    }
    if (n.insideGalaxy) {
      hud.innerHTML = `
        <div class="nh-row nh-top"><span class="nh-leg">STOP ${n.seg}/${n.total}</span><span class="nh-to">⛶ inside <b>${esc(n.insideGalaxy)}</b></span></div>
        <div class="nh-row nh-total muted"><span>free-look the interior · continue to rise out and fly on</span></div>
        <div class="nh-ctrls">
          <button class="btn sm nh-resume" id="nh-continue">▶ continue course</button>
          <button class="btn sm" id="nh-stop">■ disengage</button>
        </div>`;
      hud.querySelector('#nh-continue').onclick = () => app.resumeFromGalaxy();
      hud.querySelector('#nh-stop').onclick = () => app.stopRoute();
      return;
    }
    hud.innerHTML = `
      <div class="nh-row nh-top">
        <span class="nh-leg">LEG ${n.seg}/${n.total}</span>
        <span class="nh-to">→ ${esc(n.toLabel)}</span>
        <span class="nh-v">${fmtC(n.cruiseC)}</span>
      </div>
      <div class="nh-row nh-data">
        <span><i>HDG</i> ${fmtRA(n.ra)} ${fmtDec(n.dec)}</span>
        <span><i>RANGE</i> ${fmtLy(n.rangeLy)}</span>
        <span><i>ETA</i> ${fmtYr(n.etaNext.years)}</span>
        <span><i>SHIP</i> ${n.cruiseC >= 1 ? '0' : fmtYr(n.etaNext.shipYears)}</span>
      </div>
      <div class="nh-row nh-total muted"><span>remaining ${fmtLy(n.rangeLyTotal ?? 0)}</span><span>mission left ${fmtYr(n.etaTotal.years)} · ship ${n.cruiseC >= 1 ? '0' : fmtYr(n.etaTotal.shipYears)}</span></div>
      <div class="nh-ctrls">
        <button class="btn sm" id="nh-prev">◀</button>
        <button class="btn sm" id="nh-pause">${n.paused ? '⏵ resume' : '❚❚ hold'}</button>
        <button class="btn sm" id="nh-next">▶</button>
        <button class="btn sm ${app.showTrackPanel ? 'on' : ''}" id="nh-track" title="tracking panel (T)">▤ track</button>
        <button class="btn sm" id="nh-stop">■ disengage</button>
      </div>`;
    hud.querySelector('#nh-prev').onclick = () => app.navStep(-1);
    hud.querySelector('#nh-next').onclick = () => app.navStep(1);
    hud.querySelector('#nh-pause').onclick = () => app.pauseRoute();
    hud.querySelector('#nh-track').onclick = () => app.setTrackPanel(!app.showTrackPanel);
    hud.querySelector('#nh-stop').onclick = () => app.stopRoute();
  });

  initTrackPanel(app);
}

// The linked, transparent tracking panel — live telemetry of the tracked point.
function initTrackPanel(app) {
  const panel = el('div', 'trackpanel'); panel.hidden = true; document.body.appendChild(panel);
  app.on('track', (t) => {
    if (!t) { panel.hidden = true; panel.innerHTML = ''; return; }
    panel.hidden = false;
    if (t.idle) {
      panel.innerHTML = `<div class="tp-h">◎ TRACKING</div><div class="tp-idle muted">engage a route to begin tracking</div>`;
      return;
    }
    const kms = (t.cruiseC * 299792.458);
    panel.innerHTML = `
      <div class="tp-h">◎ TRACKING <span class="tp-leg">${t.paused ? '❚❚ ' : ''}LEG ${t.seg}/${t.total}</span></div>
      <div class="tp-route">${esc(t.from)} <span class="muted">→</span> <b>${esc(t.to)}</b></div>
      <div class="tp-bar"><i style="width:${Math.round(t.progress * 100)}%"></i></div>
      <dl class="tp-dl">
        <dt>position</dt><dd>${fmtRA(t.posRa)} ${fmtDec(t.posDec)}</dd>
        <dt></dt><dd class="muted">${fmtLy(t.distLy)} from Sol</dd>
        <dt>heading</dt><dd>${fmtRA(t.hdgRa)} ${fmtDec(t.hdgDec)}</dd>
        <dt>speed</dt><dd>${fmtC(t.cruiseC)} <span class="muted">· ${kms >= 1e6 ? (kms / 1e6).toFixed(0) + 'M' : Math.round(kms).toLocaleString('en-US')} km/s</span></dd>
        <dt>to next</dt><dd>${fmtLy(t.legRemainLy)} · ${fmtYr(t.etaLeg.years)}</dd>
        <dt>travelled</dt><dd>${fmtLy(t.doneLy)} <span class="muted">/ ${fmtLy(t.totalLy)}</span></dd>
        <dt>remaining</dt><dd>${fmtLy(t.remainLy)} · ${fmtYr(t.etaTotal.years)} <span class="muted">(ship ${t.cruiseC >= 1 ? '0' : fmtYr(t.etaTotal.shipYears)})</span></dd>
      </dl>`;
  });
}

function near(a, b) { return Math.abs(a - b) < Math.max(1e-9, b * 1e-3); }
function fmtC(b) { return b >= 1 ? 'c' : b >= 0.01 ? b.toFixed(2) + 'c' : (b * 299792.458).toFixed(0) + ' km/s'; }
function fmtLy(ly) {
  if (ly >= 1e9) return `${(ly / 1e9).toFixed(2)} Gly`;
  if (ly >= 1e6) return `${(ly / 1e6).toFixed(2)} Mly`;
  if (ly >= 1e3) return `${(ly / 1e3).toFixed(1)} kly`;
  return `${(ly || 0).toFixed(ly < 10 ? 2 : 1)} ly`;
}
function fmtYr(y) {
  if (!isFinite(y)) return '∞';
  if (y >= 1e9) return `${(y / 1e9).toFixed(2)} Gyr`;
  if (y >= 1e6) return `${(y / 1e6).toFixed(2)} Myr`;
  if (y >= 1e3) return `${(y / 1e3).toFixed(1)} kyr`;
  if (y >= 1) return `${y.toFixed(0)} yr`;
  return `${(y * 365.25).toFixed(0)} d`;
}
function download(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function el(tag, id) { const e = document.createElement(tag); e.id = id; return e; }
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
