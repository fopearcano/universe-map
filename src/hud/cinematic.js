// A small shared "Cinematic" render-options group (glow / twinkle / filmic tone),
// dropped into both the LOCAL and COSMOS Layers panels. The options are global and
// persisted (app.setCinematic → localStorage), so toggling in one mode sticks.

export function cinematicSection(app) {
  const t = (key, label, sub) =>
    `<div class="toggle ${app.cine[key] ? 'on' : ''}" data-cine="${key}"><span>${label}${sub ? ` <span class="muted">· ${sub}</span>` : ''}</span><span class="sw"></span></div>`;
  const glowPct = Math.round(((app.cine.glow ?? 0.5) / 1.6) * 100);
  return `<div class="hr"></div>
    <div class="muted" style="margin-bottom:6px">Cinematic</div>
    ${t('bloom', 'Glow', 'bloom')}
    <div class="cine-glow">
      <span class="muted">strength</span>
      <input type="range" id="cine-glow" min="6" max="100" value="${glowPct}" />
      <span class="cine-glow-v">${(app.cine.glow ?? 0.5).toFixed(2)}×</span>
    </div>
    ${t('twinkle', 'Star twinkle')}
    ${t('shard', 'RGB shard twinkle', 'prism flare')}
    ${t('tone', 'Filmic tone', 'ACES')}`;
}

export function wireCinematic(root, app) {
  root.querySelectorAll('[data-cine]').forEach((el) => {
    el.onclick = () => { el.classList.toggle('on'); app.setCinematic(el.dataset.cine, el.classList.contains('on')); };
  });
  const g = root.querySelector('#cine-glow');
  if (g) g.oninput = () => { const v = (+g.value / 100) * 1.6; app.setGlow(v); const lbl = root.querySelector('.cine-glow-v'); if (lbl) lbl.textContent = `${v.toFixed(2)}×`; };
}
