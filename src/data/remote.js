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

import { comovingMpc, MPC_TO_LY } from '../util/cosmology.js';

let PROXY = '';
export function setProxy(base) { PROXY = base || ''; }

const EXO_TAP = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';
const SIMBAD_TAP = 'https://simbad.cds.unistra.fr/simbad/sim-tap/sync';

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

// ---- SIMBAD live name resolver (CDS) — resolves a real object by name and returns
// its coordinates, type, spectral type and a distance derived from parallax or
// redshift. SIMBAD's TAP service is CORS-enabled, so this works from the browser. ----
export async function resolveSimbad(name) {
  const q = String(name || '').trim();
  if (!q) return { ok: false, note: 'enter an object name' };
  const adql =
    'SELECT TOP 1 b.main_id, b.ra, b.dec, b.otype_txt, b.sp_type, b.plx_value, b.rvz_redshift ' +
    "FROM basic AS b JOIN ident AS i ON b.oid = i.oidref WHERE i.id = '" + q.replace(/'/g, "''") + "'";
  const u = `${SIMBAD_TAP}?request=doQuery&lang=adql&format=json&query=${encodeURIComponent(adql)}`;
  const to = timeout(9000);
  try {
    const res = await fetch(withProxy(u), { signal: to.signal });
    to.done();
    if (!res.ok) return { ok: false, note: `SIMBAD HTTP ${res.status}` };
    const j = await res.json();
    const row = j.data && j.data[0];
    if (!row) return { ok: false, note: `“${q}” not found in SIMBAD` };
    const [mainId, ra, dec, otype, spType, plx, z] = row;
    let distLy = null, distNote = 'unknown';
    if (plx && plx > 0) { distLy = (1000 / plx) * 3.2615638; distNote = `parallax ${plx.toFixed(2)} mas`; }
    else if (z && z > 0) { distLy = comovingMpc(z) * MPC_TO_LY; distNote = `redshift z=${z}`; }
    return {
      ok: true, source: 'SIMBAD',
      object: {
        name: mainId ? mainId.replace(/\s+/g, ' ').trim() : q,
        query: q, ra: ra / 15, dec, otype: otype || '', spType: spType || '',
        distLy, distNote, category: categoryFromOtype(otype),
      },
    };
  } catch (e) {
    to.done();
    const blocked = e.name === 'AbortError' || e.name === 'TypeError';
    return { ok: false, note: blocked ? 'live query blocked / timed out (network or CORS)' : String(e.message || e) };
  }
}

const VIZIER_TAP = 'https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync';
const KPC_TO_LY = 3261.5638;

async function tapJson(base, query, lang = 'adql') {
  const u = `${base}?request=doQuery&lang=${lang}&format=json&query=${encodeURIComponent(query)}`;
  const to = timeout(15000);
  try {
    const res = await fetch(withProxy(u), { signal: to.signal });
    to.done();
    if (!res.ok) return { ok: false, note: `service HTTP ${res.status}` };
    const j = await res.json();
    return { ok: true, rows: j.data || [], cols: (j.metadata || []).map((m) => m.name) };
  } catch (e) {
    to.done();
    const blocked = e.name === 'AbortError' || e.name === 'TypeError';
    return { ok: false, note: blocked ? 'live query blocked / timed out (network or CORS)' : String(e.message || e) };
  }
}

// Grow the object database from a live catalogue. Returns real objects with a
// usable distance so they can be placed on the 3-D map.
//   preset: 'pulsars' | 'galaxies' | 'quasars' | 'nearby'
export async function growFromCatalogue(preset, { count = 200, ra = 0, dec = 0, radiusDeg = 10 } = {}) {
  const n = Math.max(1, Math.min(1000, count | 0));
  if (preset === 'pulsars') {
    const r = await tapJson(VIZIER_TAP, `SELECT TOP ${n} Name, RAJ2000, DEJ2000, Dist FROM "B/psr/psr" WHERE Dist>0`);
    if (!r.ok) return r;
    return { ok: true, source: 'ATNF Pulsar Catalogue (VizieR)', objects: r.rows.map(([name, ra2, dec2, dist]) => ({
      name: 'PSR ' + name, ra: ra2 / 15, dec: dec2, distLy: dist * KPC_TO_LY, category: 'pulsar', type: 'pulsar',
    })).filter((o) => Number.isFinite(o.distLy) && o.distLy > 0) };
  }
  if (preset === 'galaxies' || preset === 'quasars') {
    const isQ = preset === 'quasars';
    const cond = isQ ? "otype='QSO' AND rvz_redshift BETWEEN 0.1 AND 5" : "otype='G..' AND rvz_redshift BETWEEN 0.002 AND 0.08";
    const r = await tapJson(SIMBAD_TAP, `SELECT TOP ${n} main_id, ra, dec, otype_txt, rvz_redshift FROM basic WHERE ${cond}`);
    if (!r.ok) return r;
    return { ok: true, source: 'SIMBAD (CDS)', objects: r.rows.map(([id, ra2, dec2, ot, z]) => ({
      name: (id || '').replace(/\s+/g, ' ').trim(), ra: ra2 / 15, dec: dec2, distLy: comovingMpc(z) * MPC_TO_LY,
      category: isQ ? 'quasar' : 'galaxy', type: ot || (isQ ? 'quasar' : 'galaxy'),
    })).filter((o) => o.name && o.distLy > 0) };
  }
  if (preset === 'nearby') {
    const r = await tapJson(SIMBAD_TAP,
      `SELECT TOP ${n} main_id, ra, dec, otype_txt, plx_value, rvz_redshift FROM basic ` +
      `WHERE CONTAINS(POINT('ICRS',ra,dec), CIRCLE('ICRS',${(ra * 15).toFixed(4)},${dec.toFixed(4)},${radiusDeg}))=1 ` +
      `AND (plx_value>0 OR rvz_redshift>0)`);
    if (!r.ok) return r;
    return { ok: true, source: 'SIMBAD (CDS) · cone search', objects: r.rows.map(([id, ra2, dec2, ot, plx, z]) => {
      const distLy = plx > 0 ? (1000 / plx) * 3.2615638 : comovingMpc(z) * MPC_TO_LY;
      return { name: (id || '').replace(/\s+/g, ' ').trim(), ra: ra2 / 15, dec: dec2, distLy, category: categoryFromOtype(ot), type: ot || 'object' };
    }).filter((o) => o.name && o.distLy > 0) };
  }
  return { ok: false, note: 'unknown catalogue preset' };
}

// Best-effort mapping from SIMBAD object types to our atlas categories.
function categoryFromOtype(ot) {
  const o = (ot || '').toLowerCase();
  if (/qso|blazar|bl lac|seyfert|agn|liner/.test(o)) return 'quasar';
  if (/galaxy|galaxies/.test(o)) return 'galaxy';
  if (/pulsar|neutron/.test(o)) return 'pulsar';
  if (/supernova remnant|snr/.test(o)) return 'supernova';
  if (/supernova/.test(o)) return 'transient';
  if (/nebula|hii|planetary|molecular cloud|h2/.test(o)) return 'nebula';
  if (/black hole/.test(o)) return 'smbh';
  if (/cluster of galaxies/.test(o)) return 'quasar';
  if (/cluster|association/.test(o)) return 'nebula';
  if (/supergiant|hypergiant|wolf|variable|emission-line star/.test(o)) return 'hyperstar';
  return 'galaxy';
}
