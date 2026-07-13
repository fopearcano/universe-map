// One-shot knowledge-base update: brings the QTR "Immeasurable Spaces" universe DB
// up to the map's current canon. Adds (a) the travel-time / "story-time" model the
// NAVCOM now flies (coordinate vs crew time, the per-rung offset), the Tekné vessel
// and its Solaris.Ai core, and the selectable drive ladder; and (b) a hub for the
// Pelagic language system so the seven tongues browse as one family. Idempotent:
// re-running replaces the same ids and recomputes counts, keeping dangling_links 0.
import { readFileSync, writeFileSync } from 'node:fs';

const PATH = new URL('../public/data/qtr-universe-db.json', import.meta.url);
const db = JSON.parse(readFileSync(PATH, 'utf8'));

const L = (target, rel = 'related') => ({ rel, target, resolved: true });
const SRC_NAV = 'universe-map · Tekné NAVCOM';
const SRC_LANG = 'qtr-language-codex.html';

// ---- new entities ---------------------------------------------------------
const NEW = [
  // (a) travel-time / pacing model ----------------------------------------
  {
    id: 'term-mission-clock', type: 'concept', kb_group: 'ships',
    name: 'Coordinate time vs crew time (the mission clock)', jp: '座標時と固有時',
    summary:
      "Every crossing is read on two clocks. Coordinate (home-frame) time is the distance divided by the drive's crossing speed — what the origin and destination measure. Crew (proper) transit is what the travellers live in flight — for a sub-light Class 0 run the real Lorentz dilation √(1−β²), so the crew badly outlive the mission clock; for an Idrenes-bridge crossing a determinate-regime fraction of coordinate time (the offset), which each deeper OCT rung compresses further. But a voyage is never instant even when its transit is: threading the seam, opening and riding each bridge, the long approach and port cycles add an irreducible overhead — roughly a couple of months per crossing on the civilized bridge, shaved toward days or hours only by the hottest, deepest drives. So the lived 'story time' the NAVCOM reads out is months for a bridge voyage, days for an Unruh run, hours for a Tekné dash, and true centuries for a sub-light crawl.",
    attributes: [
      { k: 'Coordinate time', v: 'distance ÷ crossing speed (home frame)' },
      { k: 'Crew transit · sub-light', v: 'coordinate time × √(1−β²) — real dilation' },
      { k: 'Crew transit · bridge', v: 'coordinate time × offset (deeper rung ⇒ smaller)' },
      { k: 'Offset by rung', v: 'Idrenes–Sōrn 0.35 · Unruh 0.10 · Squeezing 0.02 · Tekné 0.002' },
      { k: 'Voyage overhead', v: '~months/crossing on a bridge; days on Unruh, hours on Tekné' },
    ],
    links: [L('term-ship-relative-speed-law'), L('term-the-dive'), L('term-ship-classes-0'), L('tech-idrenes-bridge'), L('term-navcom-drive-ladder')],
    sources: [SRC_NAV],
  },
  {
    id: 'term-navcom-drive-ladder', type: 'concept', kb_group: 'ships',
    name: 'The Tekné NAVCOM drive ladder', jp: '航法駆動段',
    summary:
      "The selectable rungs on the Ship-Relative Speed Law as flown from the NAVCOM console, each a deeper dive into the vacuum: Casimir Sailer (0.1c, the most human ship — sail and helm, no crossing) → Relativistic run (0.994c, real dilation) → Idrenes–Sōrn OCT-0 (~10¹⁰c, the civilized intra-universe standard) → Unruh Catamaran (~10¹³c) → Squeezing Bathyscaphe (~10¹⁶c, the Undertow debt bites) → Idrenes Composite ·Tekné (~10²⁰c, Class ω). Each rung down crosses faster and lives the journey in less crew time; a ship's class is the deepest rung it can hold.",
    attributes: [
      { k: 'Class 0 · Crawler', v: 'Casimir Sailer 0.1c · Relativistic run 0.994c (sub-light)' },
      { k: 'Class I · Bridge-runner', v: 'Idrenes–Sōrn OCT-0 ≈10¹⁰c · the civilized standard' },
      { k: 'Class II · Wanderer', v: 'Unruh Catamaran ≈10¹³c · inter-universe' },
      { k: 'Class III · Sovereign', v: 'Squeezing Bathyscaphe ≈10¹⁶c · inter-pocket' },
      { k: 'Class ω · Formless', v: 'Idrenes Composite ·Tekné ≈10²⁰c' },
    ],
    links: [L('term-ship-relative-speed-law'), L('term-ship-classes-0'), L('ship-class-casimir'), L('ship-class-unruh'), L('ship-class-squeeze'), L('ship-class-idrenes'), L('tech-sorn-drive'), L('tech-idrenes-bridge'), L('ship-tekne'), L('term-mission-clock')],
    sources: [SRC_NAV],
  },
  {
    id: 'ship-tekne', type: 'ship', kb_group: 'ships',
    name: 'Tekné (Idrenes Composite)', jp: 'テクネー',
    role: "the NAVCOM's own hull",
    summary:
      "The Class-ω vessel the console flies: a reconfigurable Idrenes Composite hull that becomes Casimir sail, Unruh catamaran, squeezing cavity and Penrose anchor in sequence, opening a bridge with no supporting flotilla. Coordinated by a Solaris.Ai core, it is the only navigator that holds the deepest rungs (~10²⁰c) — living a whole-universe crossing in hours-to-moments where a bridge-runner lives it in months-to-years.",
    links: [L('ship-class-idrenes'), L('term-ship-classes-0'), L('term-navcom-drive-ladder'), L('tech-idrenes-bridge'), L('tech-solaris-ai')],
    sources: [SRC_NAV],
  },
  {
    id: 'tech-solaris-ai', type: 'technology', kb_group: 'ships',
    name: 'Solaris.Ai', jp: 'ソラリス・エーアイ',
    summary:
      "The reasoning core that coordinates an Idrenes Composite through a crossing — sequencing sail, hull, cavity and anchor fast enough to hold a bridge open unaided. Aboard Tekné it is also the ship's navigator and interlocutor: it plots courses, picks the drive rung, and answers for the canon at the helm.",
    links: [L('ship-tekne'), L('ship-class-idrenes'), L('tech-sorn-drive')],
    sources: [SRC_NAV],
  },
  // (b) language system ----------------------------------------------------
  {
    id: 'term-pelagic-family', type: 'concept', kb_group: 'language',
    name: 'The Pelagic language family (the QTR language system)', jp: 'ペラジック語族',
    summary:
      "One proto-language, seven descendants. Old Pelagic — spoken before the seam, now frozen as Assembly liturgy — split through seven regular sound changes into two fleet daughters and three surface sisters, while the Wolori kept a working register. What sets the family apart from any pre-seam tongue is that crossing is grammaticalized: the daughters carry veridical moods (how a truth is held), temporal anchors (which frame's clock times a claim), depth directionals (up/down the OCT tower) and the gap-particle ne for the unbridged elsewhere. Each tongue is known by its shibboleth for 'truth/yes'.",
    attributes: [
      { k: 'Proto', v: 'Old Pelagic — pre-seam, liturgical' },
      { k: 'Fleet daughters', v: 'Sūchel (crossers) · Nubhel (divers)' },
      { k: 'Scientific register', v: 'Lorkel (the Wolori)' },
      { k: 'Surface sisters', v: 'Rudgar (Mars) · Sel (Maren) · Beltsel (Belgar)' },
      { k: 'Seam grammar', v: 'veridical moods · temporal anchors · depth directionals · gap-particle ne' },
      { k: "Shibboleth · 'truth'", v: 'jel · yel · gel · ghel · zel · dzel' },
    ],
    links: [L('lang-old-pelagic'), L('lang-suchel'), L('lang-nubhel'), L('lang-lorkel'), L('lang-rudgar'), L('lang-sel'), L('lang-beltsel'), L('term-grammaticalized-seam'), L('term-the-seam'), L('faction-sili'), L('faction-nubi'), L('faction-irrationals')],
    sources: [SRC_LANG],
  },
  {
    id: 'term-grammaticalized-seam', type: 'concept', kb_group: 'language',
    name: 'Grammaticalizing the seam', jp: '継ぎ目の文法化',
    summary:
      "How the crossing entered grammar. In the fleet tongues you cannot make a bare claim: every finite verb takes a veridical mood marking how its truth is held (seen, reported, inferred, bridged, or the seam-truth T•), a temporal anchor fixing which frame's clock times it (home, crew, or beacon), and — for motion — a depth directional up or down the OCT rungs. The gap-particle ne marks a referent on the far side of an unopened bridge. Nubhel lacks the seam-truth mood T•, so a Nūbi diver must code-switch into Sūchel to assert it — a fault-line the crosser fleet never lets them forget.",
    attributes: [
      { k: 'Veridical moods', v: 'seen · reported · inferred · bridged · seam-truth T•' },
      { k: 'Temporal anchors', v: 'home · crew · beacon frame' },
      { k: 'Depth directionals', v: 'up / down the OCT tower' },
      { k: 'Gap-particle', v: 'ne — a referent across an unopened bridge' },
    ],
    links: [L('term-the-seam'), L('lang-suchel'), L('lang-nubhel'), L('term-pelagic-family'), L('tech-idrenes-bridge')],
    sources: [SRC_LANG],
  },
];

