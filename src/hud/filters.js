import { SPECTRAL_CLASSES } from '../util/color.js';
import { fmtNum } from '../util/astro.js';

// Builds the local FILTERS panel. Everything funnels through app.setFilter().
export function buildLocalFilters(app) {
  const root = document.getElementById('tab-filters');
  const cons = app.catalog.meta.constellations; // [ [abbr, full], ... ] index-aligned

  root.innerHTML = `
    <div class="ctl">
      <label>Apparent magnitude ≤ <span class="val" id="f-mag-v">21.0</span></label>
      <input type="range" id="f-mag" min="-2" max="21" step="0.5" value="21" />
      <div class="muted">lower = only brighter stars</div>
    </div>
    <div class="ctl">
      <label>Distance ≤ <span class="val" id="f-dist-v">1000 ly</span></label>
      <input type="range" id="f-dist" min="5" max="3300" step="5" value="1000" />
    </div>
    <div class="ctl">
      <label>Spectral class</label>
      <div class="chips" id="f-class"></div>
    </div>
    <div class="ctl">
      <label>Constellation</label>
      <select id="f-con"><option value="-1">— all sky —</option></select>
    </div>
    <div class="ctl">
      <div class="toggle" id="f-named"><span>Named / catalogued only</span><span class="sw"></span></div>
    </div>
    <div class="hr"></div>
    <div class="ctl">
      <label>Star size <span class="val" id="f-size-v">1.0×</span></label>
      <input type="range" id="f-size" min="0.3" max="2.5" step="0.1" value="1" />
    </div>
    <button class="btn" id="f-reset">↺ reset filters</button>
  `;

  // spectral class chips
  const classWrap = root.querySelector('#f-class');
  const active = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
  const chips = [];
  SPECTRAL_CLASSES.forEach((sc, idx) => {
    const c = document.createElement('div');
    c.className = 'chip on'; c.textContent = sc.key; c.title = `${sc.label} · ${sc.temp}`;
    c.style.background = sc.color; c.style.color = '#001018';
    c.onclick = () => toggleClass(idx, c, sc.color);
    classWrap.appendChild(c); chips[idx] = c;
  });
  const other = document.createElement('div');
  other.className = 'chip on'; other.textContent = '·'; other.title = 'other / unknown (W, L, T, D, C, S…)';
  other.style.background = '#9fb0bd'; other.style.color = '#001018';
  other.onclick = () => toggleClass(7, other, '#9fb0bd');
  classWrap.appendChild(other); chips[7] = other;

  function toggleClass(idx, el, color) {
    if (active.has(idx)) { active.delete(idx); el.classList.remove('on'); el.style.background = 'transparent'; el.style.color = ''; }
    else { active.add(idx); el.classList.add('on'); el.style.background = color; el.style.color = '#001018'; }
    app.setFilter({ classes: active });
  }

  // constellation select
  const conSel = root.querySelector('#f-con');
  cons.map((c, i) => ({ i, full: c[1] }))
    .sort((a, b) => a.full.localeCompare(b.full))
    .forEach(({ i, full }) => {
      const o = document.createElement('option');
      o.value = i; o.textContent = full; conSel.appendChild(o);
    });
  conSel.onchange = () => app.setFilter({ con: +conSel.value });

  // magnitude
  const mag = root.querySelector('#f-mag'), magV = root.querySelector('#f-mag-v');
  mag.oninput = () => { magV.textContent = (+mag.value).toFixed(1); app.setFilter({ magMax: +mag.value }); };

  // distance
  const dist = root.querySelector('#f-dist'), distV = root.querySelector('#f-dist-v');
  dist.oninput = () => { distV.textContent = fmtDistLabel(+dist.value); app.setFilter({ distMaxLy: +dist.value }); };

  // named only
  const named = root.querySelector('#f-named');
  named.onclick = () => { named.classList.toggle('on'); app.setFilter({ namedOnly: named.classList.contains('on') }); };

  // size
  const size = root.querySelector('#f-size'), sizeV = root.querySelector('#f-size-v');
  size.oninput = () => { sizeV.textContent = (+size.value).toFixed(1) + '×'; app.starfield.setSizeScale(+size.value); };

  // reset
  root.querySelector('#f-reset').onclick = () => {
    mag.value = 21; magV.textContent = '21.0';
    dist.value = 1000; distV.textContent = '1000 ly';
    conSel.value = '-1';
    named.classList.remove('on');
    size.value = 1; sizeV.textContent = '1.0×'; app.starfield.setSizeScale(1);
    active.clear(); [0, 1, 2, 3, 4, 5, 6, 7].forEach((i) => active.add(i));
    chips.forEach((el, i) => { el.classList.add('on'); const col = i < 7 ? SPECTRAL_CLASSES[i].color : '#9fb0bd'; el.style.background = col; el.style.color = '#001018'; });
    app.setFilter({ magMax: 21, distMaxLy: 1000, con: -1, namedOnly: false, classes: active });
  };

  // initial pass (default 1000 ly view)
  app.setFilter({ magMax: 21, distMaxLy: 1000, con: -1, namedOnly: false, classes: active });
}

function fmtDistLabel(ly) {
  return ly >= 1000 ? `${(ly / 1000).toFixed(2)}k ly` : `${fmtNum(ly)} ly`;
}
