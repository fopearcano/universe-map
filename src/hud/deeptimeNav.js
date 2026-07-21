// The DEEPTIME navigator — a small top-centre panel shown only in deeptime mode.
// A dropdown jumps to any of the navigable galaxies, a breadcrumb shows the
// matrioska level (universe → galaxy interior), and enter / ↑ overview descend
// into a galaxy's own star field and rise back out.
export function initDeeptimeNav(app) {
  const el = document.createElement('div');
  el.id = 'deeptimenav';
  el.hidden = true;
  document.body.appendChild(el);

  let state = { level: 0, galaxies: [], galaxy: null };

  function render() {
    if (app.mode !== 'deeptime') { el.hidden = true; return; }
    el.hidden = false;
    const opts = state.galaxies.map((g) => `<option value="${g.i}">${g.home ? '⌂ ' : ''}${esc(g.name)} · ${esc(g.type)}</option>`).join('');
    const crumb = state.level === 1 && state.galaxy
      ? `⧗ DEEPTIME <span class="dtn-sep">›</span> <b>${esc(state.galaxy.name)}</b> <span class="muted">· ${fmt(state.galaxy.count)} stars</span>`
      : `⧗ DEEPTIME <span class="muted">· universe · ${state.galaxies.length} navigable galaxies</span>`;
    el.innerHTML = `
      <div class="dtn-crumb">${crumb}</div>
      <div class="dtn-row">
        <span class="dtn-lbl">galaxy</span>
        <select id="dtn-sel" title="jump to a navigable galaxy">${opts}</select>
        ${state.level === 0
          ? '<button class="btn sm" id="dtn-enter" title="fly inside the selected galaxy">⛶ enter</button>'
          : '<button class="btn sm" id="dtn-up" title="rise back to the universe overview">↑ overview</button>'}
      </div>`;
    const sel = el.querySelector('#dtn-sel');
    if (sel && state.level === 0) sel.onchange = () => app.deeptimeFocus(+sel.value);
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
