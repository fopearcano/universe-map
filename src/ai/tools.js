// The Solaris.Ai NAVCOM's toolbelt: OpenAI function-calling schemas + an executor
// that drives the live map (app) and reads the QTR knowledge base (qtr). Every tool
// returns a plain JSON-able object that is fed back to the model as the tool result.

export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_sky', description: 'Search the real astronomical map for objects by name — stars, galaxies, Local Group members, star clusters, large-scale structures and supervoids. Use this to find real targets before plotting a course.',
      parameters: { type: 'object', properties: { query: { type: 'string', description: 'name or partial name, e.g. "Andromeda", "Sirius", "Virgo Cluster"' }, limit: { type: 'integer', description: 'max results (default 8)' } }, required: ['query'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lookup_qtr', description: 'Search the QTR "Immeasurable Spaces" fiction knowledge base (concepts, factions, ships, drives, places, hazards, lexicon, events). Use this to answer lore questions and ground the ship in canon.',
      parameters: { type: 'object', properties: { query: { type: 'string', description: 'a term or phrase, e.g. "Sōrn drive", "seam", "Nūbi", "curvature limit"' }, limit: { type: 'integer', description: 'max results (default 6)' } }, required: ['query'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'plot_route', description: 'Plot a whole course from an ordered list of stops, replacing any current route. Each stop is a real object name (resolved via search) or explicit coordinates. Returns the path length, coordinate & crew time and the number of Idrenes-bridge crossings under the current drive.',
      parameters: { type: 'object', properties: { stops: { type: 'array', items: { type: 'object', properties: { name: { type: 'string', description: 'object name to resolve' }, ra: { type: 'number', description: 'right ascension in HOURS (only if giving raw coords)' }, dec: { type: 'number', description: 'declination in DEGREES' }, distLy: { type: 'number', description: 'distance in light-years' }, label: { type: 'string' } } }, description: 'ordered stops; start with Sol/Sun if you want to depart from home' } }, required: ['stops'] },
    },
  },
  { type: 'function', function: { name: 'add_stop', description: 'Append one stop to the current course.', parameters: { type: 'object', properties: { name: { type: 'string' }, ra: { type: 'number' }, dec: { type: 'number' }, distLy: { type: 'number' }, label: { type: 'string' } } } } },
  { type: 'function', function: { name: 'clear_route', description: 'Clear the current course.', parameters: { type: 'object', properties: {} } } },
  {
    type: 'function',
    function: {
      name: 'set_drive', description: 'Choose the QTR drive (a depth rung on the Ship-Relative Speed Law). Faster classes cross in less time.',
      parameters: { type: 'object', properties: { drive: { type: 'string', description: 'one of: Class 0 (Casimir Sailer / Relativistic run), Class I (Idrenes–Sōrn bridge-runner ~10^10c), Class II (Unruh Catamaran), Class III (Squeezing Bathyscaphe), Class ω (Idrenes Composite · Tekné). Accepts a class ("I","ω"), a name, or an id.' } }, required: ['drive'] },
    },
  },
  { type: 'function', function: { name: 'engage', description: 'Engage the autopilot and thread the seam 𝔍 along the current course (needs at least 2 stops).', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'stop_engine', description: 'Disengage the autopilot.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'set_mode', description: 'Switch scale: "system" (the Solar System, to scale), "local" (true-scale stellar neighbourhood) or "cosmos" (the whole observable universe, log-radial).', parameters: { type: 'object', properties: { mode: { type: 'string', enum: ['system', 'local', 'cosmos'] } }, required: ['mode'] } } },
  { type: 'function', function: { name: 'solar_system_focus', description: 'In the SYSTEM scale, fly the camera to a Solar-System body by name and select it (switches to the SYSTEM scale first). Use for requests like "take me to Saturn" or "show me Jupiter’s moons".', parameters: { type: 'object', properties: { body: { type: 'string', description: 'Sun, a planet (Mercury…Neptune), a dwarf planet (Ceres, Pluto, Eris) or a moon (Io, Europa, Titan, Triton, Moon…)' } }, required: ['body'] } } },
  { type: 'function', function: { name: 'solar_system_info', description: 'Read the Solar System catalogue to ground answers about the planets/moons. With a body name → its facts, orbit (AU), period, eccentricity, inclination, radius and moon count. With no name → the list of bodies.', parameters: { type: 'object', properties: { body: { type: 'string', description: 'optional body name; omit to list all bodies' } } } } },
  { type: 'function', function: { name: 'solar_system_time', description: 'Control the SYSTEM-scale orbital animation: pause/resume the planets and set the time speed (1 = Earth orbits in ~10 s).', parameters: { type: 'object', properties: { pause: { type: 'boolean', description: 'true to freeze the planets, false to resume' }, speed: { type: 'number', description: 'time-speed multiplier, e.g. 0.25 slow · 1 normal · 4 fast' } } } } },
  { type: 'function', function: { name: 'focus', description: 'Fly the camera to an object and centre on it (does not add it to the route).', parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } } },
  { type: 'function', function: { name: 'set_layer', description: 'Toggle a map overlay on/off.', parameters: { type: 'object', properties: { layer: { type: 'string', description: 'sector | voids | imagery | clusterShapes | resolveGalaxies | procedural | bridge | cmb' }, on: { type: 'boolean' } }, required: ['layer', 'on'] } } },
  { type: 'function', function: { name: 'get_state', description: 'Read the current NAVCOM state: mode, selected drive, whether engaged, current route summary, selection and active overlays.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'list_trade_routes', description: 'List the charted commercial & military routes in the "Ledger of Ways" overlay (poetic names, operators, drive class, traffic, lore, waypoints). Optionally filter by category or a search term.', parameters: { type: 'object', properties: { category: { type: 'string', enum: ['commercial', 'military'] }, query: { type: 'string', description: 'optional name/lore substring filter' } } } } },
  { type: 'function', function: { name: 'load_trade_route', description: 'Load one of the charted Ledger routes into the NAV COMPUTER as a flyable course (also sets its drive). Then you may engage to fly it.', parameters: { type: 'object', properties: { id_or_name: { type: 'string', description: 'the route id or (part of) its poetic name, e.g. "silk-of-suns" or "Silk Road of Suns"' } }, required: ['id_or_name'] } } },
  { type: 'function', function: { name: 'show_trade_route', description: 'Highlight one charted Ledger route on the map and frame it in view (does not load it into the NAV COMPUTER). Turns the overlay on.', parameters: { type: 'object', properties: { id_or_name: { type: 'string' } }, required: ['id_or_name'] } } },
];

function matchRoute(app, q) {
  const s = String(q || '').toLowerCase().trim();
  const list = app.tradeRouteList();
  return list.find((r) => r.id === s) || list.find((r) => r.name.toLowerCase() === s)
    || list.find((r) => r.name.toLowerCase().includes(s)) || list.find((r) => s.includes(r.id));
}

// Search the QTR knowledge base (name / summary / jp / etymology substring match).
function lookupQtr(qtr, query, limit = 6) {
  if (!qtr || !qtr.records) return { results: [], note: 'codex not loaded' };
  const q = String(query || '').toLowerCase().trim();
  const terms = q.split(/\s+/).filter(Boolean);
  const score = (r) => {
    const hay = `${r.name || ''} ${r.jp || ''} ${r.summary || ''} ${r.etymology || ''} ${r.reading || ''}`.toLowerCase();
    if (hay.includes(q)) return 3 + ((r.name || '').toLowerCase() === q ? 5 : 0) + ((r.name || '').toLowerCase().includes(q) ? 2 : 0);
    let s = 0; for (const t of terms) if (hay.includes(t)) s += 1; return s;
  };
  const ranked = qtr.records.map((r) => ({ r, s: score(r) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, limit);
  return {
    results: ranked.map(({ r }) => ({
      id: r.id, name: r.name, jp: r.jp || undefined, type: r.type, summary: r.summary,
      links: (r.links || []).slice(0, 6).map((l) => ({ rel: l.rel, to: (qtr.get(l.target) || {}).name || l.target })),
    })),
  };
}

export async function runTool(app, qtr, name, args = {}) {
  try {
    switch (name) {
      case 'search_sky': return { results: app.agentSearchSky(args.query, args.limit || 8) };
      case 'lookup_qtr': return lookupQtr(qtr, args.query, args.limit || 6);
      case 'plot_route': return app.agentPlotRoute(args.stops || []);
      case 'add_stop': return app.agentAddStop(args);
      case 'clear_route': app.clearRoute(); return { ok: true, cleared: true };
      case 'set_drive': return app.agentSetDrive(args.drive);
      case 'engage': {
        if ((app.route || []).length < 2) return { ok: false, error: 'need at least 2 stops to engage — plot a course first' };
        app.engageRoute(); return { ok: true, engaged: true, ...app._agentSummary() };
      }
      case 'stop_engine': app.stopRoute(); return { ok: true, engaged: false };
      case 'set_mode': { const m = ['system', 'local', 'cosmos'].includes(args.mode) ? args.mode : 'local'; app.setMode(m); return { ok: true, mode: m }; }
      case 'solar_system_focus': return app.agentSystemFocus(args.body);
      case 'solar_system_info': return app.agentSystemInfo(args.body);
      case 'solar_system_time': return app.agentSystemTime(args);
      case 'focus': return app.agentFocus(args.name);
      case 'set_layer': return app.agentSetLayer(args.layer, args.on);
      case 'get_state': return app.agentState();
      case 'list_trade_routes': {
        let list = app.tradeRouteList();
        if (args.category) list = list.filter((r) => r.category === args.category);
        if (args.query) { const q = String(args.query).toLowerCase(); list = list.filter((r) => (`${r.name} ${r.kind} ${r.operator} ${r.lore}`).toLowerCase().includes(q)); }
        return { count: list.length, routes: list.map((r) => ({ id: r.id, name: r.name, category: r.category, kind: r.kind, operator: r.operator, driveClass: r.driveClass, traffic: r.traffic, lore: r.lore, stops: r.stops })) };
      }
      case 'load_trade_route': { const r = matchRoute(app, args.id_or_name); return r ? app.loadTradeRoute(r.id) : { ok: false, error: `no charted route matching "${args.id_or_name}"` }; }
      case 'show_trade_route': { const r = matchRoute(app, args.id_or_name); if (!r) return { ok: false, error: `no charted route matching "${args.id_or_name}"` }; app.highlightTradeRoute(r.id); return { ok: true, showing: r.name, stops: r.stops }; }
      default: return { ok: false, error: `unknown tool "${name}"` };
    }
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}
