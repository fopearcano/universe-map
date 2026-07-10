// Dynamic data retrieval (experimental).
//
// The base map ships as a static, preprocessed catalogue so it always works
// offline. On top of that we can *optionally* pull live data for a selected star
// from public astronomy services. The catch is browser CORS: several archives do
// not send Access-Control-Allow-Origin, so a direct fetch from a static site may
// be blocked. This module attempts the query, times out gracefully, and reports
// exactly what happened so the UI can stay honest.
//
// Public services this could draw on (documented for future expansion):
//   • NASA Exoplanet Archive  — TAP/ADQL, https://exoplanetarchive.ipac.caltech.edu/TAP
//   • SIMBAD (CDS)            — TAP, http://simbad.cds.unistra.fr/simbad/sim-tap
//   • Gaia archive (ESA)      — TAP/ADQL, https://gea.esac.esa.int/tap-server/tap
//   • VizieR (CDS)            — TAP over thousands of catalogues
//
// To make live queries reliable behind CORS, point PROXY at a tiny pass-through
// (e.g. a serverless function that adds CORS headers): remote.setProxy(url).

let PROXY = '';
export function setProxy(base) { PROXY = base || ''; }

const EXO_TAP = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';

const withProxy = (u) => (PROXY ? PROXY.replace(/\/$/, '') + '/' + encodeURIComponent(u) : u);

function timeout(ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
}

// Candidate hostnames the exoplanet archive might use for a given star record.
function hostCandidates(star) {
  const set = new Set();
  if (star.name && !/^(HIP|HD|Star)/.test(star.name)) set.add(star.name);
  if (star.hd) set.add('HD ' + star.hd);
  if (star.hip) set.add('HIP ' + star.hip);
  if (star.gl) set.add(star.gl.replace(/^Gl\s*/, 'GJ '));
  // common short forms
  if (star.name === 'Proxima Centauri') set.add('Proxima Cen');
  if (star.name === 'Rigil Kentaurus') set.add('alf Cen A');
  return [...set];
}

// Query the NASA Exoplanet Archive for planets orbiting this star.
export async function fetchExoplanets(star) {
  const hosts = hostCandidates(star);
  if (!hosts.length) return { ok: false, note: 'no queryable designation' };
  const inList = hosts.map((h) => `'${h.replace(/'/g, "''")}'`).join(',');
  const adql =
    'select pl_name,hostname,pl_orbper,pl_rade,pl_bmasse,pl_eqt,discoverymethod,disc_year ' +
    `from pscomppars where hostname in (${inList})`;
  const u = `${EXO_TAP}?request=doQuery&lang=ADQL&format=json&query=${encodeURIComponent(adql)}`;
  const to = timeout(9000);
  try {
    const res = await fetch(withProxy(u), { signal: to.signal });
    to.done();
    if (!res.ok) return { ok: false, note: `service HTTP ${res.status}` };
    const rows = await res.json();
    return {
      ok: true,
      source: 'NASA Exoplanet Archive',
      planets: (rows || []).map((r) => ({
        name: r.pl_name,
        period: r.pl_orbper,
        radius: r.pl_rade,
        mass: r.pl_bmasse,
        eqt: r.pl_eqt,
        method: r.discoverymethod,
        year: r.disc_year,
      })),
    };
  } catch (e) {
    to.done();
    const blocked = e.name === 'AbortError' || e.name === 'TypeError';
    return {
      ok: false,
      note: blocked
        ? 'live query blocked by CORS / timed out — configure a proxy to enable'
        : String(e.message || e),
    };
  }
}
