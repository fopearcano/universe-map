// The Cosmic Atlas browser: a filterable knowledge-base list of curated objects
// and events across every class. Selecting an entry flies to it (hopping to
// COSMOS if it's beyond the true-scale LOCAL view).
export function buildAtlasBrowser(app) {
  const root = document.getElementById('tab-atlas');
  const cats = app.atlasCategories || {};
  const objs = app.atlas || [];
  let activeCat = 'all', q = '';

  const rgb = (c) => `rgb(${(c[0] * 255) | 0},${(c[1] * 255) | 0},${(c[2] * 255) | 0})`;
  const catKeys = Object.keys(cats);

  root.innerHTML = `
    <div class="muted" style="margin-bottom:8px">A curated knowledge base of notable real objects & events across every class — black holes, pulsars, supernovae, nebulae, exoplanets, galaxies, quasars, transients, extreme stars. Not exhaustive; extensible.</div>
    <input id="atlas-q" class="atlas-q" type="text" placeholder="filter the atlas…" autocomplete="off" spellcheck="false" />
    <div class="atlas-chips" id="atlas-chips"></div>
    <div class="atlas-count muted" id="atlas-count"></div>
    <div class="atlas-list" id="atlas-list"></div>`;

  const chipsEl = root.querySelector('#atlas-chips');
  const mkChip = (key, label, color) => {
    const c = document.createElement('div');
    c.className = 'chip' + (key === activeCat ? ' on' : '');
    c.textContent = label;
    if (color) { c.style.borderColor = rgb(color); if (key === activeCat) { c.style.background = rgb(color); c.style.color = '#001018'; } }
    c.onclick = () => { activeCat = key; syncChips(); renderList(); };
    return c;
  };
  function syncChips() {
    chipsEl.innerHTML = '';
    chipsEl.appendChild(mkChip('all', 'all', null));
    for (const k of catKeys) chipsEl.appendChild(mkChip(k, shortLabel(cats[k].label), cats[k].color));
  }
  syncChips();

  const listEl = root.querySelector('#atlas-list');
  const countEl = root.querySelector('#atlas-count');
  function renderList() {
    const ql = q.trim().toLowerCase();
    const rows = objs.map((o, i) => ({ o, i }))
      .filter(({ o }) => (activeCat === 'all' || o.category === activeCat) &&
        (!ql || (o.name + ' ' + o.type + ' ' + (cats[o.category]?.label || '')).toLowerCase().includes(ql)));
    countEl.textContent = `${rows.length} object${rows.length === 1 ? '' : 's'}`;
    listEl.innerHTML = rows.map(({ o, i }) =>
      `<div class="atlas-item" data-i="${i}">
        <span class="atlas-dot" style="background:${rgb(o.color)};color:${rgb(o.color)}"></span>
        <span class="atlas-nm">${esc(o.name)}</span>
        <span class="atlas-sub">${esc(o.type)} · ${fmtLy(o.distLy)}</span>
      </div>`).join('') || '<div class="muted" style="padding:8px 0">no matches</div>';
    listEl.querySelectorAll('.atlas-item').forEach((el) => { el.onclick = () => app.selectAtlas(+el.dataset.i, { fly: true }); });
  }
  renderList();

  root.querySelector('#atlas-q').addEventListener('input', (e) => { q = e.target.value; renderList(); });
}

function shortLabel(l) {
  return l.replace('Supermassive black holes', 'SMBH').replace('Stellar black holes', 'Stellar BH')
    .replace('Neutron stars & pulsars', 'Pulsars').replace('Supernovae & remnants', 'Supernovae')
    .replace('Exoplanet systems', 'Exoplanets').replace('Notable galaxies', 'Galaxies')
    .replace('Quasars & blazars', 'Quasars').replace('Transient events', 'Transients')
    .replace('Extreme stars', 'Extreme stars');
}
function fmtLy(ly) {
  if (ly >= 1e9) return `${(ly / 1e9).toFixed(1)} Gly`;
  if (ly >= 1e6) return `${(ly / 1e6).toFixed(1)} Mly`;
  if (ly >= 1e3) return `${(ly / 1e3).toFixed(1)} kly`;
  return `${ly.toFixed(0)} ly`;
}
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
