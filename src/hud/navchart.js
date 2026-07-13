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
        <div><span>Idrenes bridges</span><span class="v">${s.crossings ?? Math.max(0, pts.length - 1)}</span></div>
        <div title="the log-radial map exaggerates distance — this is the route's real reach against the observable universe (~45 Gly radius)"><span>reach · of universe</span><span class="v">${fmtLy(s.reachLy)} · ${pct < 1 ? pct.toFixed(2) : pct.toFixed(1)}%</span></div>
      </div>
      <div class="rp-preview muted">▶ ENGAGE plays a map preview — the real crossing takes the coordinate / crew time above.</div>` : '';

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
    const dv = n.drive || { cls: '', name: '', sc: n.cruiseC };
    hud.innerHTML = `
      <div class="nh-row nh-top">
        <span class="nh-leg">CROSSING ${n.seg}/${n.total}</span>
        <span class="nh-to">→ ${esc(n.toLabel)}</span>
        <span class="nh-v" title="${esc(dv.name)}">${dv.cls ? dv.cls + ' · ' : ''}${fmtDriveSpeed(dv.sc)}</span>
      </div>
      <div class="nh-row nh-data">
        <span><i>HDG</i> ${fmtRA(n.ra)} ${fmtDec(n.dec)}</span>
        <span><i>RANGE</i> ${fmtLy(n.rangeLy)}</span>
        <span><i>COORD</i> ${fmtYr(n.etaNext.years)}</span>
        <span><i>CREW</i> ${fmtYr(n.etaNext.shipYears)}</span>
      </div>
      <div class="nh-row nh-total muted"><span>seam left ${fmtLy(n.rangeLyTotal ?? 0)}</span><span>coord ${fmtYr(n.etaTotal.years)} · crew ${fmtYr(n.etaTotal.shipYears)}</span></div>
      <div class="nh-row nh-story" title="the crew's lived journey time — the flythrough on screen is a compressed preview">
        <span><i>STORY</i> ${esc(n.storyTime ?? '—')}</span>
        <span class="nh-rate-ctrl">
          <button class="btn sm nh-rr" id="nh-slower" title="slower playback"${(n.rate ?? 1) <= 0.25 ? ' disabled' : ''}>–</button>
          <span class="nh-rate" title="flythrough playback speed">${fmtRate(n.rate ?? 1)}</span>
          <button class="btn sm nh-rr" id="nh-faster" title="faster playback"${(n.rate ?? 1) >= 8 ? ' disabled' : ''}>+</button>
        </span>
      </div>
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
    hud.querySelector('#nh-slower').onclick = () => app.setFlightRate((app._flightRate || 1) / 2);
    hud.querySelector('#nh-faster').onclick = () => app.setFlightRate((app._flightRate || 1) * 2);
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
// Playback rate as a clean fraction / multiple (¼× ½× 1× 2× 4× 8×).
function fmtRate(r) {
  if (r <= 0.26) return '¼×';
  if (r <= 0.51) return '½×';
  if (r < 1.5) return '1×';
  return `${Math.round(r)}×`;
}
function download(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function el(tag, id) { const e = document.createElement(tag); e.id = id; return e; }
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
