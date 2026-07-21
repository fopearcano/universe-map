// Movable / hideable panels + a top-centre dock toolbar.
//
// Every floating panel becomes draggable by its header and can be hidden and
// brought back from a small toolbar that lives in the empty middle of the top
// bar. Drag is bound to each panel's *stable container* (not to markup that the
// panel re-renders), so it survives innerHTML rebuilds. Positions persist to
// localStorage; visibility resets to each panel's natural default on reload so
// a hidden contextual panel can never go quietly missing between sessions.

const POS_KEY = 'ui.panelpos.v1';
const GRIP = 30;          // px from a panel's top edge that acts as a drag strip
const TOP_SAFE = 44;      // keep panels clear of the fixed top bar
const EDGE = 40;          // keep at least this many px on-screen when dragged

const loadPos = () => { try { return JSON.parse(localStorage.getItem(POS_KEY)) || {}; } catch { return {}; } };
const savePos = (p) => { try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch { /* ignore */ } };

// Interactive elements never start a drag (so buttons, inputs, tabs, list rows
// and toggles keep working when they happen to sit in the header strip).
const INTERACTIVE = 'button, input, select, textarea, a, label, option, [contenteditable], .sw, .toggle, .tab, .na-chip, .ways-row, .rp-wp, .sr-item';

export function initPanels(app) {
  const pos = loadPos();

  // Give the left dock a real header to grab and a hide affordance of its own.
  const left = document.getElementById('leftdock');
  if (left && !left.querySelector('.pnl-grip')) {
    const grip = document.createElement('div');
    grip.className = 'pnl-grip';
    grip.innerHTML = `<span class="pnl-gt">✦ CONTROLS</span><button class="pnl-gx" title="hide (bring back from the top toolbar)">✕</button>`;
    left.insertBefore(grip, left.firstChild);
  }

  const navBtn = document.getElementById('navcom-ai-btn');
  const isShown = (el) => !!el && !el.hidden && !el.classList.contains('pnl-off');

  // Panel registry. `show`/`hide` route to each panel's natural mechanism: the
  // NAV COMPUTER, the AI chat and the tracking panel own their own visibility;
  // the rest use a `.pnl-off` override that always wins over app-driven display.
  // `bar:false` means "draggable but no toolbar button" — the Solaris.Ai chat is
  // already opened from the ✦ NAVCOM AI button in the top bar, so it isn't
  // duplicated here.
  const REG = [
    { key: 'route', sel: '#routepanel', icon: '❋', label: 'NavCom', handle: '.rp-top',
      show: () => app._navcomShow?.(), hide: () => app._navcomHide?.() },
    { key: 'leftdock', sel: '#leftdock', icon: '⚙', label: 'Controls', handle: '.pnl-grip',
      show: (el) => el.classList.remove('pnl-off'), hide: (el) => el.classList.add('pnl-off') },
    { key: 'info', sel: '#infodock', icon: 'ⓘ', label: 'Info',
      show: (el) => el.classList.remove('pnl-off'), hide: (el) => el.classList.add('pnl-off') },
    { key: 'track', sel: '#trackpanel', icon: '◎', label: 'Track', handle: '.tp-h',
      show: () => app.setTrackPanel(true), hide: () => app.setTrackPanel(false) },
    { key: 'gfx', sel: '#gfxpanel', icon: '◧', label: 'Graphics', handle: '.gfx-h',
      show: (el) => el.classList.remove('pnl-off'), hide: (el) => el.classList.add('pnl-off') },
    { key: 'navcom', sel: '#navcom-ai', icon: '✦', label: 'Solaris.Ai', handle: '.na-head', bar: false,
      show: (el) => { if (el.hidden && navBtn) navBtn.click(); }, hide: (el) => { if (!el.hidden && navBtn) navBtn.click(); } },
  ];

  // ---- top-centre dock toolbar ----
  // Sits in the top bar's flex flow, between the brand and the telemetry, so it
  // stays centred without ever overlapping either cluster.
  const bar = document.createElement('div');
  bar.id = 'dockbar';
  const topbar = document.getElementById('topbar');
  const telemetry = document.getElementById('telemetry');
  if (topbar && telemetry) topbar.insertBefore(bar, telemetry);
  else document.body.appendChild(bar);

  const buttons = new Map();
  for (const r of REG) {
    if (r.bar === false) continue;   // draggable, but not shown in the toolbar
    const b = document.createElement('button');
    b.className = 'db-btn';
    b.dataset.key = r.key;
    b.title = `${r.label} — show / hide`;
    b.innerHTML = `<span class="db-i">${r.icon}</span><span class="db-l">${r.label}</span>`;
    b.onclick = () => {
      const el = document.querySelector(r.sel); if (!el) return;
      isShown(el) ? r.hide(el) : r.show(el);
      // reflect immediately (observers also fire, but this keeps it snappy)
      requestAnimationFrame(sync);
    };
    bar.appendChild(b);
    buttons.set(r.key, b);
  }
  const reset = document.createElement('button');
  reset.className = 'db-btn db-reset';
  reset.title = 'reset panel layout';
  reset.innerHTML = '<span class="db-i">↺</span>';
  reset.onclick = () => {
    for (const r of REG) {
      const el = document.querySelector(r.sel); if (!el) continue;
      el.style.left = el.style.top = el.style.right = el.style.bottom = el.style.transform = '';
      el.classList.remove('pnl-off');
    }
    for (const k of Object.keys(pos)) delete pos[k];
    savePos(pos);
    sync();
  };
  bar.appendChild(reset);

  const sync = () => {
    for (const r of REG) {
      const el = document.querySelector(r.sel);
      buttons.get(r.key)?.classList.toggle('on', isShown(el));
    }
  };

  // Left dock's own ✕ hides it (and updates the toolbar).
  left?.querySelector('.pnl-gx')?.addEventListener('click', () => { left.classList.add('pnl-off'); sync(); });

  // ---- wire each panel: restore saved position, make draggable, observe state ----
  for (const r of REG) {
    const el = document.querySelector(r.sel);
    if (!el) continue;
    applyPos(el, pos[r.key]);
    makeDraggable(el, r.handle, (p) => { pos[r.key] = p; savePos(pos); });
    // keep the toolbar in step with app-driven show/hide (selection, T, chat…)
    new MutationObserver(sync).observe(el, { attributes: true, attributeFilter: ['hidden', 'class', 'style'] });
  }

  // Re-clamp anything left off-screen after a viewport resize.
  window.addEventListener('resize', () => {
    for (const r of REG) {
      const el = document.querySelector(r.sel);
      if (el && el.style.left) clampInto(el);
    }
  });

  sync();
  app._syncDock = sync;
}

