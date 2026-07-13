// The MANUAL overlay: a self-contained guide to the map — modes, controls,
// hotkeys and features — opened from the top bar or with the ? / F1 hotkey.

const REPO = 'https://github.com/fopearcano/universe-map';

// Keep this table in sync with src/hud/hotkeys.js.
const KEYS = [
  ['1 / 2 / 3', 'LOCAL / COSMOS / SYSTEM mode'],
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
  ['- / =', 'Slower / faster flythrough — the time-acceleration vs real (1:1) time'],
  ['S', 'Toggle the sector grid'],
  ['B', 'Toggle galaxy imagery (billboards)'],
  ['V', 'Toggle resolve-galaxies (Hubble-type shapes)'],
  ['T', 'Toggle the tracking panel (live flight telemetry)'],
  ['Esc', 'Close overlay · exit galaxy · disengage · clear selection'],
];

const SECTIONS = [
  ['Three scales', [
    ['SYSTEM', 'The Solar System, to scale (☉ SYSTEM or key 3) — the Sun, eight planets, dwarf planets and major moons on their real orbits (AU). Bodies are size-exaggerated so they stay visible; planets revolve and moons circle them. Click a world for its facts; the FILTERS tab is a planet picker with ❚❚ pause and a time-speed slider. Solaris.Ai can drive it too ("take me to Saturn", "show Jupiter\'s moons", "pause the planets").'],
    ['LOCAL', 'The true-scale stellar neighbourhood — 100,000 real stars in parsecs, the Sun at the origin.'],
    ['COSMOS', 'The whole observable universe on a logarithmic radial scale — ~980k real + imagined objects out to the CMB. Direction is exact; only radius is compressed, so real distances (used for routing) are always preserved. Because the scale is logarithmic, a hop between nearby galaxies looks like it spans the cosmos — the TRUE-SCALE ribbon at the bottom shows a route\'s real reach against the ~45 Gly-radius universe (usually a sliver of a percent).'],
  ]],
  ['Getting around', [
    ['Orbit / pan / zoom', 'drag · right-drag · scroll.'],
    ['Select', 'click an object; double-click to fly to it. Hover for a quick label.'],
    ['Search', 'top box — by name, HIP/HD id, or constellation.'],
    ['Focus', 'select → ◎ focus (or F) re-centres the orbit pivot on that object.'],
    ['Move / hide panels', 'every floating panel (Controls, Info, NavCom, Track, and the Solaris.Ai chat) drags by its header and stays where you leave it (remembered across reloads). The top-centre dock toolbar has a lit button per panel — NavCom · Controls · Info · Track — to hide it or bring it back, with ↺ to reset the layout. NavCom opens the NAV COMPUTER ready to plot even with no course loaded; the Solaris.Ai chat opens from ✦ NAVCOM AI in the top bar.'],
  ]],
  ['Navigate & route', [
    ['Plot a course', 'toggle ◉ plot (P) and click to drop waypoints, or select an object and ＋ route (R). Legs draw as gentle curved arcs (bowed away from Sol) so a route reads as a flight path, not a straight chord skewering whatever lines up between its ends.'],
    ['TEKNÉ · NAVCOM', 'the ship\'s navigation computer, from the QTR "Immeasurable Spaces" canon. Pick a DRIVE — a depth rung on the Ship-Relative Speed Law, where speed is a function of vacuum depth, not thrust: Class 0 sub-light (real time dilation) up to the Class ω Idrenes Composite ·Tekné at ~10²⁰c. It reads out the path along the seam 𝔍, coordinate (home-frame) time, crew (proper) time, and the number of Idrenes-bridge crossings.'],
    ['ENGAGE', 'flies the route on autopilot — you can still drag / scroll to orbit and zoom around the ship as it flies. The flythrough is an unhurried preview of a much longer voyage: the nav HUD names the STORY time — the whole journey as lived in the fiction, counting not just transit but the threading of the seam, the bridge crossings, the approach and port cycles. So a civilized bridge voyage really takes months, an Unruh run days, a Tekné dash hours, and a sub-light circuit its true centuries. (Prefer raw drive-transit time instead? Turn off <b>Realistic voyage time</b> in the NAV COMPUTER — a bridge hop then reads its bare minutes and the preview runs shorter.) STORY is that lived length at 1:1 — real time, where you would wait the whole voyage. So the preview runs at a large time-acceleration (a 5-month bridge run in ~a minute is ≈ ×225,000; a sub-light crawl ≈ ×100M), shown honestly beside the range, with the actual watch time. Drag the SPEED slider — real time at the left, fast at the right — or step it with the ÷8 ÷4 ÷2 · ×2 ×4 ×8 buttons (or the - / = keys), from ~a day of watching down to a few seconds. Because the map is log-compressed, the ship also flies visibly faster through the zoomed-in inner region and slows (~6×) through the vast outer decades — a constant-real-speed feel that conveys the true scale. A deep Klein-blue reticle — a pulsing ring flanked by two fixed carmine triangles above and below — marks the tracked ship, with a small ◈ tag riding beside it — the ship itself (the drive’s vessel, class and speed) plus its next stop and range, re-labelling if you change the drive mid-flight — that you can toggle from the flight bar. ▤ track (or T) opens a fuller live panel with its position, heading, speed and route progress. On a descent route it pauses at each galaxy and drops you inside — ▶ continue to fly on.'],
    ['Save / load', 'name routes (persisted), reload, and import/export as JSON.'],
    ['✦ NAVCOM AI', 'chat with Solaris.Ai — a colloquial navigator that answers universe & QTR-canon questions, plots/flies courses ("plot Sol → Andromeda → Virgo", "take me to the Great Attractor at Class II"), and drives the Solar System ("take me to Saturn", "pause the planets"). Bring your own model via ⚙ — any OpenAI-compatible endpoint (LM Studio / vLLM / Ollama / OpenAI / Anthropic); everything stays in your browser.'],
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
    ['Resolve galaxies (V)', 'notable galaxies bloom into their Hubble-type shapes as you approach.'],
    ['Star cluster shapes', 'globular & open clusters bloom into their own forms on approach — a separate toggle.'],
    ['Supervoid zones', 'translucent bubbles marking the great cosmic voids (Boötes, Local, Eridanus…); the imagined fill stays empty inside them.'],
    ['Trade & war routes', '⟿ the Ledger of Ways — a charted network of ~2,950 imagined crossings (commercial amber vastly outnumbering military crimson, ~10:1, as a peacetime galaxy runs on trade) with unique poetic names, all anchored to real objects. ~150 are hand-authored flagships; the rest fill the sky procedurally. Browse/search them in Layers, and use the ▾ groups dropdown to switch thematic groups on/off — commercial: Trade & bulk, Courier, Ore & salvage, Pilgrim & relic, Supply & ferry; military: Patrol & picket, War & siege, Blockade & screen, Fortress & relief (whole categories toggle too). Click a row to trace one, ▶ to load it into the NAV COMPUTER, or ask Solaris.Ai to fly it.'],
    ['Procedural fill', 'completes the sky into a navigable "known universe" (imagined), draped onto a gravity-shaped cosmic web (filaments, walls & voids) that reflects the real data — green, or matched to real data.'],
    ['Galactic bridge', 'cyan · fills the gap between the ~1 kpc local star bubble and the Local Group with a modelled Milky Way — disk & spiral arms, bar/bulge, halo, the Magellanic Clouds and a reach toward Andromeda. Selectable & route-able.'],
    ['CMB radiation image', 'the WMAP boundary shell — off by default; enable it in Layers (COSMOS).'],
    ['Cinematic', 'render options in Layers (LOCAL & COSMOS): Glow (bloom on bright stars, galaxy cores & the Sun), Star twinkle (a gentle shimmer on the brightest stars), and Filmic tone (ACES tone-mapping — rolls off highlights and deepens the shadows for a darker, moodier frame). All persist.'],
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

function kbd(s) { return s.split(' ').map((p) => (/^[/?=+\-]$|^[A-Za-z0-9]+$|^F1$|^Space$|^Esc$/.test(p) ? `<kbd>${esc(p)}</kbd>` : esc(p))).join(' '); }
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
