// The Cosmic Atlas browser + Story Studio controls. Lists the curated knowledge
// base plus the user's persistent library (imagined objects + live SIMBAD finds),
// filterable by category/text. Studio bar: author an imagined object, resolve a
// real one live, and import/export the library.
export function buildAtlasBrowser(app) {
  const root = document.getElementById('tab-atlas');
  const cats = app.atlasCategories || {};
  const objs = app.atlas || [];
  let activeCat = 'all', q = '';

  const rgb = (c) => `rgb(${(c[0] * 255) | 0},${(c[1] * 255) | 0},${(c[2] * 255) | 0})`;
  const catKeys = Object.keys(cats);

  root.innerHTML = `
    <div class="muted" style="margin-bottom:8px">A curated knowledge base across every class, plus <b>your library</b> of imagined objects & live finds. Not exhaustive; extensible.</div>
    <div class="studio-bar">
      <button class="btn sm" id="st-add">✦ Imagine</button>
      <button class="btn sm" id="st-import">⇩ import</button>
      <button class="btn sm" id="st-export">⇧ export</button>
      <button class="btn sm" id="st-clear" title="delete your whole library">clear</button>
      <input id="st-file" type="file" accept="application/json,.json" hidden />
    </div>
    <div class="studio-resolve">
      <input id="st-resolve" type="text" placeholder="resolve a real object live (SIMBAD)…" autocomplete="off" />
      <button class="btn sm" id="st-go">⟲</button>
    </div>
    <div id="st-status" class="muted"></div>
    <input id="atlas-q" class="atlas-q" type="text" placeholder="filter the atlas…" autocomplete="off" spellcheck="false" />
    <div class="atlas-chips" id="atlas-chips"></div>
    <div class="atlas-count muted" id="atlas-count"></div>
    <div class="atlas-list" id="atlas-list"></div>`;

  const status = root.querySelector('#st-status');
  root.querySelector('#st-add').onclick = () => app._openStudio && app._openStudio();
  root.querySelector('#st-export').onclick = () => download('universe-map-library.json', app.exportCustom());
  root.querySelector('#st-clear').onclick = () => { if (app.userStore.all().length && confirm('Delete your entire custom library?')) app.clearCustom(); };
  const file = root.querySelector('#st-file');
  root.querySelector('#st-import').onclick = () => file.click();
  file.onchange = async () => {
    const f = file.files[0]; if (!f) return;
    const r = app.importCustom(await f.text());
    status.textContent = r.ok ? `imported ${r.added} record(s)` : `import failed: ${r.note}`;
    file.value = '';
  };
  const resolve = root.querySelector('#st-resolve');
  const doResolve = async () => {
    const name = resolve.value.trim(); if (!name) return;
    status.innerHTML = '<span style="color:var(--cyan)">querying SIMBAD…</span>';
    const r = await app.resolveAndAdd(name);
    status.innerHTML = r.ok ? `<span style="color:var(--green)">added ${esc(r.rec.name)} to your library</span>` : `<span style="color:var(--amber)">${esc(r.note || 'not found')}</span>`;
    if (r.ok) resolve.value = '';
  };
  root.querySelector('#st-go').onclick = doResolve;
  resolve.addEventListener('keydown', (e) => { if (e.key === 'Enter') doResolve(); });

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
    chipsEl.appendChild(mkChip('mine', '✦ mine', [1, 0.36, 0.94]));
    for (const k of catKeys) chipsEl.appendChild(mkChip(k, shortLabel(cats[k].label), cats[k].color));
  }
  syncChips();

  const listEl = root.querySelector('#atlas-list');
  const countEl = root.querySelector('#atlas-count');
  function renderList() {
    const ql = q.trim().toLowerCase();
    const custom = app.userStore.all().map((o) => ({ o, custom: true }))
      .filter(({ o }) => (activeCat === 'all' || activeCat === 'mine' || o.category === activeCat) &&
        (!ql || (o.name + ' ' + (o.type || '')).toLowerCase().includes(ql)));
    const atlasRows = (activeCat === 'mine') ? [] : objs.map((o, i) => ({ o, i }))
      .filter(({ o }) => (activeCat === 'all' || o.category === activeCat) &&
        (!ql || (o.name + ' ' + o.type + ' ' + (cats[o.category]?.label || '')).toLowerCase().includes(ql)));
    countEl.textContent = `${custom.length + atlasRows.length} object${custom.length + atlasRows.length === 1 ? '' : 's'}` +
      (custom.length ? ` · ${custom.length} yours` : '');
    const customHTML = custom.map(({ o }) => {
      const col = o.kind === 'imagined' ? [1, 0.36, 0.94] : (cats[o.category]?.color || [0.5, 1, 0.62]);
      return `<div class="atlas-item custom" data-cid="${o.id}">
        <span class="atlas-dot" style="background:${rgb(col)};color:${rgb(col)}"></span>
        <span class="atlas-nm">${o.kind === 'imagined' ? '✦ ' : ''}${esc(o.name)}</span>
        <span class="atlas-sub">${esc(o.type || o.kind)} · ${fmtLy(o.distLy)}</span>
        <span class="atlas-actions"><button data-edit="${o.id}" title="edit">✎</button><button data-del="${o.id}" title="delete">🗑</button></span>
      </div>`;
    }).join('');
    const atlasHTML = atlasRows.map(({ o, i }) =>
      `<div class="atlas-item" data-i="${i}">
        <span class="atlas-dot" style="background:${rgb(o.color)};color:${rgb(o.color)}"></span>
        <span class="atlas-nm">${esc(o.name)}</span>
        <span class="atlas-sub">${esc(o.type)} · ${fmtLy(o.distLy)}</span>
      </div>`).join('');
    listEl.innerHTML = (customHTML + atlasHTML) || '<div class="muted" style="padding:8px 0">no matches</div>';
    listEl.querySelectorAll('.atlas-item[data-i]').forEach((el) => { el.onclick = () => app.selectAtlas(+el.dataset.i, { fly: true }); });
    listEl.querySelectorAll('.atlas-item[data-cid]').forEach((el) => {
      el.onclick = (e) => { if (e.target.dataset.edit || e.target.dataset.del) return; app.selectCustom(el.dataset.cid, { fly: true }); };
    });
    listEl.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => app._openStudio(app.userStore.get(b.dataset.edit)); });
    listEl.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => app.removeCustomObject(b.dataset.del); });
  }
  renderList();

  root.querySelector('#atlas-q').addEventListener('input', (e) => { q = e.target.value; renderList(); });
}

function download(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function shortLabel(l) {
  return l.replace('Supermassive black holes', 'SMBH').replace('Stellar black holes', 'Stellar BH')
    .replace('Neutron stars & pulsars', 'Pulsars').replace('Supernovae & remnants', 'Supernovae')
    .replace('Exoplanet systems', 'Exoplanets').replace('Notable galaxies', 'Galaxies')
    .replace('Quasars & blazars', 'Quasars').replace('Transient events', 'Transients');
}
function fmtLy(ly) {
  if (ly >= 1e9) return `${(ly / 1e9).toFixed(1)} Gly`;
  if (ly >= 1e6) return `${(ly / 1e6).toFixed(1)} Mly`;
  if (ly >= 1e3) return `${(ly / 1e3).toFixed(1)} kly`;
  return `${(ly || 0).toFixed(0)} ly`;
}
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
