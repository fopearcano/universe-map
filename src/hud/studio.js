import * as THREE from 'three';
import { cartesianToRaDec, PC_TO_LY } from '../util/astro.js';

// Story Studio: a modal to author imagined / hypothetical objects & events for
// story-crafting. Saved to the persistent user store (survives reload). Also wires
// app._openStudio so the info panel's ✎ edit button can reuse it.
export function initStudio(app) {
  const modal = document.createElement('div');
  modal.id = 'studio-modal'; modal.hidden = true;
  document.body.appendChild(modal);
  app._openStudio = (existing) => open(existing);

  const cats = app.atlasCategories || {};
  const catOptions = ['<option value="fictional">fictional</option>']
    .concat(Object.entries(cats).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`)).join('');

  function open(existing) {
    const e = existing || {};
    const distUnit = pickUnit(e.distLy);
    modal.hidden = false;
    modal.innerHTML = `
      <div class="sm-box">
        <div class="sm-head">
          <span>${existing ? '✎ Edit object' : '✦ Imagine an object / event'}</span>
          <button class="sm-x" title="close">✕</button>
        </div>
        <div class="sm-body">
          <label>Name<input id="sm-name" type="text" value="${attr(e.name)}" placeholder="e.g. The Sable Rift" /></label>
          <div class="sm-row">
            <label>Category<select id="sm-cat">${catOptions}</select></label>
            <label>Type<input id="sm-type" type="text" value="${attr(e.type)}" placeholder="e.g. rogue anomaly" /></label>
          </div>
          <div class="sm-row">
            <label>RA (hours)<input id="sm-ra" type="number" step="0.001" min="0" max="24" value="${num(e.ra)}" /></label>
            <label>Dec (°)<input id="sm-dec" type="number" step="0.001" min="-90" max="90" value="${num(e.dec)}" /></label>
            <button class="btn sm" id="sm-view" title="fill from the current view direction">◎ use view</button>
          </div>
          <div class="sm-row">
            <label>Distance<input id="sm-dist" type="number" step="any" min="0" value="${distUnit.value}" /></label>
            <label>Unit<select id="sm-unit">
              ${['ly', 'kly', 'Mly', 'Gly'].map((u) => `<option value="${u}" ${u === distUnit.unit ? 'selected' : ''}>${u}</option>`).join('')}
            </select></label>
          </div>
          <label>Lore / notes<textarea id="sm-facts" rows="4" placeholder="Describe this object or event for your story…">${esc(e.facts || '')}</textarea></label>
        </div>
        <div class="sm-foot">
          ${existing ? '<button class="btn sm" id="sm-del">🗑 delete</button>' : '<span></span>'}
          <div class="sm-foot-r">
            <button class="btn sm" id="sm-cancel">cancel</button>
            <button class="btn sm sm-save" id="sm-save">${existing ? 'save' : '✦ create'}</button>
          </div>
        </div>
      </div>`;
    if (e.category) modal.querySelector('#sm-cat').value = e.category;

    modal.querySelector('.sm-x').onclick = close;
    modal.querySelector('#sm-cancel').onclick = close;
    modal.querySelector('#sm-view').onclick = fillFromView;
    modal.querySelector('#sm-save').onclick = () => save(existing);
    const del = modal.querySelector('#sm-del'); if (del) del.onclick = () => { app.removeCustomObject(existing.id); close(); };
    modal.querySelector('#sm-name').focus();
  }

  function fillFromView() {
    const cam = app.scene.camera;
    const d = new THREE.Vector3(); cam.getWorldDirection(d);
    const { ra, dec } = cartesianToRaDec(d.x, d.y, d.z);
    modal.querySelector('#sm-ra').value = ra.toFixed(3);
    modal.querySelector('#sm-dec').value = dec.toFixed(3);
    // distance from the current view scale
    const camR = cam.position.length();
    let distLy;
    if (app.mode === 'cosmos') distLy = Math.pow(10, camR / (app.cosmos?.decadeUnit || 3)) * PC_TO_LY;
    else distLy = camR * PC_TO_LY;
    const u = pickUnit(distLy);
    modal.querySelector('#sm-dist').value = u.value;
    modal.querySelector('#sm-unit').value = u.unit;
  }

  function save(existing) {
    const name = modal.querySelector('#sm-name').value.trim();
    if (!name) { modal.querySelector('#sm-name').focus(); return; }
    const unit = modal.querySelector('#sm-unit').value;
    const factor = { ly: 1, kly: 1e3, Mly: 1e6, Gly: 1e9 }[unit] || 1;
    const patch = {
      name, category: modal.querySelector('#sm-cat').value,
      type: modal.querySelector('#sm-type').value.trim(),
      ra: clamp(+modal.querySelector('#sm-ra').value || 0, 0, 24),
      dec: clamp(+modal.querySelector('#sm-dec').value || 0, -90, 90),
      distLy: Math.max(0, (+modal.querySelector('#sm-dist').value || 0) * factor),
      facts: modal.querySelector('#sm-facts').value.trim(),
    };
    if (existing) app.updateCustomObject(existing.id, patch);
    else { const rec = app.addCustomObject({ kind: 'imagined', source: 'user', ...patch }); app.selectCustom(rec.id, { fly: true }); }
    close();
  }

  function close() { modal.hidden = true; modal.innerHTML = ''; }
}

function pickUnit(distLy) {
  const ly = distLy || 0;
  if (ly >= 1e9) return { value: +(ly / 1e9).toFixed(3), unit: 'Gly' };
  if (ly >= 1e6) return { value: +(ly / 1e6).toFixed(3), unit: 'Mly' };
  if (ly >= 1e3) return { value: +(ly / 1e3).toFixed(3), unit: 'kly' };
  return { value: +(+ly).toFixed(2) || 100, unit: 'ly' };
}
function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function num(v) { return v == null ? '' : v; }
function attr(s) { return String(s ?? '').replace(/"/g, '&quot;'); }
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
