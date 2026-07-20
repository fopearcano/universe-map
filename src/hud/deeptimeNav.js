// The DEEPTIME navigator — a small top-centre panel shown only in deeptime mode.
// A dropdown jumps to any of the local groups, a breadcrumb shows the matrioska
// level (cosmic web → local group), and enter / ↑ overview descend and rise.
export function initDeeptimeNav(app) {
  const el = document.createElement('div');
  el.id = 'deeptimenav';
  el.hidden = true;
  document.body.appendChild(el);

  let state = { level: 0, groups: [], group: null };

  function render() {
    if (app.mode !== 'deeptime') { el.hidden = true; return; }
    el.hidden = false;
    const opts = state.groups.map((g) => `<option value="${g.i}">${esc(g.name)} · ${g.count} gx</option>`).join('');
    const crumb = state.level === 1 && state.group
      ? `⧗ DEEPTIME <span class="dtn-sep">›</span> <b>${esc(state.group.name)}</b> <span class="muted">· ${state.group.count} galaxies</span>`
      : `⧗ DEEPTIME <span class="muted">· cosmic web · ${state.groups.length} local groups</span>`;
    el.innerHTML = `
      <div class="dtn-crumb">${crumb}</div>
      <div class="dtn-row">
        <span class="dtn-lbl">group</span>
        <select id="dtn-sel" title="jump to a local group">${opts}</select>
        ${state.level === 0
          ? '<button class="btn sm" id="dtn-enter" title="descend into the selected local group">⛶ enter</button>'
          : '<button class="btn sm" id="dtn-up" title="rise back to the cosmic-web overview">↑ overview</button>'}
      </div>`;
    const sel = el.querySelector('#dtn-sel');
    if (sel && state.group) sel.value = String(state.group.i);
    if (sel) sel.onchange = () => app.deeptimeFocus(+sel.value);
    const enter = el.querySelector('#dtn-enter'); if (enter) enter.onclick = () => app.deeptimeEnterGroup(+(sel?.value ?? 0));
    const up = el.querySelector('#dtn-up'); if (up) up.onclick = () => app.deeptimeExitToOverview();
  }

  app.on('mode', () => render());
  app.on('deeptime', (s) => { state = { level: s.level, groups: s.groups || state.groups, group: s.group || null }; render(); });
}

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
