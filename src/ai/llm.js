// A tiny OpenAI-compatible chat client for the NAVCOM AI. Talks to any endpoint that
// speaks POST /v1/chat/completions with tool-calling — LM Studio, vLLM, Ollama, the
// OpenAI API, or Anthropic's OpenAI-compatibility layer. Everything is client-side:
// the base URL, model and (optional) key live in localStorage. For a local model on
// your own GPU (LM Studio / vLLM) no key is needed; for a hosted API you supply one.

const LS_KEY = 'navcom.llm.config.v1';

export const PRESETS = [
  { id: 'lmstudio', label: 'LM Studio (local)', baseUrl: 'http://localhost:1234/v1', keyHint: 'no key needed' },
  { id: 'vllm', label: 'vLLM (local)', baseUrl: 'http://localhost:8000/v1', keyHint: 'no key needed' },
  { id: 'ollama', label: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', keyHint: 'no key needed' },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', keyHint: 'sk-… key required' },
  { id: 'anthropic', label: 'Anthropic (OpenAI-compat)', baseUrl: 'https://api.anthropic.com/v1', keyHint: 'sk-ant-… key required' },
];

const DEFAULTS = { baseUrl: 'http://localhost:1234/v1', model: '', apiKey: '', temperature: 0.7 };

export function loadConfig() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS_KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}
export function saveConfig(cfg) {
  const merged = { ...loadConfig(), ...cfg };
  try { localStorage.setItem(LS_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
  return merged;
}
export function isConfigured() { const c = loadConfig(); return !!(c.baseUrl && c.model); }

function endpoint(baseUrl, path) { return `${String(baseUrl || '').replace(/\/+$/, '')}${path}`; }
function headers(cfg) {
  const h = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) h.Authorization = `Bearer ${cfg.apiKey}`;
  // Anthropic's OpenAI-compat layer requires the explicit browser opt-in header.
  if (/anthropic\.com/.test(cfg.baseUrl || '')) h['anthropic-dangerous-direct-browser-access'] = 'true';
  return h;
}

// One chat turn. Returns { content, toolCalls, finishReason }. Throws on transport /
// HTTP error with a readable message the UI can surface.
export async function chatCompletion(cfg, { messages, tools, temperature, signal } = {}) {
  const body = {
    model: cfg.model,
    messages,
    temperature: temperature ?? cfg.temperature ?? 0.7,
    stream: false,
  };
  if (tools && tools.length) { body.tools = tools; body.tool_choice = 'auto'; }
  let res;
  try {
    res = await fetch(endpoint(cfg.baseUrl, '/chat/completions'), { method: 'POST', headers: headers(cfg), body: JSON.stringify(body), signal });
  } catch (e) {
    throw new Error(`can't reach ${cfg.baseUrl} — is the server running & CORS enabled? (${e.message})`);
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`endpoint ${res.status}: ${(txt || res.statusText).slice(0, 300)}`);
  }
  const data = await res.json();
  const msg = data.choices?.[0]?.message || {};
  return { content: msg.content || '', toolCalls: msg.tool_calls || [], finishReason: data.choices?.[0]?.finish_reason, raw: msg };
}

// List available models (for the settings picker). Returns [] on any failure.
export async function listModels(cfg) {
  try {
    const res = await fetch(endpoint(cfg.baseUrl, '/models'), { headers: headers(cfg) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || data.models || []).map((m) => m.id || m.name).filter(Boolean);
  } catch { return []; }
}
