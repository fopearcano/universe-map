import { fmtDist } from '../util/astro.js';

// Voyage browser (left dock) + the story-card player (bottom).
export function initVoyages(app) {
  const list = document.getElementById('tab-voyages');
  const player = document.getElementById('voyageplayer');
  let autoTimer = null;

  // ---- list ----
  const KIND = { survey: 'survey traverse', probe: 'real spacecraft', myth: 'narrative odyssey' };
  list.innerHTML = `<div class="muted" style="margin-bottom:10px">Track a story-voyage across the star field — a route of waypoints with a narrative at each stop, like a chart of Ulysses' or Darwin's journey.</div>` +
    app.catalog.voyages.map((v) => `
      <div class="voyage-card" data-id="${v.id}">
        <div class="vk">${KIND[v.kind] || v.kind} · ${v.waypoints.length} stops</div>
        <h4>${esc(v.title)}</h4>
        <p>${esc(v.subtitle)}</p>
      </div>`).join('');
  list.querySelectorAll('.voyage-card').forEach((el) => {
    el.onclick = () => app.startVoyage(el.dataset.id);
  });

  // ---- player ----
  function stopAuto() { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; renderCtrls(); } }

  app.on('voyage', ({ voyage, index }) => {
    player.hidden = false;
    render(voyage, index);
  });
  app.on('voyageEnd', () => { stopAuto(); player.hidden = true; player.innerHTML = ''; });

  function render(v, index) {
    const w = v.waypoints[index];
    const isFirst = index === 0, isLast = index === v.waypoints.length - 1;
    player.innerHTML = `
      <div class="vp-top">
        <div class="vp-title"><b>${esc(v.title)}</b> — ${esc(v.kind === 'myth' ? 'an odyssey' : v.kind)}</div>
        <button class="vp-close" title="exit voyage">✕</button>
      </div>
      <div class="vp-progress">${v.waypoints.map((_, k) =>
        `<i class="${k < index ? 'done' : k === index ? 'cur' : ''}" data-k="${k}"></i>`).join('')}</div>
      <div class="vp-wpname">${index}. ${esc(w.name)}</div>
      <div class="vp-narr">${esc(w.narrative)}</div>
      <div class="vp-meta">
        ${w.i === 0 ? '' : `<span>dist <span class="v">${w.distanceLy ? w.distanceLy + ' ly' : fmtDist(0)}</span></span>`}
        ${w.spect ? `<span>type <span class="v">${esc(w.spect)}</span></span>` : ''}
        ${w.catalogDistLy ? `<span>catalogue <span class="v">${w.catalogDistLy} ly</span></span>` : ''}
      </div>
      <div class="vp-ctrls">
        <button class="btn sm" id="vp-prev" ${isFirst ? 'disabled' : ''}>◀ prev</button>
        <span class="step">${index + 1} / ${v.waypoints.length}</span>
        <button class="btn sm" id="vp-next" ${isLast ? 'disabled' : ''}>next ▶</button>
        <button class="btn sm" id="vp-auto">${autoTimer ? '❚❚ pause' : '▶ autoplay'}</button>
      </div>`;

    player.querySelector('.vp-close').onclick = () => app.stopVoyage();
    player.querySelector('#vp-prev').onclick = () => { stopAuto(); app.voyageStep(-1); };
    player.querySelector('#vp-next').onclick = () => { stopAuto(); app.voyageStep(1); };
    player.querySelector('#vp-auto').onclick = () => toggleAuto(v);
    player.querySelectorAll('.vp-progress i').forEach((el) => { el.onclick = () => { stopAuto(); app.voyageGoto(+el.dataset.k); }; });
  }

  function renderCtrls() {
    const btn = player.querySelector('#vp-auto');
    if (btn) btn.textContent = autoTimer ? '❚❚ pause' : '▶ autoplay';
  }

  function toggleAuto(v) {
    if (autoTimer) { stopAuto(); return; }
    autoTimer = setInterval(() => {
      if (app.voyageIndex >= v.waypoints.length - 1) { stopAuto(); return; }
      app.voyageStep(1);
    }, 5200);
    renderCtrls();
  }
}

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
