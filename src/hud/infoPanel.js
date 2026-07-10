import { bvToDisplayRGB } from '../util/color.js';
import { fmtRA, fmtDec, fmtDist, fmtLum } from '../util/astro.js';
import { fmtCosmoDist, fmtMpc, fmtZ, lookbackGyr } from '../util/cosmology.js';
import { fetchExoplanets } from '../data/remote.js';

// Right-hand info dock. Renders stars (local mode) or galaxies/quasars (cosmos).
export function initInfoPanel(app) {
  const dock = document.getElementById('infodock');

  app.on('select', (o) => {
    if (!o) { dock.hidden = true; dock.innerHTML = ''; return; }
    dock.hidden = false;
    dock.innerHTML = o.kind === 'star' ? renderStar(o) : renderCosmos(o);
    dock.querySelector('.info-close').onclick = () => app.clearSelection();
    const fly = dock.querySelector('#i-fly');
    if (fly) fly.onclick = () => (o.kind === 'star' ? app.flyToStar(o.i) : app.flyToPos(o.worldPos));
    const exo = dock.querySelector('#i-exo');
    if (exo) exo.onclick = () => runExo(o, dock);
  });
  app.on('mode', () => { dock.hidden = true; dock.innerHTML = ''; });
}

function renderStar(s) {
  const [r, g, b] = bvToDisplayRGB(s.ci);
  const swatch = `rgb(${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0})`;
  const ids = [];
  if (s.hip) ids.push('HIP ' + s.hip);
  if (s.hd) ids.push('HD ' + s.hd);
  if (s.gl) ids.push(s.gl);
  if (s.bf) ids.push(s.bf);
  const rows = s.isSun ? [
    ['Class', 'G2V — yellow dwarf'], ['Distance', '0 (reference origin)'],
    ['Apparent mag', '−26.74'], ['Absolute mag', '+4.83'], ['Luminosity', '1 L☉'],
  ] : [
    ['Spectral type', s.spect], ['Distance', fmtDist(s.distPc), 'hl'], ['', `${s.distPc.toFixed(2)} pc`],
    ['Apparent mag', s.mag.toFixed(2)], ['Absolute mag', s.absmag.toFixed(2)], ['Luminosity', fmtLum(s.lum)],
    ['Colour index B–V', s.ci.toFixed(3)], ['Right ascension', fmtRA(s.ra)], ['Declination', fmtDec(s.dec)],
    ['Constellation', s.con || '—'],
  ];
  return head(s.name, ids.join('  ·  ') || 'uncatalogued', swatch) + grid(rows) + actions(!s.isSun);
}

function renderCosmos(o) {
  const isGx = o.kind === 'localgalaxy';
  const swatch = o.kind === 'quasar' ? '#c86bff' : isGx ? '#9fe8ff' : '#7fd4ff';
  const rows = [];
  rows.push(['Type', o.sub || o.kind]);
  if (o.z != null) rows.push(['Redshift z', fmtZ(o.z), 'hl']);
  rows.push(['Comoving dist', fmtCosmoDist(o.comovingMpc), 'hl']);
  rows.push(['', fmtMpc(o.comovingMpc)]);
  if (o.z != null) rows.push(['Look-back time', `${lookbackGyr(o.z).toFixed(2)} Gyr`]);
  else rows.push(['Distance', `${(o.distLy / 1e6).toFixed(2)} Mly`]);
  rows.push(['Right ascension', fmtRA(o.ra)]);
  rows.push(['Declination', fmtDec(o.dec)]);
  rows.push(['Survey', o.survey]);
  const label = o.kind === 'quasar' ? 'QUASAR' : isGx ? '' : 'GALAXY';
  return head(o.name, label ? `${label} · ${o.survey}` : o.survey, swatch) + grid(rows) + actions(false);
}

function head(name, sub, swatch) {
  return `<div class="info-head"><div>
      <div class="info-name"><span class="info-swatch" style="color:${swatch};background:${swatch}"></span>${esc(name)}</div>
      <div class="info-sub">${esc(sub)}</div>
    </div><button class="info-close" title="close">✕</button></div>`;
}
function grid(rows) {
  return `<dl class="datagrid">${rows.map(([k, v, cls]) => `<dt>${esc(k)}</dt><dd class="${cls || ''}">${esc(v)}</dd>`).join('')}</dl>`;
}
function actions(withExo) {
  return `<div class="info-actions"><button class="btn sm" id="i-fly">➤ fly to</button>${withExo ? '<button class="btn sm" id="i-exo">◇ query exoplanets</button>' : ''}</div><div id="i-exo-out" class="muted" style="margin-top:8px"></div>`;
}

async function runExo(star, dock) {
  const out = dock.querySelector('#i-exo-out'), btn = dock.querySelector('#i-exo');
  out.innerHTML = '<span style="color:var(--cyan)">querying NASA Exoplanet Archive…</span>';
  btn.disabled = true;
  const res = await fetchExoplanets(star);
  btn.disabled = false;
  if (!res.ok) { out.innerHTML = `<span style="color:var(--amber)">live data unavailable</span><br>${esc(res.note || '')}`; return; }
  if (!res.planets.length) { out.innerHTML = `<span>${esc(res.source)}: no confirmed planets on record.</span>`; return; }
  out.innerHTML = `<div style="color:var(--green);margin-bottom:4px">${res.planets.length} planet(s) · ${esc(res.source)}</div>` +
    res.planets.map((p) => {
      const bits = [];
      if (p.period) bits.push(`P=${(+p.period).toFixed(1)} d`);
      if (p.radius) bits.push(`${(+p.radius).toFixed(1)} R⊕`);
      if (p.mass) bits.push(`${(+p.mass).toFixed(1)} M⊕`);
      if (p.year) bits.push(`${p.year}`);
      return `<div style="padding:3px 0;border-top:1px solid var(--line)"><b>${esc(p.name)}</b><br><span class="muted">${esc(bits.join(' · '))}</span></div>`;
    }).join('');
}

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
