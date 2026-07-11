// Chat UI for the Solaris.Ai NAVCOM agent — a colloquial navigator you can ask about
// the universe and the QTR canon, and that plots & flies courses for you by driving
// the map through tool calls. Talks to any OpenAI-compatible endpoint (LM Studio /
// vLLM / Ollama / OpenAI / Anthropic-compat), configured in the ⚙ settings.
import { NavAgent } from '../ai/agent.js';
import { loadConfig, saveConfig, listModels, isConfigured, PRESETS } from '../ai/llm.js';

const TOOL_VERB = {
  search_sky: 'scanning the sky', lookup_qtr: 'consulting the codex', plot_route: 'plotting a course',
  add_stop: 'adding a stop', clear_route: 'clearing the course', set_drive: 'setting the drive',
  engage: 'threading the seam 𝔍', stop_engine: 'disengaging', set_mode: 'changing scale',
  focus: 'flying over', set_layer: 'adjusting overlays', get_state: 'checking instruments',
};

export function initNavcomAgent(app, qtr) {
  const agent = new NavAgent(app, qtr);
  const panel = document.createElement('div'); panel.id = 'navcom-ai'; panel.hidden = true; document.body.appendChild(panel);
  panel.innerHTML = `
    <div class="na-head">
      <div class="na-title">✦ SOLARIS.AI <span class="muted">· Tekné NAVCOM</span></div>
      <div class="na-head-btns">
        <button class="na-ic" id="na-cfg" title="endpoint settings">⚙</button>
        <button class="na-ic" id="na-clear" title="new conversation">⟲</button>
        <button class="na-ic" id="na-x" title="close">✕</button>
      </div>
    </div>
    <div class="na-log" id="na-log"></div>
    <div class="na-suggest" id="na-suggest"></div>
    <form class="na-input" id="na-form">
      <input id="na-text" type="text" autocomplete="off" placeholder="ask the NAVCOM… (e.g. plot Sol → Andromeda → Virgo Cluster)" />
      <button class="na-send" id="na-send" type="submit" title="send">➤</button>
    </form>
    <div class="na-settings" id="na-settings" hidden></div>`;

  const log = panel.querySelector('#na-log');
  const form = panel.querySelector('#na-form');
  const input = panel.querySelector('#na-text');
  const settings = panel.querySelector('#na-settings');
  const suggest = panel.querySelector('#na-suggest');
  let thinkingEl = null;

  const open = () => { panel.hidden = false; input.focus(); if (!log.childElementCount) greet(); };
  const close = () => { panel.hidden = true; };
  document.getElementById('navcom-ai-btn').onclick = () => (panel.hidden ? open() : close());
  panel.querySelector('#na-x').onclick = close;
  panel.querySelector('#na-clear').onclick = () => { agent.reset(); log.innerHTML = ''; greet(); };
  panel.querySelector('#na-cfg').onclick = () => toggleSettings();
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden && settings.hidden) close(); });

  const SUGGESTIONS = [
    'plot Sol → Andromeda Galaxy → Virgo Cluster',
    'what is the Sōrn drive?',
    'take me to the Great Attractor at Class II',
    'where is the Boötes Void?',
  ];
  function greet() {
    addMsg('assistant', "Solaris.Ai online. I've got the whole chart and the codex — ask me anything, or tell me where to take us and I'll plot the crossing. Where to?");
    suggest.innerHTML = SUGGESTIONS.map((s) => `<button class="na-chip" data-q="${esc(s)}">${esc(s)}</button>`).join('');
    suggest.querySelectorAll('.na-chip').forEach((b) => { b.onclick = () => { input.value = b.dataset.q; submit(); }; });
    if (!isConfigured()) addSystem('No model endpoint set yet — click ⚙ to point me at your LM Studio / vLLM / OpenAI endpoint.');
  }

  function addMsg(role, text) {
    const d = document.createElement('div'); d.className = `na-msg na-${role}`;
    d.innerHTML = role === 'assistant' ? mdish(text) : esc(text);
    log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
  }
  function addSystem(text) { const d = document.createElement('div'); d.className = 'na-sys muted'; d.textContent = text; log.appendChild(d); log.scrollTop = log.scrollHeight; }
  function addTool(name) {
    const d = document.createElement('div'); d.className = 'na-tool';
    d.innerHTML = `<span class="na-gear">⚙</span> ${esc(TOOL_VERB[name] || name)}…`;
    log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
  }
  function setThinking(on) {
    if (on && !thinkingEl) { thinkingEl = document.createElement('div'); thinkingEl.className = 'na-tool na-think'; thinkingEl.innerHTML = '<span class="na-dots"><i></i><i></i><i></i></span>'; log.appendChild(thinkingEl); log.scrollTop = log.scrollHeight; }
    else if (!on && thinkingEl) { thinkingEl.remove(); thinkingEl = null; }
  }

  function submit() {
    const text = input.value.trim(); if (!text) return;
    suggest.innerHTML = '';
    addMsg('user', text); input.value = ''; input.disabled = true;
    agent.send(text, onEvent).finally(() => { input.disabled = false; input.focus(); setThinking(false); });
  }
  form.onsubmit = (e) => { e.preventDefault(); submit(); };

  function onEvent(ev) {
    if (ev.type === 'thinking') setThinking(true);
    else if (ev.type === 'tool') { setThinking(false); addTool(ev.name); setThinking(true); }
    else if (ev.type === 'assistant') { setThinking(false); if (ev.text && ev.text !== '(no reply)') addMsg('assistant', ev.text); }
    else if (ev.type === 'error') { setThinking(false); addSystem(`⚠ ${ev.message}`); }
    else if (ev.type === 'need-config') { setThinking(false); addSystem('No model endpoint set — click ⚙ to configure one.'); toggleSettings(true); }
  }

  // ---- settings ----
  function toggleSettings(force) {
    const show = force != null ? force : settings.hidden;
    settings.hidden = !show;
    if (show) renderSettings();
  }
  function renderSettings() {
    const c = loadConfig();
    settings.innerHTML = `
      <div class="na-set-h">endpoint · everything stays in your browser</div>
      <div class="na-set-row"><label>preset</label><select id="na-preset">${PRESETS.map((p) => `<option value="${p.id}">${esc(p.label)}</option>`).join('')}<option value="">custom…</option></select></div>
      <div class="na-set-row"><label>base URL</label><input id="na-base" type="text" value="${esc(c.baseUrl)}" placeholder="http://localhost:1234/v1" /></div>
      <div class="na-set-row"><label>model</label><span class="na-model-wrap"><input id="na-model" type="text" value="${esc(c.model)}" placeholder="model id" /><button class="btn sm" id="na-models" type="button">list</button></span></div>
      <div class="na-set-row"><label>API key</label><input id="na-key" type="password" value="${esc(c.apiKey)}" placeholder="(blank for local models)" /></div>
      <div class="na-set-row"><label>temp</label><input id="na-temp" type="number" min="0" max="2" step="0.1" value="${c.temperature}" /></div>
      <div class="na-set-note muted" id="na-set-note">Local models (LM Studio / vLLM) need CORS enabled and no key. Hosted APIs need a key — it is stored only in this browser.</div>
      <div class="na-set-btns"><button class="btn sm" id="na-test" type="button">test connection</button><button class="btn sm na-save" id="na-save" type="button">save</button></div>`;
    const base = settings.querySelector('#na-base'), model = settings.querySelector('#na-model'), key = settings.querySelector('#na-key'), temp = settings.querySelector('#na-temp'), note = settings.querySelector('#na-set-note');
    settings.querySelector('#na-preset').onchange = (e) => { const p = PRESETS.find((x) => x.id === e.target.value); if (p) { base.value = p.baseUrl; note.textContent = p.keyHint; } };
    settings.querySelector('#na-save').onclick = () => { saveConfig({ baseUrl: base.value.trim(), model: model.value.trim(), apiKey: key.value.trim(), temperature: +temp.value || 0.7 }); note.textContent = '✓ saved'; setTimeout(() => toggleSettings(false), 500); };
    settings.querySelector('#na-models').onclick = async () => {
      note.textContent = 'querying models…';
      const ms = await listModels({ baseUrl: base.value.trim(), apiKey: key.value.trim() });
      if (!ms.length) { note.textContent = 'no models returned (check URL / CORS / key)'; return; }
      if (!model.value) model.value = ms[0];
      note.innerHTML = `${ms.length} models: ` + ms.slice(0, 12).map((m) => `<button class="na-mchip" data-m="${esc(m)}">${esc(m)}</button>`).join(' ');
      note.querySelectorAll('.na-mchip').forEach((b) => { b.onclick = () => { model.value = b.dataset.m; }; });
    };
    settings.querySelector('#na-test').onclick = async () => {
      note.textContent = 'testing…';
      saveConfig({ baseUrl: base.value.trim(), model: model.value.trim(), apiKey: key.value.trim(), temperature: +temp.value || 0.7 });
      try {
        const { chatCompletion } = await import('../ai/llm.js');
        const r = await chatCompletion(loadConfig(), { messages: [{ role: 'user', content: 'Reply with exactly: online' }] });
        note.textContent = `✓ reachable — model said: "${(r.content || '').slice(0, 40)}"`;
      } catch (e) { note.textContent = `✗ ${e.message}`; }
    };
  }

  app._openNavcomAgent = open;
}

// Minimal, safe markdown-ish rendering: escape first, then **bold**, *italic*, `code`,
// bullet lines and newlines.
function mdish(s) {
  let t = esc(String(s ?? ''));
  t = t.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/(?<!\*)\*(?!\*)([^*\n]+)\*(?!\*)/g, '<i>$1</i>');
  t = t.replace(/^\s*[-•]\s+(.*)$/gm, '<span class="na-li">• $1</span>');
  return t.replace(/\n/g, '<br>');
}
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
