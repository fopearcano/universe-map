import { cartesianToRaDec, fmtRA, fmtDec, fmtNum, PC_TO_LY } from '../util/astro.js';

// Top telemetry bar, tab switching, layers panel, FPS meter and hover tooltip.
export function initHUD(app) {
  initTabs();
  initLayers(app);
  initTelemetry(app);
  initFps();
  initHoverTip(app);
}

function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach((t) => t.addEventListener('click', () => {
    tabs.forEach((x) => x.classList.remove('active'));
    document.querySelectorAll('.tabpanel').forEach((p) => p.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('tab-' + t.dataset.tab).classList.add('active');
  }));
}

function initLayers(app) {
  const root = document.getElementById('tab-layers');
  root.innerHTML = `
    <div class="muted" style="margin-bottom:10px">Reference infographics and overlays.</div>
    <div class="toggle on" data-l="grid"><span>Reference grid</span><span class="sw"></span></div>
    <div class="toggle on" data-l="rings"><span>Distance rings (ly)</span><span class="sw"></span></div>
    <div class="toggle on" data-l="axes"><span>Celestial axes</span><span class="sw"></span></div>
    <div class="toggle on" data-l="labels"><span>Star name labels</span><span class="sw"></span></div>
    <div class="hr"></div>
    <button class="btn" id="l-home">⌂ recenter on Sol</button>
    <div class="muted" style="margin-top:12px;line-height:1.6">
      100,000 stars · HYG v4.1<br>positions in parsecs, equatorial J2000<br>Sol fixed at origin.
    </div>`;
  const handlers = {
    grid: (on) => app.scene.setReferenceVisible(on),
    rings: (on) => app.scene.setRingsVisible(on),
    axes: (on) => app.scene.setAxesVisible(on),
    labels: (on) => app.labels.setStarsVisible(on),
  };
  root.querySelectorAll('.toggle').forEach((el) => {
    el.onclick = () => { el.classList.toggle('on'); handlers[el.dataset.l](el.classList.contains('on')); };
  });
  root.querySelector('#l-home').onclick = () => app.home();
}

function initTelemetry(app) {
  const el = document.getElementById('telemetry');
  app.on('filter', () => {}); // count arrives via frame too
  app.on('frame', ({ dist, dir, fov, visible }) => {
    const { ra, dec } = cartesianToRaDec(dir.x, dir.y, dir.z);
    el.innerHTML = [
      cell('STARS', `${fmtNum(visible)}/100k`),
      cell('RANGE', fmtRange(dist)),
      cell('HDG', `${fmtRA(ra)} ${fmtDec(dec)}`),
      cell('FOV', `${fov.toFixed(0)}°`),
    ].join('');
  });
}

function fmtRange(pc) {
  const ly = pc * PC_TO_LY;
  if (ly < 1000) return `${ly.toFixed(ly < 10 ? 2 : 0)} ly`;
  return `${(ly / 1000).toFixed(2)}k ly`;
}
function cell(k, v) { return `<span><span class="k">${k}</span> <span class="v">${v}</span></span>`; }

function initFps() {
  const el = document.getElementById('fps');
  let last = performance.now(), frames = 0, acc = 0;
  const loop = (now) => {
    frames++; acc += now - last; last = now;
    if (acc >= 500) { el.textContent = `${Math.round((frames * 1000) / acc)} fps`; frames = 0; acc = 0; }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function initHoverTip(app) {
  const tip = document.createElement('div');
  tip.id = 'hovertip';
  Object.assign(tip.style, {
    position: 'fixed', zIndex: '7', pointerEvents: 'none', padding: '2px 7px',
    background: 'rgba(6,14,22,0.9)', border: '1px solid var(--line-strong)', borderRadius: '4px',
    color: 'var(--ink)', fontSize: '11px', transform: 'translate(12px, 12px)', display: 'none',
    whiteSpace: 'nowrap',
  });
  document.body.appendChild(tip);
  app.on('hover', (h) => {
    if (!h) { tip.style.display = 'none'; return; }
    tip.style.display = 'block';
    tip.style.left = h.x + 'px'; tip.style.top = h.y + 'px';
    tip.innerHTML = `${esc(h.star.name)} <span style="color:var(--dim)">· ${esc(h.star.spect)} · ${h.star.distLy.toFixed(1)} ly</span>`;
  });
}

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
