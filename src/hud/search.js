// Search over the named/bright-star index, plus direct HIP/HD number lookup and
// constellation jumps. Selecting a result flies the camera to it.
export function initSearch(app) {
  const input = document.getElementById('search');
  const box = document.getElementById('search-results');
  const cat = app.catalog;
  let results = [], active = -1;

  const conByName = cat.meta.constellations.map((c, i) => ({ i, full: c[1], abbr: c[0] }));

  function query(qRaw) {
    const q = qRaw.trim().toLowerCase();
    if (q.length < 1) return [];
    const out = [];

    // direct HIP / HD number
    const mHip = q.match(/^hip\s*(\d+)$/); const mHd = q.match(/^hd\s*(\d+)$/);
    if (mHip || mHd) {
      const arr = mHip ? cat.hip : cat.hd; const num = +(mHip ? mHip[1] : mHd[1]);
      for (let i = 0; i < cat.count; i++) if (arr[i] === num) { out.push(entry(i)); break; }
    }

    // named index
    for (const e of cat.search) {
      if (out.length > 40) break;
      const hay = `${e.name} ${e.bf || ''} ${e.gl || ''} ${e.hip ? 'hip ' + e.hip : ''} ${e.hd ? 'hd ' + e.hd : ''}`.toLowerCase();
      if (hay.includes(q)) out.push({ i: e.i, name: e.name, sub: subFor(e) });
    }

    // constellation -> jump to its brightest star (guard: whole-catalogue scan,
    // so only for reasonably specific queries)
    if (q.length >= 3) {
      for (const c of conByName) {
        if (out.length > 44) break;
        if (c.full.toLowerCase().includes(q) || c.abbr.toLowerCase() === q) {
          const bi = brightestIn(c.i);
          if (bi >= 0) out.push({ i: bi, name: `${c.full}`, sub: `constellation · brightest star`, con: true });
        }
      }
    }
    // de-dup by index, cap
    const seen = new Set();
    return out.filter((o) => (seen.has(o.i) ? false : (seen.add(o.i), true))).slice(0, 30);
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
      `<div class="sr-item ${k === active ? 'active' : ''}" data-k="${k}">
        <span class="sr-name">${escapeHtml(r.name)}</span><span class="sr-sub">${escapeHtml(r.sub)}</span>
      </div>`).join('');
    box.classList.add('open');
    box.querySelectorAll('.sr-item').forEach((el) => {
      el.onclick = () => choose(+el.dataset.k);
    });
  }

  function choose(k) {
    const r = results[k]; if (!r) return;
    box.classList.remove('open'); input.blur();
    app.select(r.i, { fly: true });
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

function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
