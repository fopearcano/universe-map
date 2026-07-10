// Voyage list (per mode) + a shared story-card player driven by the App's
// normalized 'voyage' event.

const LOCAL_KIND = { survey: 'survey traverse', probe: 'real spacecraft', myth: 'narrative odyssey' };

export function buildLocalVoyageList(app) {
  const list = document.getElementById('tab-voyages');
  list.innerHTML = `<div class="muted" style="margin-bottom:10px">Track a story-voyage across the star field — a route of waypoints with a narrative at each stop, like a chart of Ulysses' or Darwin's journey.</div>` +
    app.catalog.voyages.map((v) => card(v.id, LOCAL_KIND[v.kind] || v.kind, v.waypoints.length, v.title, v.subtitle)).join('');
  wire(list, (id) => app.startVoyageLocal(id));
}

export function buildCosmosVoyageList(app) {
  const list = document.getElementById('tab-voyages');
  list.innerHTML = `<div class="muted" style="margin-bottom:10px">Ride the logarithmic scale ladder outward — from the Sun to the edge of the observable universe.</div>` +
    app.cosmosData.voyages.map((v) => card(v.id, 'scale ladder', v.stops.length, v.title, v.subtitle)).join('');
  wire(list, (id) => app.startVoyageCosmos(id));
}

function card(id, kind, n, title, subtitle) {
  return `<div class="voyage-card" data-id="${id}">
    <div class="vk">${kind} · ${n} stops</div><h4>${esc(title)}</h4><p>${esc(subtitle)}</p></div>`;
}
function wire(list, start) {
  list.querySelectorAll('.voyage-card').forEach((el) => { el.onclick = () => start(el.dataset.id); });
}

// ---- shared player ----
export function initVoyagePlayer(app) {
  const player = document.getElementById('voyageplayer');
  let autoTimer = null;
  const stopAuto = () => { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; } };

  app.on('voyage', (v) => { player.hidden = false; render(v); });
  app.on('voyageEnd', () => { stopAuto(); player.hidden = true; player.innerHTML = ''; });
  app.on('mode', () => { stopAuto(); player.hidden = true; player.innerHTML = ''; });

  function render(v) {
    const { index, total, card: c } = v;
    const isFirst = index === 0, isLast = index === total - 1;
    player.innerHTML = `
      <div class="vp-top">
        <div class="vp-title"><b>${esc(v.title)}</b> — ${esc(v.kind === 'myth' ? 'an odyssey' : v.kind)}</div>
        <button class="vp-close" title="exit voyage">✕</button>
      </div>
      <div class="vp-progress">${Array.from({ length: total }, (_, k) =>
        `<i class="${k < index ? 'done' : k === index ? 'cur' : ''}" data-k="${k}"></i>`).join('')}</div>
      <div class="vp-wpname">${index}. ${esc(c.name)}</div>
      <div class="vp-narr">${esc(c.narrative)}</div>
      <div class="vp-meta">${c.meta.map(([k, val]) => `<span>${esc(k)} <span class="v">${esc(val)}</span></span>`).join('')}</div>
      <div class="vp-ctrls">
        <button class="btn sm" id="vp-prev" ${isFirst ? 'disabled' : ''}>◀ prev</button>
        <span class="step">${index + 1} / ${total}</span>
        <button class="btn sm" id="vp-next" ${isLast ? 'disabled' : ''}>next ▶</button>
        <button class="btn sm" id="vp-auto">${autoTimer ? '❚❚ pause' : '▶ autoplay'}</button>
      </div>`;
    player.querySelector('.vp-close').onclick = () => app.stopVoyage();
    player.querySelector('#vp-prev').onclick = () => { stopAuto(); app.voyageStep(-1); };
    player.querySelector('#vp-next').onclick = () => { stopAuto(); app.voyageStep(1); };
    player.querySelector('#vp-auto').onclick = () => toggleAuto(total);
    player.querySelectorAll('.vp-progress i').forEach((el) => { el.onclick = () => { stopAuto(); app.voyageGoto(+el.dataset.k); }; });
  }

  function toggleAuto(total) {
    if (autoTimer) { stopAuto(); const b = player.querySelector('#vp-auto'); if (b) b.textContent = '▶ autoplay'; return; }
    autoTimer = setInterval(() => {
      if (app.voyageIndex >= total - 1) { stopAuto(); return; }
      app.voyageStep(1);
    }, 5600);
    const b = player.querySelector('#vp-auto'); if (b) b.textContent = '❚❚ pause';
  }
}

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
