// The "nautical chart" HUD: a focus chip (shows the current pivot object) and a
// route panel that lists waypoints with true relative distances between them.
// Distances are always the real metric separation (parsecs → ly/Mly/Gly), even in
// COSMOS mode where the display radius is logarithmic.
export function initNavChart(app) {
  const focusChip = el('div', 'focuschip'); focusChip.hidden = true; document.body.appendChild(focusChip);
  const panel = el('div', 'routepanel'); panel.hidden = true; document.body.appendChild(panel);

  app.on('mode', () => { focusChip.hidden = true; panel.hidden = true; });

  app.on('focus', (f) => {
    if (!f) { focusChip.hidden = true; return; }
    focusChip.hidden = false;
    focusChip.innerHTML = `<span class="fc-k">◎ FOCUS</span> <span class="fc-v">${esc(f.label)}</span> <button class="fc-x" title="recenter on Sol">✕</button>`;
    focusChip.querySelector('.fc-x').onclick = () => app.home();
  });

  app.on('route', (r) => {
    if (!r || !r.points.length) { panel.hidden = true; panel.innerHTML = ''; return; }
    panel.hidden = false;
    const legRows = r.legs.map((l, i) =>
      `<div class="rp-leg"><span>${i + 1}. ${esc(l.from)} → ${esc(l.to)}</span><span class="v">${fmtLy(l.ly)}</span></div>`).join('');
    const single = r.points.length === 1
      ? `<div class="muted" style="padding:4px 0">1 waypoint set — add another to measure a leg.</div>` : '';
    panel.innerHTML = `
      <div class="rp-top">
        <div class="rp-title">◈ ROUTE · <b>${r.points.length}</b> waypoint${r.points.length > 1 ? 's' : ''}</div>
        <button class="rp-x" title="clear route">✕</button>
      </div>
      <div class="rp-legs">${legRows}${single}</div>
      ${r.legs.length ? `<div class="rp-total">total path <span class="v">${fmtLy(r.totalLy)}</span></div>` : ''}
      <div class="rp-hint muted">click objects, then <b>＋ route</b> in their panel to add a waypoint</div>
      <div class="rp-ctrls"><button class="btn sm" id="rp-undo">⌫ remove last</button><button class="btn sm" id="rp-clear">clear</button></div>`;
    panel.querySelector('.rp-x').onclick = () => app.clearRoute();
    panel.querySelector('#rp-clear').onclick = () => app.clearRoute();
    panel.querySelector('#rp-undo').onclick = () => app.removeRouteWaypoint();
  });
}

function fmtLy(ly) {
  if (ly >= 1e9) return `${(ly / 1e9).toFixed(2)} Gly`;
  if (ly >= 1e6) return `${(ly / 1e6).toFixed(2)} Mly`;
  if (ly >= 1e3) return `${(ly / 1e3).toFixed(1)} kly`;
  return `${ly.toFixed(2)} ly`;
}
function el(tag, id) { const e = document.createElement(tag); e.id = id; return e; }
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