// ---- apply: replace-or-append, then wire reciprocal links -----------------
const byId = new Map(db.entities.map((e) => [e.id, e]));
for (const e of NEW) {
  const i = db.entities.findIndex((x) => x.id === e.id);
  if (i >= 0) db.entities[i] = e; else db.entities.push(e);
  byId.set(e.id, e);
}

// Make the family a hub: every language points back at the overview; and the two
// canonical anchors point at the new pacing concepts. Add each link at most once.
const addLink = (id, target, rel = 'related') => {
  const e = byId.get(id); if (!e) return;
  e.links ||= [];
  if (!e.links.some((l) => l.target === target && l.rel === rel)) e.links.push(L(target, rel));
};
for (const lid of ['lang-old-pelagic', 'lang-suchel', 'lang-nubhel', 'lang-lorkel', 'lang-rudgar', 'lang-sel', 'lang-beltsel']) addLink(lid, 'term-pelagic-family');
addLink('term-ship-relative-speed-law', 'term-mission-clock');
addLink('term-ship-classes-0', 'term-navcom-drive-ladder');
addLink('tech-sorn-drive', 'term-navcom-drive-ladder');
addLink('tech-idrenes-bridge', 'term-mission-clock');

// ---- recompute meta counts + integrity ------------------------------------
const allRecords = [...db.entities, ...(db.events || [])];
const ids = new Set(allRecords.map((r) => r.id));
let totalLinks = 0, dangling = 0;
for (const r of allRecords) for (const l of (r.links || [])) { totalLinks++; if (!ids.has(l.target)) dangling++; }

const byType = {};
for (const e of db.entities) byType[e.type] = (byType[e.type] || 0) + 1;

db.meta.version = '2.1';
db.meta.generated = '2026-07-13';
db.meta.counts.entities = String(db.entities.length);
db.meta.counts.by_type = Object.fromEntries(Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, String(v)]));
db.meta.counts.total_kb_links = String(totalLinks);
db.meta.counts.dangling_links = String(dangling);
if (!db.meta.sources.includes(SRC_NAV)) db.meta.sources.push(SRC_NAV);

writeFileSync(PATH, JSON.stringify(db, null, 2) + '\n');
console.log(`entities: ${db.entities.length}  total_kb_links: ${totalLinks}  dangling: ${dangling}`);
console.log('by_type:', JSON.stringify(db.meta.counts.by_type));
if (dangling !== 0) { console.error('DANGLING LINKS — aborting review'); process.exit(1); }
