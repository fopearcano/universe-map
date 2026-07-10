// Voyage list (per mode) + a shared story-card player driven by the App's
// normalized 'voyage' event.

const LOCAL_KIND = { survey: 'survey traverse', probe: 'real spacecraft', myth: 'narrative odyssey' };

const EXP_LEN = { short: 'short hop', medium: 'passage', epic: 'epic' };

export function buildLocalVoyageList(app) {
  const list = document.getElementById('tab-voyages');
  list.innerHTML = `<div class="muted" style="margin-bottom:10px">Track a story-voyage across the star field — a route of waypoints with a narrative at each stop, like a chart of Ulysses' or Darwin's journey.</div>` +
    app.catalog.voyages.map((v) => card(v.id, LOCAL_KIND[v.kind] || v.kind, v.waypoints.length, v.title, v.subtitle)).join('') +
    expeditionsBlock(app);
  wire(list, (id) => app.startVoyageLocal(id));
  wireExpeditions(list, app);
}

export function buildCosmosVoyageList(app) {
  const list = document.getElementById('tab-voyages');
  list.innerHTML = `<div class="muted" style="margin-bottom:10px">Ride the logarithmic scale ladder outward — from the Sun to the edge of the observable universe.</div>` +
    app.cosmosData.voyages.map((v) => card(v.id, 'scale ladder', v.stops.length, v.title, v.subtitle)).join('') +
    expeditionsBlock(app);
  wire(list, (id) => app.startVoyageCosmos(id));
  wireExpeditions(list, app);
}

function card(id, kind, n, title, subtitle) {
  return `<div class="voyage-card" data-id="${id}">
    <div class="vk">${kind} · ${n} stops</div><h4>${esc(title)}</h4><p>${esc(subtitle)}</p></div>`;
}
function wire(list, start) {
  list.querySelectorAll('.voyage-card').forEach((el) => { el.onclick = () => start(el.dataset.id); });
}

// ---- preset expeditions (story routes → NAV COMPUTER) ----
function expeditionsBlock(app) {
  const exps = app.expeditions || [];
  if (!exps.length) return '';
  const cards = exps.map((e) => `
    <div class="exp-card" data-eid="${esc(e.id)}">
      <div class="exp-k"><span class="exp-scale ${e.scale}">${e.scale}</span>${e.mixed ? '<span class="exp-mixed">⛶ descends</span>' : ''}<span>${EXP_LEN[e.length] || e.length} · ${(e.stops || []).length} stops</span></div>
      <h4>${esc(e.title)}</h4><p>${esc(e.premise)}</p>
      <div class="exp-btns"><button class="btn sm exp-cruise">▶ cruise</button><button class="btn sm exp-trace">◈ trace</button></div>
    </div>`).join('');
  return `<div class="hr"></div>
    <div class="exp-h">◈ EXPEDITION LOG <span class="muted">· ${exps.length} charted voyages</span></div>
    <div class="muted" style="margin:2px 0 8px"><b>Cruise</b> = a stepped, cinematic tour (⛶ routes descend inside galaxies). <b>Trace</b> = load into the NAV COMPUTER to fly it yourself.</div>
    ${cards}`;
}
function wireExpeditions(list, app) {
  list.querySelectorAll('.exp-card').forEach((el) => {
    const id = el.dataset.eid;
    const c = el.querySelector('.exp-cruise'); if (c) c.onclick = (e) => { e.stopPropagation(); app.startExpeditionCruise(id); };
    const b = el.querySelector('.exp-trace'); if (b) b.onclick = (e) => { e.stopPropagation(); app.loadExpedition(id); };
  });
}

// ---- expedition cruise player (stepped, mode-aware) ----
export function initExpeditionCruise(app) {
  const player = document.createElement('div');
  player.id = 'cruiseplayer'; player.hidden = true;
  document.body.appendChild(player);
  let autoTimer = null;
  const stopAuto = () => { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; } };

  app.on('cruise', (c) => {
    if (!c) { stopAuto(); player.hidden = true; player.innerHTML = ''; return; }
    player.hidden = false;
    const isFirst = c.index === 0, isLast = c.index === c.total - 1;
    const legTxt = c.index > 0 ? `${fmtLy(c.legLy)} · ${fmtYr(c.legTime.years)}` : 'departure';
    player.innerHTML = `
      <div class="vp-top">
        <div class="vp-title">▶ <b>${esc(c.title)}</b> — expedition cruise</div>
        <button class="vp-close" title="end cruise">✕</button>
      </div>
      <div class="vp-progress">${Array.from({ length: c.total }, (_, k) =>
        `<i class="${k < c.index ? 'done' : k === c.index ? 'cur' : ''}" data-k="${k}"></i>`).join('')}</div>
      <div class="vp-wpname">${c.index}. ${c.interior ? '⛶ ' : ''}${esc(c.label)}${c.loading ? ' <span class="muted">· descending…</span>' : ''}</div>
      <div class="vp-narr">${esc(c.note || '')}</div>
      <div class="vp-meta"><span>leg <span class="v">${legTxt}</span></span>${c.interior ? '<span>context <span class="v">galaxy interior</span></span>' : ''}</div>
      <div class="vp-ctrls">
        <button class="btn sm" id="cr-prev" ${isFirst ? 'disabled' : ''}>◀ prev</button>
        <span class="step">${c.index + 1} / ${c.total}</span>
        <button class="btn sm" id="cr-next" ${isLast ? 'disabled' : ''}>next ▶</button>
        <button class="btn sm" id="cr-auto">${autoTimer ? '❚❚ pause' : '▶ auto'}</button>
      </div>`;
    player.querySelector('.vp-close').onclick = () => app.stopCruise();
    player.querySelector('#cr-prev').onclick = () => { stopAuto(); app.cruiseStep(-1); };
    player.querySelector('#cr-next').onclick = () => { stopAuto(); app.cruiseStep(1); };
    player.querySelector('#cr-auto').onclick = () => toggleAuto(c.total);
    player.querySelectorAll('.vp-progress i').forEach((el) => { el.onclick = () => { stopAuto(); app.cruiseGoto(+el.dataset.k); }; });
  });
  app.on('mode', () => { /* cruise drives mode itself; manual switch already stops it */ });

  function toggleAuto(total) {
    if (autoTimer) { stopAuto(); const b = player.querySelector('#cr-auto'); if (b) b.textContent = '▶ auto'; return; }
    autoTimer = setInterval(() => {
      if (!app.cruise || app.cruise.index >= total - 1) { stopAuto(); return; }
      app.cruiseStep(1);
    }, 7000); // long enough for an interior to load
    const b = player.querySelector('#cr-auto'); if (b) b.textContent = '❚❚ pause';
  }
}
function fmtLy(ly) {
  if (ly >= 1e9) return `${(ly / 1e9).toFixed(2)} Gly`;
  if (ly >= 1e6) return `${(ly / 1e6).toFixed(2)} Mly`;
  if (ly >= 1e3) return `${(ly / 1e3).toFixed(1)} kly`;
  return `${(ly || 0).toFixed(1)} ly`;
}
function fmtYr(y) {
  if (!isFinite(y)) return '∞';
  if (y >= 1e9) return `${(y / 1e9).toFixed(2)} Gyr`;
  if (y >= 1e6) return `${(y / 1e6).toFixed(2)} Myr`;
  if (y >= 1e3) return `${(y / 1e3).toFixed(1)} kyr`;
  if (y >= 1) return `${y.toFixed(0)} yr`;
  return `${(y * 365.25).toFixed(0)} d`;
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
