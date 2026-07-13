import { PC_TO_LY } from '../util/astro.js';

// TRUE-SCALE ribbon (COSMOS only, toggleable). The main view is LOG-radial — it
// has to be, to fit 1 pc and 93 Gly in one frame — so a hop between nearby
// galaxies looks like it crosses the whole universe. This strip is the honest
// LINEAR counterpart: Sol (0) → the edge of the observable universe (~45 Gly
// radius). A route's reach shows as a filled sliver; while the autopilot flies,
// a live marker rides the bar (accelerating outward, because uniform speed on
// the log map eats exponentially more real distance the farther out you are).

const fmtLy = (ly) => {
  if (ly >= 1e9) return `${(ly / 1e9).toFixed(ly < 1e10 ? 2 : 1)} Gly`;
  if (ly >= 1e6) return `${(ly / 1e6).toFixed(ly < 1e7 ? 1 : 0)} Mly`;
  if (ly >= 1e3) return `${(ly / 1e3).toFixed(0)} kly`;
  return `${Math.round(ly)} ly`;
};

export function initScaleBar(app) {
  const el = document.createElement('div');
  el.id = 'scalebar'; el.hidden = true;
  el.innerHTML = `
    <div class="tsb-cap" id="tsb-cap"></div>
    <div class="tsb-track">
      <div class="tsb-fill" id="tsb-fill"></div>
      <div class="tsb-view" id="tsb-view"></div>
      <div class="tsb-ship" id="tsb-ship" hidden></div>
      <div class="tsb-ticks" id="tsb-ticks"></div>
    </div>`;
  document.body.appendChild(el);
  const cap = el.querySelector('#tsb-cap');
  const fill = el.querySelector('#tsb-fill');
  const view = el.querySelector('#tsb-view');
  const ship = el.querySelector('#tsb-ship');
  const ticks = el.querySelector('#tsb-ticks');

  let route = null;          // last route summary
  let shipLy = null;         // live ship distance while flying (else null)
  let universeLy = 4.5e10;
  const pctOf = (ly) => Math.min(100, Math.max(0, ly / universeLy * 100));

  const buildTicks = () => {
    const gly = universeLy / 1e9;
    const marks = [1, 5, 10, 20, 30, 40].filter((g) => g < gly);
    ticks.innerHTML = marks.map((g) => `<span style="left:${(g / gly * 100).toFixed(2)}%">${g}</span>`).join('')
      + `<span class="tsb-edge" style="left:100%">${gly.toFixed(0)} Gly · CMB</span>`;
  };

  const render = () => {
    const show = app.mode === 'cosmos' && app.showScaleBar !== false;
    el.hidden = !show;
    if (!show) return;
    const flying = shipLy != null;
    el.classList.toggle('flying', flying);
    fill.style.width = (route && route.reachLy ? pctOf(route.reachLy) : 0) + '%';
    ship.hidden = !flying;
    if (flying) {
      ship.style.left = pctOf(shipLy) + '%';
      const p = pctOf(shipLy);
      cap.innerHTML = `<b>◈ ship</b> at <b>${fmtLy(shipLy)}</b> — <b>${p < 1 ? p.toFixed(2) : p.toFixed(1)}%</b> of the way out${route && route.reachLy ? ` · course reaches ${fmtLy(route.reachLy)}` : ''}. Watch it race across the compressed outer decades.`;
    } else if (route && route.reachLy) {
      const p = pctOf(route.reachLy);
      cap.innerHTML = `<b>◈ your route</b> reaches <b>${fmtLy(route.reachLy)}</b> — <b>${p < 1 ? p.toFixed(2) : p.toFixed(1)}%</b> of the way to the edge of the observable universe. On the log-radial map it looks far larger.`;
    } else {
      const oneG = (1e9 / universeLy * 100).toFixed(1);
      cap.innerHTML = `<b>TRUE SCALE</b> · linear radius of the observable universe (~${(universeLy / 1e9).toFixed(0)} Gly). The map is log-compressed — everything within ~1 Gly sits in the first <b>${oneG}%</b>.`;
    }
  };

  app.on('frame', (f) => {
    if (f.mode !== 'cosmos') { el.hidden = true; return; }
    const u = Math.pow(10, f.cmbR / (f.decadeUnit || 3)) * PC_TO_LY;
    if (Math.abs(u - universeLy) > 1) { universeLy = u; buildTicks(); }
    const viewLy = Math.pow(10, Math.min(f.camRadius, f.cmbR) / (f.decadeUnit || 3)) * PC_TO_LY;
    view.style.left = pctOf(viewLy) + '%';
    shipLy = f.shipLy != null ? f.shipLy : null;
    render();
  });
  app.on('route', (s) => { route = s && s.points && s.points.length ? s : null; render(); });
  app.on('nav', (n) => { if (!n || n.arrived) { shipLy = null; render(); } });
  app.on('scalebar', () => render());
  app.on('mode', () => render());
  buildTicks();
}
