// Search. In local mode: stars by name / Bayer-Flamsteed / HIP / HD / constellation.
// In cosmos mode: named Local Group galaxies. Selecting a result flies to it.
export function initSearch(app) {
  const input = document.getElementById('search');
  const box = document.getElementById('search-results');
  const cat = app.catalog;
  let results = [], active = -1;

  const conByName = cat.meta.constellations.map((c, i) => ({ i, full: c[1], abbr: c[0] }));

  app.on('mode', (m) => {
    input.value = ''; results = []; box.classList.remove('open');
    input.placeholder = m === 'cosmos'
      ? '◈ search  ·  Andromeda, Triangulum, LMC…'
      : '◈ search  ·  name, HIP 32349, HD 48915, constellation…';
  });

  function queryCosmos(q) {
    return app.cosmos.data.localGroup
      .map((g, i) => ({ g, i }))
      .filter(({ g }) => g.name.toLowerCase().includes(q))
      .slice(0, 20)
      .map(({ g, i }) => ({ cosmos: true, i, name: g.name, sub: `${g.type} · ${(g.distMpc * 3.2615638).toFixed(2)} Mly` }));
  }

  function queryLocal(q) {
    const out = [];
    const mHip = q.match(/^hip\s*(\d+)$/), mHd = q.match(/^hd\s*(\d+)$/);
    if (mHip || mHd) {
      const arr = mHip ? cat.hip : cat.hd, num = +(mHip ? mHip[1] : mHd[1]);
      for (let i = 0; i < cat.count; i++) if (arr[i] === num) { out.push(entry(i)); break; }
    }
    for (const e of cat.search) {
      if (out.length > 40) break;
      const hay = `${e.name} ${e.bf || ''} ${e.gl || ''} ${e.hip ? 'hip ' + e.hip : ''} ${e.hd ? 'hd ' + e.hd : ''}`.toLowerCase();
      if (hay.includes(q)) out.push({ i: e.i, name: e.name, sub: subFor(e) });
    }
    if (q.length >= 3) {
      for (const c of conByName) {
        if (out.length > 44) break;
        if (c.full.toLowerCase().includes(q) || c.abbr.toLowerCase() === q) {
          const bi = brightestIn(c.i);
          if (bi >= 0) out.push({ i: bi, name: c.full, sub: 'constellation · brightest star' });
        }
      }
    }
    const seen = new Set();
    return out.filter((o) => (seen.has(o.i) ? false : (seen.add(o.i), true))).slice(0, 30);
  }

  function queryAtlas(q) {
    return (app.atlas || []).map((o, i) => ({ o, i }))
      .filter(({ o }) => (o.name + ' ' + o.type + ' ' + (app.atlasCategories?.[o.category]?.label || '')).toLowerCase().includes(q))
      .slice(0, 12)
      .map(({ o, i }) => ({ atlas: true, i, name: o.name, sub: `${o.type} · ${fmtLy(o.distLy)}` }));
  }

  function query(qRaw) {
    const q = qRaw.trim().toLowerCase();
    if (q.length < 1) return [];
    const base = app.mode === 'cosmos' ? queryCosmos(q) : queryLocal(q);
    return [...queryAtlas(q), ...base].slice(0, 34);
  }

  function entry(i) { const s = cat.star(i); return { i, name: s.name, sub: `${s.spect} · ${s.distLy.toFixed(1)} ly` }; }
  function subFor(e) {
    const parts = [];
    if (e.spect) parts.push(e.spect);
    if (e.dist != null) parts.push(`${e.dist} ly`);
    if (e.con != null && cat.conAbbr(e.con)) parts.push(cat.conAbbr(e.con));
    return parts.join(' · ');
  }
  function brightestIn(con) {
    let best = -1, bestMag = Infinity;
    for (let i = 0; i < cat.count; i++) if (cat.con[i] === con && cat.mag[i] < bestMag) { bestMag = cat.mag[i]; best = i; }
    return best;
  }

  function render() {
    if (!results.length) { box.classList.remove('open'); box.innerHTML = ''; return; }
    box.innerHTML = results.map((r, k) =>
      `<div class="sr-item ${k === active ? 'active' : ''}" data-k="${k}"><span class="sr-name">${esc(r.name)}</span><span class="sr-sub">${esc(r.sub)}</span></div>`).join('');
    box.classList.add('open');
    box.querySelectorAll('.sr-item').forEach((el) => { el.onclick = () => choose(+el.dataset.k); });
  }

  function choose(k) {
    const r = results[k]; if (!r) return;
    box.classList.remove('open'); input.blur();
    if (r.atlas) app.selectAtlas(r.i, { fly: true });
    else if (r.cosmos) app.selectObject({ kind: 'localgalaxy', i: r.i }, { fly: true });
    else app.selectStar(r.i, { fly: true });
  }

  input.addEventListener('input', () => { results = query(input.value); active = results.length ? 0 : -1; render(); });
  input.addEventListener('focus', () => { if (input.value) { results = query(input.value); render(); } });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { active = Math.min(results.length - 1, active + 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); render(); e.preventDefault(); }
    else if (e.key === 'Enter') { if (active >= 0) choose(active); }
    else if (e.key === 'Escape') { box.classList.remove('open'); input.blur(); }
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('#searchwrap')) box.classList.remove('open'); });
}

function fmtLy(ly) {
  if (ly >= 1e9) return `${(ly / 1e9).toFixed(1)} Gly`;
  if (ly >= 1e6) return `${(ly / 1e6).toFixed(1)} Mly`;
  if (ly >= 1e3) return `${(ly / 1e3).toFixed(1)} kly`;
  return `${ly.toFixed(0)} ly`;
}
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