function applyPos(el, p) {
  if (!p) return;
  el.style.left = p.left + 'px'; el.style.top = p.top + 'px';
  el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.transform = 'none';
  clampInto(el);
}

function clampInto(el) {
  const w = el.offsetWidth, h = el.offsetHeight;
  let x = parseFloat(el.style.left) || 0, y = parseFloat(el.style.top) || 0;
  x = Math.max(EDGE - w, Math.min(x, window.innerWidth - EDGE));
  y = Math.max(TOP_SAFE, Math.min(y, window.innerHeight - EDGE));
  el.style.left = x + 'px'; el.style.top = y + 'px';
}

// Drag by the header: a listener on the stable container starts a move when the
// pointer lands on the named handle or within the top strip, and never when it
// lands on an interactive control.
function makeDraggable(el, handle, onDrop) {
  let on = false, sx = 0, sy = 0, ox = 0, oy = 0;

  const down = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest(INTERACTIVE)) return;
    const rect = el.getBoundingClientRect();
    const onHandle = handle && e.target.closest(handle);
    const inStrip = (e.clientY - rect.top) <= GRIP;
    if (!onHandle && !inStrip) return;
    on = true;
    // switch to top-left anchoring so the drag maths is uniform
    el.style.left = rect.left + 'px'; el.style.top = rect.top + 'px';
    el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.transform = 'none';
    sx = e.clientX; sy = e.clientY; ox = rect.left; oy = rect.top;
    el.classList.add('pnl-drag');
    e.preventDefault();
  };
  const move = (e) => {
    if (!on) return;
    const w = el.offsetWidth;
    let x = ox + (e.clientX - sx), y = oy + (e.clientY - sy);
    x = Math.max(EDGE - w, Math.min(x, window.innerWidth - EDGE));
    y = Math.max(TOP_SAFE, Math.min(y, window.innerHeight - EDGE));
    el.style.left = x + 'px'; el.style.top = y + 'px';
  };
  const up = () => {
    if (!on) return;
    on = false; el.classList.remove('pnl-drag');
    onDrop({ left: parseFloat(el.style.left), top: parseFloat(el.style.top) });
  };
  el.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}
