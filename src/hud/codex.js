// The CODEX overlay: a browser for the "Immeasurable Spaces" knowledge base
// (search + type facets + a graph-linked detail view) plus the 2D conceptual map
// (the depth / adjacency / constitution tower diagram).
const TYPE_LABEL = {
  object: 'objects', event: 'events', concept: 'concepts', hazard: 'hazards', reconciliation: 'reconciliations',
  lexicon: 'lexicon', phrase: 'phrases', place: 'places', map_node: 'map nodes', ship: 'ships', ship_class: 'ship classes',
  faction: 'factions', language: 'languages', technology: 'technology', world: 'worlds', nav_axis: 'nav axes',
  era: 'eras',
};
const LONG = ['reading', 'reframe_long', 'classic_reading', 'got_right', 'mistook', 'behaviour', 'escape', 'houdini', 'usage'];
const LONG_LABEL = { reading: 'Reading', reframe_long: 'Reframe', classic_reading: 'Classic reading', got_right: 'Got right', mistook: 'Mistook', behaviour: 'Behaviour', escape: 'Escape protocol', houdini: 'VFX note', usage: 'Usage' };
const SKIP = new Set(['id', 'type', 'name', 'jp', 'summary', 'links', 'sources', 'coords', 'map_layers', 'map_id', 'badges', 'attributes', 'resolved', ...LONG]);

// Map a fictional object/event class to a real Cosmic-Atlas category via its
// real-world anchor text (the real ↔ fiction bridge).
function bridgeCategory(rec) {
  const t = `${rec.real_anchor || ''} ${rec.name || ''} ${rec.category || ''}`.toLowerCase();
  if (/black hole|seam-well/.test(t)) return 'smbh';
  if (/pulsar|magnetar|neutron|beacon core/.test(t)) return 'pulsar';
  if (/supernova|remnant|core fall/.test(t)) return 'supernova';
  if (/nebula|h ii|hii|planetary|field veil/.test(t)) return 'nebula';
  if (/galax|elliptical|spiral|lenticular|irregular|correlation island/.test(t)) return 'galaxy';
  if (/quasar|blazar|agn/.test(t)) return 'quasar';
  if (/giant|supergiant|hypergiant|swollen/.test(t)) return 'hyperstar';
  return null;
}

