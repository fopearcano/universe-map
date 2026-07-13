import { fmtRA, fmtDec } from '../util/astro.js';
import { DRIVES, fmtDriveSpeed } from '../data/drives.js';

// TEKNÉ · NAVCOM — the spaceship navigation console, re-skinned as the navigation
// computer of the Idrenes Composite *Tekné* from the QTR "Immeasurable Spaces" canon.
// You plot a course, pick a DRIVE (a depth rung on the Ship-Relative Speed Law: speed
// is a function of vacuum depth, not thrust), and the console reads out the path along
// the seam 𝔍, the coordinate (home-frame) time, the crew (proper) time, and the number
// of Idrenes-bridge crossings. An AUTOPILOT HUD threads the course while you fly it.

export function initNavChart(app) {
  const focusChip = el('div', 'focuschip'); focusChip.hidden = true; document.body.appendChild(focusChip);
  const panel = el('div', 'routepanel'); panel.hidden = true; document.body.appendChild(panel);
  const hud = el('div', 'navhud'); hud.hidden = true; document.body.appendChild(hud);
  const plotBanner = el('div', 'plotbanner'); plotBanner.hidden = true;
  plotBanner.innerHTML = '◉ PLOT COURSE — click the map to drop waypoints';
  document.body.appendChild(plotBanner);
  let summary = null;
  let expedition = null;
  let navcomVisible = false;   // NAV COMPUTER opens with a course, or on demand from the toolbar

  // Let the dock toolbar open/close the NAV COMPUTER even with no course loaded.
  app._navcomShow = () => { navcomVisible = true; render(); };
  app._navcomHide = () => { navcomVisible = false; render(); };

  app.on('mode', () => { focusChip.hidden = true; hud.hidden = true; });
  app.on('plot', (on) => { plotBanner.hidden = !on; render(); });
  app.on('expedition', (e) => { expedition = e; render(); });

  app.on('focus', (f) => {
    if (!f) { focusChip.hidden = true; return; }
    focusChip.hidden = false;
    focusChip.innerHTML = `<span class="fc-k">◎ FOCUS</span> <span class="fc-v">${esc(f.label)}</span> <button class="fc-x" title="recenter on Sol">✕</button>`;
    focusChip.querySelector('.fc-x').onclick = () => app.home();
  });

  app.on('route', (s) => { summary = s; if (s && s.points && s.points.length) navcomVisible = true; render(); });
  app.on('routes', () => render());

  function render() {
    const s = summary;
    const pts = (s && s.points) || [];
    const hasRoute = pts.length > 0;
    // Show whenever a course is loaded, or when opened on demand from the toolbar.
    if (!navcomVisible) { panel.hidden = true; panel.innerHTML = ''; if (!hasRoute) expedition = null; return; }
    panel.hidden = false;
    const legs = (s && s.legs) || [];
    const expHdr = (hasRoute && expedition) ? `<div class="rp-exped"><div class="rp-exped-t">◈ ${esc(expedition.title)}</div><div class="rp-exped-p">${esc(expedition.premise)}</div></div>` : '';
    const dr = (s && s.drive) || app.drive || { id: '', cls: '', klass: '', name: '', regime: '', note: '', sc: 1 };
    const wpRows = hasRoute ? pts.map((p, i) => {
      const leg = i > 0 ? legs[i - 1] : null;
      const legInfo = leg ? `<div class="rp-leginfo">⟿ crossing ${i} · ${fmtLy(leg.ly)} · ${fmtRA(leg.ra)} ${fmtDec(leg.dec)} · ${fmtYr(leg.years)}</div>` : '';
      return `<div class="rp-wp">
          <span class="rp-wi">${i}</span>
          <span class="rp-wn">${esc(p.label)}${p.kind === 'free' ? ' <span class="rp-free">◇</span>' : ''}</span>
          <span class="rp-wc"><button data-up="${i}" title="up">▲</button><button data-down="${i}" title="down">▼</button><button data-del="${i}" title="remove">✕</button></span>
        </div>${legInfo}`;
    }).join('')
      : `<div class="rp-empty muted">No course plotted yet. Hit <b>◉ plot</b> and click the map, select an object → <b>＋ route</b>, or ask Solaris.Ai to lay one in.</div>`;
    const savedRows = app.routeStore.all().map((r) =>
      `<div class="rp-saved"><span class="rp-sname" data-load="${r.id}">${esc(r.name)}</span><span class="muted">${r.waypoints.length} wp</span><button data-delr="${r.id}" title="delete">🗑</button></div>`).join('') || '<div class="muted" style="padding:2px 0">no saved routes</div>';
    const pct = s.universeLy ? (s.reachLy / s.universeLy * 100) : 0;
    const totals = hasRoute ? `
      <div class="rp-total">
        <div><span>path · seam 𝔍</span><span class="v">${fmtLy(s.totalLy)}</span></div>
        <div><span>coordinate time</span><span class="v">${fmtYr(s.years)}</span></div>
        <div><span>crew time · ${esc(dr.regime)}</span><span class="v">${fmtYr(s.shipYears)}</span></div>
        <div title="the whole voyage as lived — transit plus the threading, bridge crossings, approach and port cycles"><span>voyage · lived</span><span class="v">${esc(s.voyageStory ?? '—')}</span></div>
        <div><span>Idrenes bridges</span><span class="v">${s.crossings ?? Math.max(0, pts.length - 1)}</span></div>
        <div title="the log-radial map exaggerates distance — this is the route's real reach against the observable universe (~45 Gly radius)"><span>reach · of universe</span><span class="v">${fmtLy(s.reachLy)} · ${pct < 1 ? pct.toFixed(2) : pct.toFixed(1)}%</span></div>
      </div>
      <div class="rp-preview muted">▶ ENGAGE plays an unhurried preview — the real voyage takes the lived time above.</div>` : '';

    panel.innerHTML = `
      <div class="rp-top">
        <div class="rp-title">◈ TEKNÉ · NAVCOM</div>
        <button class="rp-x" title="${hasRoute ? 'clear course' : 'close'}">✕</button>
      </div>
      <div class="rp-sub muted">Sōrn depth-rung navigator · Solaris.Ai core</div>
      ${expHdr}
      <div class="rp-tools">
        <button class="btn sm ${app.plotCourse ? 'on' : ''}" id="rp-plot" title="click the map to drop waypoints">◉ plot</button>
        <button class="btn sm" id="rp-viewpt" title="drop a free-space waypoint where you're looking">＋ pt</button>
        <button class="btn sm" id="rp-rev" title="reverse"${hasRoute ? '' : ' disabled'}>⇄</button>
        <button class="btn sm" id="rp-save" title="save course"${hasRoute ? '' : ' disabled'}>💾</button>
      </div>
      <div class="rp-cruise">
        <span>drive</span>
        <select id="rp-drive">${DRIVES.map((d) => `<option value="${d.id}" ${d.id === dr.id ? 'selected' : ''}>Class ${d.cls} · ${d.klass} · ${fmtDriveSpeed(d.sc)}</option>`).join('')}</select>
        <span class="rp-cls" title="ship class = maximum vacuum depth">${dr.cls}</span>
      </div>
      <div class="rp-drivenote muted">${esc(dr.note)}</div>
      <div class="toggle rp-vtime ${app.voyageRealistic ? 'on' : ''}" id="rp-vtime" title="count the threading, bridge crossings, approach and port cycles — a voyage takes months; off shows raw drive-transit time only">
        <span>Realistic voyage time <span class="muted">· ${app.voyageRealistic ? 'lived · months' : 'raw transit'}</span></span><span class="sw"></span></div>
      <div class="rp-wps">${wpRows}</div>
      ${totals}
      <div class="rp-ctrls">
        <button class="btn sm rp-engage" id="rp-engage" ${pts.length < 2 ? 'disabled' : ''}>⏵ ENGAGE · thread 𝔍</button>
      </div>
      <div class="rp-saved-h muted">saved courses <span class="rp-io"><button id="rp-imp">⇩</button><button id="rp-exp">⇧</button></span></div>
      <div class="rp-saved-list">${savedRows}</div>
      <input id="rp-file" type="file" accept="application/json,.json" hidden />
      <div class="rp-hint muted">ΛL beacon lock · plot ◉ then click, or select an object → <b>＋ route</b></div>`;

    panel.querySelector('.rp-x').onclick = () => { navcomVisible = false; app.clearRoute(); render(); };
    panel.querySelector('#rp-plot').onclick = () => app.setPlotCourse(!app.plotCourse);
    panel.querySelector('#rp-viewpt').onclick = () => app.addViewPoint();
    if (hasRoute) panel.querySelector('#rp-rev').onclick = () => app.reverseRoute();
    panel.querySelector('#rp-engage').onclick = () => app.engageRoute();
    panel.querySelector('#rp-drive').onchange = (e) => app.setDrive(e.target.value);
    panel.querySelector('#rp-vtime').onclick = () => app.setVoyageRealistic(!app.voyageRealistic);
    if (hasRoute) panel.querySelector('#rp-save').onclick = () => { const n = prompt('Name this route:', `route ${app.routeStore.all().length + 1}`); if (n) app.saveRoute(n); };
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
  // The nav readout ticks ~5×/s during flight. Rebuilding the whole innerHTML each
  // tick would replace the control buttons out from under a click (the "had to click
  // it several times" bug), so we build the skeleton once per HUD *shape* (tracked by
  // a signature) and only patch the changing text/labels on every tick. The buttons —
  // and their handlers — persist, so a click always lands.
  let hudSig = null;
  const sigOf = (n) => n.arrived ? `arrived:${n.at}` : n.descending ? 'descend' : n.insideGalaxy ? `inside:${n.insideGalaxy}` : 'active';

  app.on('nav', (n) => {
    if (!n) { hud.hidden = true; hud.innerHTML = ''; hudSig = null; return; }
    hud.hidden = false;
    const sig = sigOf(n);
    if (sig !== hudSig) { buildNav(n, sig); hudSig = sig; }
    if (sig === 'active') patchActive(n);
  });

  function buildNav(n, sig) {
    if (n.arrived) {
      hud.innerHTML = `<div class="nh-arrived">✦ ARRIVED · <b>${esc(n.at)}</b></div>`;
      setTimeout(() => { if (hudSig === sig) { hud.hidden = true; hudSig = null; } }, 2600);
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
          <button class="btn sm nh-resume" id="nh-continue" title="continue course (Space)">▶ continue course</button>
          <button class="btn sm" id="nh-stop" title="disengage (Esc)">■ disengage</button>
        </div>`;
      hud.querySelector('#nh-continue').onclick = () => app.resumeFromGalaxy();
      hud.querySelector('#nh-stop').onclick = () => app.stopRoute();
      return;
    }
    // active crossing — stable skeleton; value spans carry ids so patchActive() can
    // update them in place without touching the buttons.
    hud.innerHTML = `
      <div class="nh-row nh-top">
        <span class="nh-leg" id="nh-crossing"></span>
        <span class="nh-to" id="nh-to"></span>
        <span class="nh-v" id="nh-v"></span>
      </div>
      <div class="nh-row nh-data">
        <span><i>HDG</i> <span id="nh-hdg"></span></span>
        <span><i>RANGE</i> <span id="nh-range"></span></span>
        <span><i>COORD</i> <span id="nh-coord"></span></span>
        <span><i>CREW</i> <span id="nh-crew"></span></span>
      </div>
      <div class="nh-row nh-total muted"><span id="nh-seamleft"></span><span id="nh-totaltime"></span></div>
      <div class="nh-row nh-story" title="STORY is the voyage's real (1:1) lived length. 1× would be real time — you'd wait the whole voyage — so the preview runs at a big time-acceleration.">
        <span><i>STORY</i> <span id="nh-story"></span> <span class="nh-watch" id="nh-watch"></span></span>
        <span class="nh-rate" id="nh-rate" title="time-acceleration vs real (1:1) — 1× is real time"></span>
      </div>
      <div class="nh-speed" title="playback speed — drag from real time (left) to fast (right), or step ÷8 … ×8">
        <span class="nh-spd-btns">
          <button class="btn sm nh-rr" id="nh-s3" title="÷8 — much slower">÷8</button>
          <button class="btn sm nh-rr" id="nh-s2" title="÷4 slower">÷4</button>
          <button class="btn sm nh-rr" id="nh-s1" title="÷2 slower ( - )">÷2</button>
        </span>
        <input type="range" class="nh-slider" id="nh-slider" min="0" max="1000" step="1" value="1000" title="drag: real time ⟵ … ⟶ fast" />
        <span class="nh-spd-btns">
          <button class="btn sm nh-rr" id="nh-f1" title="×2 faster ( = )">×2</button>
          <button class="btn sm nh-rr" id="nh-f2" title="×4 faster">×4</button>
          <button class="btn sm nh-rr" id="nh-f3" title="×8 — much faster">×8</button>
        </span>
      </div>
      <div class="nh-ctrls">
        <button class="btn sm" id="nh-prev" title="previous stop ([)">◀</button>
        <button class="btn sm" id="nh-pause" title="hold / resume (Space)">❚❚ hold</button>
        <button class="btn sm" id="nh-next" title="next stop (])">▶</button>
        <button class="btn sm" id="nh-track" title="tracking panel (T)">▤ track</button>
        <button class="btn sm" id="nh-tag" title="ship tag — info card anchored to the ship">◈ tag</button>
        <button class="btn sm" id="nh-stop" title="disengage (Esc)">■ disengage</button>
      </div>`;
    hud.querySelector('#nh-prev').onclick = () => app.navStep(-1);
    hud.querySelector('#nh-next').onclick = () => app.navStep(1);
    hud.querySelector('#nh-pause').onclick = () => app.pauseRoute();
    hud.querySelector('#nh-track').onclick = () => app.setTrackPanel(!app.showTrackPanel);
    hud.querySelector('#nh-tag').onclick = () => app.setShipTag(!app.showShipTag);
    hud.querySelector('#nh-stop').onclick = () => app.stopRoute();
    const mul = (m) => app.setFlightRate((app._flightRate || 1) * m);
    hud.querySelector('#nh-s3').onclick = () => mul(1 / 8);
    hud.querySelector('#nh-s2').onclick = () => mul(1 / 4);
    hud.querySelector('#nh-s1').onclick = () => mul(1 / 2);
    hud.querySelector('#nh-f1').onclick = () => mul(2);
    hud.querySelector('#nh-f2').onclick = () => mul(4);
    hud.querySelector('#nh-f3').onclick = () => mul(8);
    const slider = hud.querySelector('#nh-slider');
    slider.oninput = () => app.setFlightRate(sliderToRate(+slider.value));
  }

  function patchActive(n) {
    if (!hud.querySelector('#nh-crossing')) { buildNav(n, 'active'); }   // defensive: skeleton lost
    const dv = n.drive || { cls: '', name: '', sc: n.cruiseC };
    const set = (id, text) => { const el = hud.querySelector(id); if (el) el.textContent = text; };
    set('#nh-crossing', `CROSSING ${n.seg}/${n.total}`);
    set('#nh-to', `→ ${n.toLabel}`);
    const v = hud.querySelector('#nh-v'); if (v) { v.textContent = `${dv.cls ? dv.cls + ' · ' : ''}${fmtDriveSpeed(dv.sc)}`; v.title = dv.name || ''; }
    set('#nh-hdg', `${fmtRA(n.ra)} ${fmtDec(n.dec)}`);
    set('#nh-range', fmtLy(n.rangeLy));
    set('#nh-coord', fmtYr(n.etaNext.years));
    set('#nh-crew', fmtYr(n.etaNext.shipYears));
    set('#nh-seamleft', `seam left ${fmtLy(n.rangeLyTotal ?? 0)}`);
    set('#nh-totaltime', `coord ${fmtYr(n.etaTotal.years)} · crew ${fmtYr(n.etaTotal.shipYears)}`);
    set('#nh-story', `${n.storyTime ?? '—'} (1:1)`);
    set('#nh-watch', `· watch ${fmtWatch(n.watchSec)}`);
    set('#nh-rate', fmtAccel(n.accel));
    const acc = hud.querySelector('#nh-rate'); if (acc) acc.title = `watching at ${fmtAccel(n.accel)} real time — this preview ≈ ${fmtWatch(n.watchSec)}; 1× would be the full ${n.storyTime ?? 'voyage'}`;
    const rate = n.rate ?? 1;
    const slider = hud.querySelector('#nh-slider');
    if (slider && document.activeElement !== slider) slider.value = String(Math.round(rateToSlider(rate)));
    const atFloor = rate <= 1 / 2048 * 1.001, atCeil = rate >= 8 * 0.999;
    ['#nh-s1', '#nh-s2', '#nh-s3'].forEach((id) => { const b = hud.querySelector(id); if (b) b.disabled = atFloor; });
    ['#nh-f1', '#nh-f2', '#nh-f3'].forEach((id) => { const b = hud.querySelector(id); if (b) b.disabled = atCeil; });
    const pa = hud.querySelector('#nh-pause'); if (pa) pa.textContent = n.paused ? '⏵ resume' : '❚❚ hold';
    const tr = hud.querySelector('#nh-track'); if (tr) tr.classList.toggle('on', !!app.showTrackPanel);
    const tg = hud.querySelector('#nh-tag'); if (tg) tg.classList.toggle('on', !!app.showShipTag);
  }

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
    const dv = t.drive || { cls: '', name: '', regime: '', sc: t.cruiseC };
    panel.innerHTML = `
      <div class="tp-h">◎ TRACKING <span class="tp-leg">${t.paused ? '❚❚ ' : ''}CROSSING ${t.seg}/${t.total}</span></div>
      <div class="tp-route">${esc(t.from)} <span class="muted">→</span> <b>${esc(t.to)}</b></div>
      <div class="tp-bar"><i style="width:${Math.round(t.progress * 100)}%"></i></div>
      <dl class="tp-dl">
        <dt>position</dt><dd>${fmtRA(t.posRa)} ${fmtDec(t.posDec)}</dd>
        <dt></dt><dd class="muted">${fmtLy(t.distLy)} from Sol</dd>
        <dt>heading</dt><dd>${fmtRA(t.hdgRa)} ${fmtDec(t.hdgDec)}</dd>
        <dt>drive</dt><dd>${esc(dv.name)} <span class="muted">· Class ${dv.cls}</span></dd>
        <dt>crossing v</dt><dd>${fmtDriveSpeed(dv.sc)} <span class="muted">· ${esc(dv.regime)}</span></dd>
        <dt>to next</dt><dd>${fmtLy(t.legRemainLy)} · ${fmtYr(t.etaLeg.years)}</dd>
        <dt>travelled</dt><dd>${fmtLy(t.doneLy)} <span class="muted">/ ${fmtLy(t.totalLy)}</span></dd>
        <dt>remaining</dt><dd>${fmtLy(t.remainLy)} · ${fmtYr(t.etaTotal.years)} <span class="muted">(crew ${fmtYr(t.etaTotal.shipYears)})</span></dd>
      </dl>`;
  });
}

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
// The slider maps its 0–1000 track to the flight-rate range log-uniformly, so each
// pixel is a constant *ratio* — the natural feel for a speed that spans 1/2048×–8×.
const RATE_MIN = 1 / 2048, RATE_MAX = 8;
const sliderToRate = (v) => RATE_MIN * Math.pow(RATE_MAX / RATE_MIN, Math.max(0, Math.min(1000, v)) / 1000);
const rateToSlider = (r) => 1000 * Math.log(Math.max(RATE_MIN, Math.min(RATE_MAX, r)) / RATE_MIN) / Math.log(RATE_MAX / RATE_MIN);

// The playback speed as an honest time-acceleration vs real time: 1× is 1:1 (you'd
// wait the whole voyage), so the watchable preview is a big multiple — ×2.6k for a
// Tekné dash, ×225k for a bridge run, ×100M for a sub-light crawl.
function fmtAccel(a) {
  if (!isFinite(a) || a <= 0) return '—';
  if (a < 1000) return `×${Math.max(1, Math.round(a))}`;
  for (const [d, s] of [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'k']]) {
    if (a >= d) { const v = a / d; return `×${v < 10 ? v.toFixed(1) : Math.round(v)}${s}`; }
  }
  return `×${Math.round(a)}`;
}
// Wall-clock the current preview will take.
function fmtWatch(s) {
  if (!isFinite(s) || s <= 0) return '—';
  if (s >= 86400) return `${(s / 86400).toFixed(1)} d`;
  if (s >= 3600) return `${(s / 3600).toFixed(1)} h`;
  if (s >= 90) return `${Math.round(s / 60)} min`;
  return `${Math.round(s)}s`;
}
function download(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function el(tag, id) { const e = document.createElement(tag); e.id = id; return e; }
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
