// The MANUAL overlay: a self-contained guide to the map — modes, controls,
// hotkeys and features — opened from the top bar or with the ? / F1 hotkey.

const REPO = 'https://github.com/fopearcano/universe-map';

// Keep this table in sync with src/hud/hotkeys.js.
const KEYS = [
  ['1 / 2', 'LOCAL / COSMOS mode'],
  ['H', 'Home — recenter on Sol'],
  ['/', 'Focus the search box'],
  ['C', 'Open the CODEX'],
  ['? or F1', 'Open this manual'],
  ['F', 'Focus — orbit around the selected object'],
  ['R', 'Add the selection to the route'],
  ['G', 'Enter / exit the selected galaxy'],
  ['P', 'Toggle plot-course (click to drop waypoints)'],
  ['Space', 'Engage / pause autopilot (or resume from a descent)'],
  ['[ / ]', 'Previous / next stop — cruise · voyage · autopilot'],
  ['S', 'Toggle the sector grid'],
  ['B', 'Toggle galaxy imagery (billboards)'],
  ['V', 'Toggle resolve-structures (galaxy/cluster shapes)'],
  ['T', 'Toggle the tracking panel (live flight telemetry)'],
  ['Esc', 'Close overlay · exit galaxy · disengage · clear selection'],
];

const SECTIONS = [
  ['Two scales', [
    ['LOCAL', 'The true-scale stellar neighbourhood — 100,000 real stars in parsecs, the Sun at the origin.'],
    ['COSMOS', 'The whole observable universe on a logarithmic radial scale — ~980k real + imagined objects out to the CMB. Direction is exact; only radius is compressed, so real distances (used for routing) are always preserved.'],
  ]],
  ['Getting around', [
    ['Orbit / pan / zoom', 'drag · right-drag · scroll.'],
    ['Select', 'click an object; double-click to fly to it. Hover for a quick label.'],
    ['Search', 'top box — by name, HIP/HD id, or constellation.'],
    ['Focus', 'select → ◎ focus (or F) re-centres the orbit pivot on that object.'],
  ]],
  ['Navigate & route', [
    ['Plot a course', 'toggle ◉ plot (P) and click to drop waypoints, or select an object and ＋ route (R).'],
    ['NAV COMPUTER', 'shows each leg\'s distance, heading and travel time; pick a cruise speed for the mission & relativistic ship time.'],
    ['ENGAGE', 'flies the route on autopilot — you can still drag / scroll to orbit and zoom around the ship as it flies. A blinking reticle marks the tracked point; ▤ track (or T) opens a live panel with its position, heading, speed and route progress. On a descent route it pauses at each galaxy and drops you inside — ▶ continue to fly on.'],
    ['Save / load', 'name routes (persisted), reload, and import/export as JSON.'],
  ]],
  ['Expeditions', [
    ['Expedition Log', 'the VOYAGES tab holds 25 preset story-routes. ▶ cruise runs a narrated, stepped tour; ◈ trace loads it into the NAV COMPUTER to fly yourself.'],
    ['Descents', 'routes marked ⛶ descends drop you inside a galaxy mid-voyage — by cruise or by ENGAGE.'],
  ]],
  ['Galaxy interiors', [
    ['Enter', 'any galaxy panel has ⛶ enter galaxy (or press G). A real sky cutout (SDSS where covered, DSS2 elsewhere) is sampled into a 3-D star field you fly inside.'],
    ['Explore', 'click stars to select, trace routes between them (true intra-galaxy distances), and raise the star count for a strong GPU. ⤴ exit to leave.'],
  ]],
  ['Layers & overlays', [
    ['Sector grid (S)', 'a 3-D block cage — the bright cosmic-plane (celestial equator) with radial spokes, 9 ring-planes above and 9 below, and vertical pillars through every node. Blocks map to the live SECTOR code in the telemetry bar.'],
    ['Galaxy imagery (B)', 'flat billboards of real galaxy cutouts at their positions.'],
    ['Resolve structures (V)', 'clusters & notable galaxies bloom into their shapes as you approach.'],
    ['Procedural fill', 'completes the sky into a navigable "known universe" (imagined), draped onto a gravity-shaped cosmic web (filaments, walls & voids) that reflects the real data — green, or matched to real data.'],
    ['Galactic bridge', 'cyan · fills the gap between the ~1 kpc local star bubble and the Local Group with a modelled Milky Way — disk & spiral arms, bar/bulge, halo, the Magellanic Clouds and a reach toward Andromeda. Selectable & route-able.'],
    ['CMB radiation image', 'the WMAP boundary shell — off by default; enable it in Layers (COSMOS).'],
  ]],
  ['Knowledge bases', [
    ['ATLAS tab', 'a curated set of real objects across every class; resolve any name live from SIMBAD, or ◈ grow whole catalogues.'],
    ['Story Studio', '✦ Imagine your own objects; they persist and are fully route-able.'],
    ['CODEX (C)', 'the imported "Immeasurable Spaces" fiction knowledge base — with a real ↔ fiction bridge to the map.'],
  ]],
];

export function initManual(app) {
  const btn = document.getElementById('manual-btn');
  const overlay = document.createElement('div');
  overlay.id = 'manual'; overlay.hidden = true;
  document.body.appendChild(overlay);

  overlay.innerHTML = `
    <div class="man-box">
      <div class="man-head">
        <div class="man-title">❔ MANUAL <span class="muted">· Universe Map</span></div>
        <button class="man-x" title="close (Esc)">✕</button>
      </div>
      <div class="man-body">
        <div class="man-cols">
          <div class="man-guide">
            ${SECTIONS.map(([h, rows]) => `
              <h4 class="man-h">${esc(h)}</h4>
              <dl class="man-dl">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`).join('')}
          </div>
          <div class="man-keys">
            <h4 class="man-h">Hotkeys</h4>
            <table class="man-kt">${KEYS.map(([k, v]) => `<tr><td class="man-k">${kbd(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
            <div class="man-note muted">Hotkeys are inert while a text field is focused or an overlay is open.</div>
            <a class="man-link" href="${REPO}#readme" target="_blank" rel="noopener">▸ Full README on GitHub</a>
          </div>
        </div>
      </div>
    </div>`;

  const open = () => { overlay.hidden = false; };
  const close = () => { overlay.hidden = true; };
  app._openManual = open;
  if (btn) btn.onclick = open;
  overlay.querySelector('.man-x').onclick = close;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) { e.stopPropagation(); close(); } });
}

function kbd(s) { return s.split(' ').map((p) => (/^[/?]$|^[A-Za-z0-9]+$|^F1$|^Space$|^Esc$/.test(p) ? `<kbd>${esc(p)}</kbd>` : esc(p))).join(' '); }
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