export function initCodex(qtr, app) {
  const btn = document.getElementById('codex-btn');
  if (!qtr.loaded) { if (btn) btn.hidden = true; return; }
  if (btn) { btn.hidden = false; btn.onclick = () => open(); }

  const overlay = document.createElement('div');
  overlay.id = 'codex'; overlay.hidden = true;
  document.body.appendChild(overlay);

  const layerColor = Object.fromEntries(qtr.layers.map((l) => [l.id, l.color]));
  let activeType = 'all', q = '', selId = null, view = 'browse';

  const filtered = () => {
    const ql = q.trim().toLowerCase();
    return qtr.records.filter((r) => (activeType === 'all' || r.type === activeType) &&
      (!ql || (r.name + ' ' + (r.summary || '') + ' ' + (r.reading || '')).toLowerCase().includes(ql)));
  };

  function render() {
    const recs = filtered();
    const typeCounts = {}; for (const r of qtr.records) typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;
    const chips = ['all', ...qtr.types()].map((t) =>
      `<button class="cx-typechip ${t === activeType ? 'on' : ''}" data-type="${t}">${t === 'all' ? 'all' : (TYPE_LABEL[t] || t)}${t === 'all' ? ` ${qtr.count()}` : ` ${typeCounts[t] || 0}`}</button>`).join('');
    const list = recs.slice(0, 400).map((r) =>
      `<div class="cx-item ${r.id === selId ? 'on' : ''}" data-goto="${esc(r.id)}"><span class="cx-it-nm">${esc(r.name)}</span><span class="cx-it-ty">${esc(TYPE_LABEL[r.type] || r.type)}</span></div>`).join('') || '<div class="cx-empty">no matches</div>';

    overlay.innerHTML = `
      <div class="cx-box">
        <div class="cx-head">
          <div class="cx-title">📖 CODEX · <b>${esc(qtr.meta.title || 'Immeasurable Spaces')}</b> <span class="muted">${qtr.count()} records</span></div>
          <div class="cx-tabs">
            <button class="cx-tab ${view === 'browse' ? 'on' : ''}" data-view="browse">BROWSE</button>
            <button class="cx-tab ${view === 'diagram' ? 'on' : ''}" data-view="diagram">DIAGRAM</button>
          </div>
          <button class="cx-x" title="close">✕</button>
        </div>
        ${view === 'browse' ? `
        <div class="cx-body">
          <div class="cx-left">
            <input class="cx-q" id="cx-q" type="text" placeholder="search the codex…" value="${attr(q)}" autocomplete="off" />
            <div class="cx-types">${chips}</div>
            <div class="cx-count muted">${recs.length} record${recs.length === 1 ? '' : 's'}</div>
            <div class="cx-list">${list}</div>
          </div>
          <div class="cx-right">${detail(selId ? qtr.get(selId) : recs[0])}</div>
        </div>` : `<div class="cx-diagram">${diagram()}</div>`}
      </div>`;
    wire();
  }

  function detail(rec) {
    if (!rec) return '<div class="cx-empty">Select a record.</div>';
    const jp = rec.jp ? ` <span class="cx-jp">${esc(rec.jp)}</span>` : '';
    const anchor = rec.real_anchor || rec.real_theory || rec.marine_analog;
    const anchorLbl = rec.real_anchor ? 'real anchor' : rec.real_theory ? 'real theory' : rec.marine_analog ? 'marine analog' : '';
    const longs = LONG.filter((k) => rec[k]).map((k) => `<div class="cx-long"><h4>${LONG_LABEL[k]}</h4><p>${esc(rec[k])}</p></div>`).join('');
    const facts = Object.entries(rec).filter(([k, v]) => !SKIP.has(k) && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') && v !== '')
      .map(([k, v]) => `<dt>${esc(k.replace(/_/g, ' '))}</dt><dd>${esc(String(v))}</dd>`).join('');
    const attrs = (rec.attributes || []).map((a) => `<dt>${esc(a.k)}</dt><dd>${esc(a.v)}</dd>`).join('');
    const links = qtr.linksOf(rec);
    const REL_LABEL = { same_as: 'same as', related: 'related', denotes: 'denotes', in_language: 'in language', located_on: 'located on' };
    const linkRows = Object.entries(links).map(([rel, arr]) =>
      `<div class="cx-linkrow"><span class="cx-rel">${esc(REL_LABEL[rel] || rel)}</span><div class="cx-chips">${arr.map((t) => `<button class="cx-chip" data-goto="${esc(t.id)}">${esc(t.name)}<i>${esc(TYPE_LABEL[t.type] || t.type)}</i></button>`).join('')}</div></div>`).join('');
    const onMap = rec.type === 'map_node' ? `<button class="cx-mapbtn" data-diagram="${esc(rec.id)}">◇ show on diagram</button>` : '';
    // Real ↔ fiction bridge: if this fictional class maps to a real Cosmic-Atlas
    // category that has objects, offer to jump there on the 3-D map.
    const bridge = app ? bridgeCategory(rec) : null;
    const bridgeN = bridge ? app.atlasCategoryCount(bridge) : 0;
    const bridgeLbl = bridge ? (app.atlasCategories[bridge]?.label || bridge) : '';
    const bridgeBtn = bridgeN > 0
      ? `<button class="cx-mapbtn cx-bridge" data-reveal="${esc(bridge)}">◎ show the real ${esc(bridgeLbl.toLowerCase())} on the map <i>${bridgeN}</i></button>`
      : '';
    return `
      <div class="cx-d-head"><div class="cx-d-name">${esc(rec.name)}${jp}</div><div class="cx-d-type">${esc(TYPE_LABEL[rec.type] || rec.type)}</div></div>
      ${anchor ? `<div class="cx-anchor"><span class="cx-anchor-k">${esc(anchorLbl)}</span> ${esc(anchor)}</div>` : ''}
      ${rec.summary ? `<p class="cx-summary">${esc(rec.summary)}</p>` : ''}
      ${longs}
      ${facts ? `<h4 class="cx-h">details</h4><dl class="cx-facts">${facts}</dl>` : ''}
      ${attrs ? `<h4 class="cx-h">attributes</h4><dl class="cx-facts">${attrs}</dl>` : ''}
      ${linkRows ? `<h4 class="cx-h">links</h4><div class="cx-links">${linkRows}</div>` : ''}
      ${bridgeBtn ? `<div class="cx-bridgewrap">${bridgeBtn}</div>` : ''}
      ${onMap}
      ${rec.sources ? `<div class="cx-sources muted">source: ${esc((rec.sources || []).join(', '))}</div>` : ''}`;
  }

  function diagram() {
    const nodes = qtr.mapNodes, edges = qtr.mapEdges;
    const edgeSVG = edges.map((e) => {
      const c = layerColor[e.type] || '#888';
      return `<line x1="${e.from_xy[0]}" y1="${e.from_xy[1]}" x2="${e.to_xy[0]}" y2="${e.to_xy[1]}" stroke="${c}" stroke-width="2.5" opacity="0.55" ${e.dashed ? 'stroke-dasharray="7 7"' : ''}/>`;
    }).join('');
    const nodeSVG = nodes.map((n) => {
      const c = layerColor[(n.map_layers || [])[0]] || '#9fb4c8';
      return `<g class="cx-gnode" data-goto="${esc(n.id)}" transform="translate(${n.coords.x},${n.coords.y})">
        <circle r="9" fill="${c}" stroke="#04070d" stroke-width="2"/><text x="15" y="5">${esc(n.name)}</text></g>`;
    }).join('');
    const legend = qtr.layers.map((l) => `<span class="cx-leg"><i style="background:${l.color}"></i>${esc(l.name)}</span>`).join('');
    return `<div class="cx-legend">${legend}</div>
      <div class="cx-svgwrap"><svg viewBox="0 0 900 1200" preserveAspectRatio="xMidYMid meet" class="cx-svg">${edgeSVG}${nodeSVG}</svg></div>
      <div class="muted cx-diagnote">The tower: substrate floor at the bottom → the limit Κ at the top. Click a node for its record.</div>`;
  }

  function wire() {
    overlay.querySelector('.cx-x').onclick = () => close();
    overlay.querySelectorAll('.cx-tab').forEach((t) => { t.onclick = () => { view = t.dataset.view; render(); }; });
    overlay.querySelectorAll('[data-type]').forEach((c) => { c.onclick = () => { activeType = c.dataset.type; render(); }; });
    overlay.querySelectorAll('[data-goto]').forEach((el) => { el.onclick = () => { selId = el.dataset.goto; view = 'browse'; render(); scrollDetail(); }; });
    overlay.querySelectorAll('[data-diagram]').forEach((el) => { el.onclick = () => { view = 'diagram'; render(); }; });
    overlay.querySelectorAll('[data-reveal]').forEach((el) => { el.onclick = () => { close(); app.revealAtlasCategory(el.dataset.reveal); }; });
    const qi = overlay.querySelector('#cx-q');
    if (qi) qi.oninput = (e) => { q = e.target.value; const recs = filtered(); overlay.querySelector('.cx-list').innerHTML = recs.slice(0, 400).map((r) => `<div class="cx-item ${r.id === selId ? 'on' : ''}" data-goto="${esc(r.id)}"><span class="cx-it-nm">${esc(r.name)}</span><span class="cx-it-ty">${esc(TYPE_LABEL[r.type] || r.type)}</span></div>`).join('') || '<div class="cx-empty">no matches</div>'; overlay.querySelector('.cx-count').textContent = `${recs.length} records`; overlay.querySelectorAll('.cx-list [data-goto]').forEach((el) => { el.onclick = () => { selId = el.dataset.goto; view = 'browse'; render(); scrollDetail(); }; }); };
  }
  function scrollDetail() { const r = overlay.querySelector('.cx-right'); if (r) r.scrollTop = 0; }
  function open(id) { if (id && qtr.get(id)) { selId = id; view = 'browse'; q = ''; activeType = 'all'; } overlay.hidden = false; render(); if (id) scrollDetail(); }
  function close() { overlay.hidden = true; }

  // let other panels deep-link into a specific codex entry (e.g. a Deep-Time object)
  if (app) app._openCodex = (id) => open(id);

  // keyboard: Esc closes
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) close(); });
}

// Repair the occasional broken \uXXXX escape in the source export (e.g. "shipu2019s").
function clean(s) {
  return String(s ?? '')
    .replace(/u2019/g, '’').replace(/u2018/g, '‘')
    .replace(/u201c/g, '“').replace(/u201d/g, '”')
    .replace(/u2014/g, '—').replace(/u2013/g, '–').replace(/u2026/g, '…');
}
function attr(s) { return clean(s).replace(/"/g, '&quot;'); }
function esc(s) { return clean(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
