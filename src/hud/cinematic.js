// A small shared "Cinematic" render-options group (glow / twinkle / filmic tone),
// dropped into both the LOCAL and COSMOS Layers panels. The options are global and
// persisted (app.setCinematic → localStorage), so toggling in one mode sticks.

export function cinematicSection(app) {
  const t = (key, label, sub) =>
    `<div class="toggle ${app.cine[key] ? 'on' : ''}" data-cine="${key}"><span>${label}${sub ? ` <span class="muted">· ${sub}</span>` : ''}</span><span class="sw"></span></div>`;
  return `<div class="hr"></div>
    <div class="muted" style="margin-bottom:6px">Cinematic</div>
    ${t('bloom', 'Glow', 'bloom')}
    ${t('twinkle', 'Star twinkle')}
    ${t('tone', 'Filmic tone', 'ACES')}`;
}

export function wireCinematic(root, app) {
  root.querySelectorAll('[data-cine]').forEach((el) => {
    el.onclick = () => { el.classList.toggle('on'); app.setCinematic(el.dataset.cine, el.classList.contains('on')); };
  });
}
