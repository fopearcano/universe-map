// The DEEPTIME navigator — a small top-centre panel shown only in deeptime mode.
// A filter box + dropdown jump to any of the ~1000 navigable galaxies, a
// breadcrumb shows the matrioska level (universe → galaxy interior), and
// enter / ↑ overview descend into a galaxy's own star field and rise back out.
const MAX_OPTS = 600;   // cap the rendered <option> count so a huge list stays snappy

export function initDeeptimeNav(app) {
  const el = document.createElement('div');
  el.id = 'deeptimenav';
  el.hidden = true;
  document.body.appendChild(el);

  let state = { level: 0, galaxies: [], galaxy: null };
  let filter = '';

  // options for the <select>, filtered by name/type; home always first, capped.
  function optionsHtml() {
    const q = filter.trim().toLowerCase();
    let list = state.galaxies;
    if (q) list = list.filter((g) => g.home || g.name.toLowerCase().includes(q) || String(g.type).toLowerCase().includes(q));
    const shown = list.slice(0, MAX_OPTS);
    const opts = shown.map((g) => `<option value="${g.i}">${g.home ? '⌂ ' : ''}${esc(g.name)} · ${esc(g.type)}</option>`).join('');
    const more = list.length > shown.length ? `<option disabled>…${fmt(list.length - shown.length)} more — refine the filter</option>` : '';
    return { html: opts + more, count: list.length };
  }

  function render() {
    if (app.mode !== 'deeptime') { el.hidden = true; return; }
    el.hidden = false;
    const inside = state.level === 1 && state.galaxy;
    const crumb = inside
      ? `⧗ DEEPTIME <span class="dtn-sep">›</span> <b>${esc(state.galaxy.name)}</b> <span class="muted">· ${fmt(state.galaxy.count)} stars</span>`
      : `⧗ DEEPTIME <span class="muted">· universe · ${fmt(state.galaxies.length)} navigable galaxies</span>`;
    const { html, count } = optionsHtml();
    el.innerHTML = `
      <div class="dtn-crumb">${crumb}</div>
      <div class="dtn-row">
        ${!inside ? `<input id="dtn-filter" class="dtn-filter" type="text" placeholder="filter…" value="${esc(filter)}" title="filter the navigable galaxies by name or type" />` : ''}
        <span class="dtn-lbl">galaxy</span>
        <select id="dtn-sel" title="jump to a navigable galaxy">${html}</select>
        ${!inside
          ? '<button class="btn sm" id="dtn-enter" title="fly inside the selected galaxy">⛶ enter</button>'
          : '<button class="btn sm" id="dtn-up" title="rise back to the universe overview">↑ overview</button>'}
      </div>
      ${!inside && filter ? `<div class="dtn-hint muted">${fmt(count)} match${count === 1 ? '' : 'es'}</div>` : ''}`;
    const sel = el.querySelector('#dtn-sel');
    if (sel && !inside) sel.onchange = () => { const v = +sel.value; if (!Number.isNaN(v)) app.deeptimeFocus(v); };
    const fin = el.querySelector('#dtn-filter');
    if (fin) {
      fin.oninput = () => { filter = fin.value; const { html } = optionsHtml(); if (sel) sel.innerHTML = html; const hint = el.querySelector('.dtn-hint'); if (hint) hint.remove(); };
      fin.onkeydown = (e) => { if (e.key === 'Enter') { const s = el.querySelector('#dtn-sel'); if (s && s.value) app.deeptimeEnterGalaxy(+s.value); } };
    }
    const enter = el.querySelector('#dtn-enter'); if (enter) enter.onclick = () => app.deeptimeEnterGalaxy(+(sel?.value ?? 0));
    const up = el.querySelector('#dtn-up'); if (up) up.onclick = () => app.deeptimeExitToOverview();
  }

  app.on('mode', () => render());
  app.on('deeptime', (s) => {
    state = { level: s.level, galaxies: s.galaxies || state.galaxies, galaxy: s.galaxy || null };
    render();
  });
}

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function fmt(n) { return (n || 0).toLocaleString('en-US'); }
