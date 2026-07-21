// Knowledge-base update v3 — sync the QTR "Immeasurable Spaces" universe DB to the
// consolidated qtr-v2 canon (SYSTEM.md, the single authoritative assembly of the
// fifteen codices). Two kinds of change, both idempotent (re-running replaces the
// same ids and recomputes counts, keeping dangling_links 0):
//   (1) REFRAMES — the tower is now the ONE universe's state-depths, not a
//       multiverse: "Omniverse Cantor Tower" → "Ontological Cantor Tower", and
//       PIIU is "Physics of Intra-Universe Infinities".
//   (2) ADDITIONS — the formalized four-layer stack, the Reconciliation Ledger and
//       its machinery, the third time-sensation, and the expanded deep-time
//       framework (cosmological substrate, the six fates, the projected species
//       spectrum, the hybrid stochastic model, the Φ ladder) + the six ship
//       archetypes with the post-audit correction.
import { readFileSync, writeFileSync } from 'node:fs';

const PATH = new URL('../public/data/qtr-universe-db.json', import.meta.url);
const db = JSON.parse(readFileSync(PATH, 'utf8'));

const L = (target, rel = 'related') => ({ rel, target, resolved: true });
const SRC = 'qtr-v2 · SYSTEM.md';

// ---- (1) reframes to the "one universe" canon -----------------------------
const PATCH = {
  'term-omniverse-cantor-tower-oct': {
    name: 'Ontological Cantor Tower (OCT)',
    summary:
      "The transfinite hierarchy that nests the endless state-depths of ONE universe, ranked by the mutual information between levels — not a stack of separate universes. Each deeper level carries a smaller effective Planck length (finer substrate granularity), and a ship that can reach it travels exponentially faster: speed, in QTR, is depth. Its tiers — OCT-0 effective surface, OCT-1 deep-vacuum coherence, OCT-2 cosmological reach, OCT-ω the first transfinite level (the Formless), topped by OCT-Ω, the fixed point of the universe's own self-description (the theory's Gödel sentence) — are the same ladder the ship classes and the Field tiers climb.",
    _addLinks: ['term-four-layer-stack', 'ship-class-idrenes'],
  },
  'term-piiu-physics-of-infinite-infinity-universes': {
    name: 'PIIU — Physics of Intra-Universe Infinities',
    summary:
      "Layer 3 of the QTR stack: the physics of the endless state-depths WITHIN one universe (formerly read as a multiverse). Those depths nest in the Ontological Cantor Tower, ordered by mutual information; a ship's speed is set by how deep into the tower it can reach, not by leaving the universe. PIIU cannot describe the tower's fixed point OCT-Ω from within any finite or ω-level description — its own incompleteness.",
    _addLinks: ['term-four-layer-stack'],
  },
};

// ---- (1b) text corrections — scrub the old multiverse framing from entity
//          summaries/readings and the adjacency layer (overwrite whole fields) ---
const TEXT_PATCH = {
  'term-oct-the-top': {
    summary: "The Top — the fixed point of the entire hierarchy: the fixed point of the one universe's own self-description. Acknowledged but never crossed, and no destination; PIIU cannot describe it from within any finite or ω-level description. It is the theory's own Gödel sentence.",
  },
  'recon-multiverse': {
    summary: "A T⁺ approach to the Ontological Cantor Tower with its structure removed: the model guesses an ensemble of separate universes but gives them no hierarchy, no mutual information, no depth. What it was groping toward is the OCT — the state-depths of ONE universe, nested by mutual information into a transfinite tower with a definite depth ordering.",
    reframe_long: "The inflationary multiverse reaches toward the right structure but flattens it into a bag of disconnected bubbles, which is why it resists testability. QTR's PIIU layer supplies the order it omits — re-read for the one-universe canon: the Ontological Cantor Tower ranks the STATE-DEPTHS of a single universe by mutual information, gives each level a smaller effective Planck length, and makes 'which region' a question of depth, not of leaving the universe. Whether anything lies beyond the universe's own self-description stays an open question, never a charted destination. The multiverse is a T⁺ approach to the tower — reaching toward it from below, blind to the levels.",
    got_right: "That the observable cosmos may not exhaust reality — a genuine open question QTR keeps open — and that effective constants can differ across depths and scales.",
    mistook: "That this implies an already-enumerable, navigable ensemble of OTHER universes with unrelated laws. What the model was groping toward is the OCT: the missing order — the state-depths of one universe nested by mutual information into a transfinite tower with a definite depth ordering.",
  },
  'era-eonic-age': {
    summary: "The eonic rung of the era ladder (evolution level 6), over roughly a hundred billion years: an intergalactic network, cosmological-scale cognition, universal self-referential consciousness, migration between conformal aeons (the aeonic edge), and cosmological engineering. At Kardashev energy K≈4–5 and Field mastery Φ₅ it reaches the Κ-crossing / transmutation at the curvature limit — the conformal crossover to the next aeon of this universe, where substance may not cross but pattern can.",
  },
  'time-indeterminate-timeline': {
    summary: "The regime governing seam- and adjacency-travel between regions of the one universe that share no frame. Cross the seam 𝔍, or take a Penrose bridge to a causally-remote region, and there is no fact about how much time passed 'meanwhile' back home. Reunion is not measurement but renegotiation, and the ambiguity is permanent — the relationship must be rebuilt because the arithmetic that would settle it does not exist. Its drama is desynchronisation, and its wound is permanent.",
  },
  'hazard-shear': {
    summary: "Where two vacuum regions of different character meet and tear. The visual of a seam — the same rolling curl you use for the Dead Sea escape, and a preview of the ultimate crossing at the curvature limit Κ.",
  },
};
const LAYER_PATCH = {
  adjacency: { desc: 'Penrose-bridge transits to causally-remote regions of the same universe (same depth).' },
};

// ---- (2) new entities ------------------------------------------------------
const NEW = [
  // — the top-level framing ————————————————————————————————
  {
    id: 'term-four-layer-stack', type: 'concept', kb_group: 'substrate',
    name: 'The four-layer stack', jp: '四層構造',
    summary:
      "QTR is one system built as four nested frameworks, each strictly more general than the one below. Layer 1 · Substrate — QTR itself, relational quantum events under postulates P1–P4 (what the universe is made of). Layer 2 · Logic — ΛL, the five-valued logic (how to reason at, across and beyond a limit). Layer 3 · Tower — PIIU / the Ontological Cantor Tower (how deep the state-depths of one universe run). Layer 4 · Navigation — NAV (what a pilot actually does). The whole archive is issued by the Pelagian Assembly under the seam rule: everything down to the seam 𝔍 rests on established physics; the seam is where rigorous physics ends and invented physics begins.",
    attributes: [
      { k: 'Layer 1 · Substrate', v: 'QTR — relational quantum events · P1–P4' },
      { k: 'Layer 2 · Logic', v: 'ΛL — the five-valued logic of the limit' },
      { k: 'Layer 3 · Tower', v: 'PIIU / OCT — state-depths of one universe' },
      { k: 'Layer 4 · Navigation', v: 'NAV — sailing the structured vacuum' },
      { k: 'Honesty', v: 'the seam rule — measured to 𝔍, invented beyond it' },
    ],
    links: [L('term-relational-quantum-event-rqe'), L('term-l-the-logic-of-the-limit'), L('term-piiu-physics-of-infinite-infinity-universes'), L('term-omniverse-cantor-tower-oct'), L('term-the-seam'), L('faction-pelagian-assembly')],
    sources: [SRC],
  },

  // — the Reconciliation machinery ————————————————————————————
  {
    id: 'term-reconciliation-ledger', type: 'concept', kb_group: 'substrate',
    name: 'The Reconciliation Ledger', jp: '和解の台帳',
    summary:
      "QTR's doctrine (Rev 1.0, kept by the Pelagian Assembly) for settling accounts with the physics that came before it: the seventeen classical cosmological models re-derived from the substrate, each assigned a depth of validity in the OCT tower and a truth-value in ΛL. Its motto — 'the models were not wrong, they were shallow': each read the effective layer faithfully, then mistook it for the floor of reality. QTR keeps what they measured, dissolves what they reified. Each record carries a fixed anatomy: classic reading · got right · mistook · how QTR re-derives it · verdict · ΛL value · valid depth · substrate cause. QTR ⊃ ΛCDM · MOND · CCC — it contains its predecessors as effective limits.",
    attributes: [
      { k: 'Motto', v: 'the models were not wrong — they were shallow' },
      { k: 'Scope', v: '17 models · 5 families · 5 verdicts · 5 ΛL values · 5 depth bands' },
      { k: 'Record anatomy', v: 'reading · got-right · mistook · re-derivation · verdict · ΛL · depth · cause' },
      { k: 'Containment', v: 'QTR ⊃ ΛCDM · MOND · CCC' },
      { k: 'Keeper', v: 'the Pelagian Assembly' },
    ],
    links: [L('term-three-inversions'), L('term-five-verdicts'), L('term-five-families'), L('term-methodical-realism'), L('term-l-the-logic-of-the-limit'), L('term-omniverse-cantor-tower-oct'), L('recon-cdm'), L('recon-mond-teves'), L('recon-conformal-cyclic-cosmology')],
    sources: [SRC],
  },
  {
    id: 'term-three-inversions', type: 'concept', kb_group: 'substrate',
    name: 'The three inversions', jp: '三つの転倒',
    summary:
      "The three bedrock assumptions QTR moves under classical cosmology's feet before any model is reconciled. 01 · Spacetime is not a stage but a residue — emergent from a partial order of relational quantum events; curvature and expansion are coarse statistics of event density, real but not bottom. 02 · The Beginning is not an origin but a chart edge — the Big Bang is the IR boundary of one universe's chart, a T⁻ left-approach to a seam, so 'before' is a category error. 03 · The Constants are not universal but depth-effective — c, Λ and the couplings run and re-emerge across OCT depths, never a new universe with unrelated laws.",
    attributes: [
      { k: '01 · Spacetime', v: 'fundamental → emergent residue of event order' },
      { k: '02 · The Beginning', v: 'origin → IR chart-edge (a T⁻ approach)' },
      { k: '03 · The Constants', v: 'universal → depth-effective (run across OCT)' },
    ],
    links: [L('term-reconciliation-ledger'), L('term-relational-quantum-event-rqe'), L('term-ir-boundary'), L('term-t-seam-truth')],
    sources: [SRC],
  },
  {
    id: 'term-five-verdicts', type: 'concept', kb_group: 'substrate',
    name: 'The five verdicts', jp: '五つの評定',
    summary:
      "A reconciled model's verdict names HOW it relates to the seam, not how good it is. Absorbed — recovered intact as the correct effective description in its regime. Reinterpreted — the measurement stands; its cause is re-read at the substrate level. Recovered as limit — a valid limiting case of QTR under a coarse-graining. Seam-blind — reaches for the deep structure but cannot see the seam it gropes toward. Superseded — its posited mechanism dissolves; only the anomaly it noticed survives. Each pairs with a ΛL value (T · T⁻ · T• · T⁺ · F) and a depth band, and the two always agree via the Noether correspondence.",
    attributes: [
      { k: 'Absorbed', v: 'correct effective description, kept intact' },
      { k: 'Reinterpreted', v: 'measurement stands, cause re-read at substrate' },
      { k: 'Recovered as limit', v: 'a valid coarse-grained limit of QTR' },
      { k: 'Seam-blind', v: 'gropes toward the seam without seeing it' },
      { k: 'Superseded', v: 'mechanism dissolved; only the anomaly survives' },
    ],
    links: [L('term-reconciliation-ledger'), L('term-l-the-logic-of-the-limit'), L('term-noether-correspondence'), L('term-the-seam')],
    sources: [SRC],
  },
  {
    id: 'term-five-families', type: 'concept', kb_group: 'substrate',
    name: 'The five theoretical families', jp: '五つの理論族',
    summary:
      "The seventeen reconciled models group into five families. 01 · The standard model — the consensus effective theory, recovered exactly at the OCT-0 surface. 02 · ΛCDM extensions — dynamics added to the dark sector, read as partial glimpses of substrate structure through field language. 03 · Modified gravity — models that already suspected spacetime wasn't fundamental (closest to QTR in spirit, furthest in mechanism). 04 · Origin & structure — theories of the beginning, reframed as chart edges, level transitions and seam-approaches. 05 · Heterodox & historical — alternatives that guessed at inhomogeneity, relative time or eternity, sometimes stumbling onto real substrate features.",
    attributes: [
      { k: '01', v: 'The standard model — exact at OCT-0' },
      { k: '02', v: 'ΛCDM extensions — dark-sector dynamics as substrate glimpses' },
      { k: '03', v: 'Modified gravity — suspected spacetime non-fundamental' },
      { k: '04', v: 'Origin & structure — beginnings as chart edges' },
      { k: '05', v: 'Heterodox & historical — guesses at real features' },
    ],
    links: [L('term-reconciliation-ledger'), L('recon-cdm'), L('recon-mond-teves'), L('recon-conformal-cyclic-cosmology')],
    sources: [SRC],
  },
  {
    id: 'term-methodical-realism', type: 'concept', kb_group: 'substrate',
    name: 'Methodical realism up to the seam', jp: '継ぎ目までの方法的実在論',
    summary:
      "The Reconciliation's posture and thesis. It is deliberately not a demolition: read against the honest-boundary rule (everything down to the seam rests on measurement; the seam is where rigorous physics ends), the seventeen models sort into four movements — the surface was read correctly (Absorbed / Recovered), the dynamics were shadows of the postulates (Reinterpreted), the deep guesses reached for the seam (Seam-blind; CCC came closest, one map short of ΛL's T•), and two models die but one verb survives (Superseded). The whole doctrine reduces to one line: every pre-QTR cosmology was true at the surface and blind at the seam — correct effective statistics of relational quantum events in one universe, mistaken for the floor of reality.",
    attributes: [
      { k: 'Movement 1', v: 'the surface was read correctly (Absorbed)' },
      { k: 'Movement 2', v: 'dynamics were shadows of P1–P4 (Reinterpreted)' },
      { k: 'Movement 3', v: 'deep guesses reached for the seam (Seam-blind)' },
      { k: 'Movement 4', v: 'two models die, one verb survives (Superseded)' },
      { k: 'One line', v: 'true at the surface, blind at the seam' },
    ],
    links: [L('term-reconciliation-ledger'), L('term-five-verdicts'), L('term-the-seam'), L('term-t-seam-truth'), L('recon-conformal-cyclic-cosmology')],
    sources: [SRC],
  },

  // — the third time-sensation ————————————————————————————————
  {
    id: 'time-surfacing-thinness', type: 'concept', kb_group: 'time',
    name: 'Surfacing-thinness', jp: '浮上の希薄',
    summary:
      "The third felt-sensation of time — the specific loneliness of RETURN, kept distinct from dive-vertigo because it is a different wound. Coming home from the deep, everything is too slow — the light lazy, the station's hum unhurried — and the returned diver, still running fast from below, sits in it 'like a hummingbird in a room of sleeping people, quick and wrong and alone with her quickness.' It passes as her rate and the world's find each other again over a few beacon-cycles, but in the thin cold minutes there is no shared 'now' to stand in with the people she loves. Vertigo is the shear DURING descent; thinness is the relational loneliness AFTER return. A full sequence runs dive-vertigo → (a seam-gap if she crosses while deep) → surfacing-thinness.",
    attributes: [
      { k: 'Register', v: 'the loneliness of return' },
      { k: 'Vs dive-vertigo', v: 'shear during descent vs thinness after return' },
      { k: 'Signature', v: 'no shared "now" until the rates re-sync' },
      { k: 'Sequence', v: 'dive-vertigo → seam-gap? → surfacing-thinness' },
    ],
    links: [L('time-running-under'), L('time-seam-gap'), L('time-three-clocks'), L('time-becoming-time'), L('time-reference-beacons')],
    sources: [SRC, 'time-sensations-prose.md'],
  },

  // — the expanded deep-time framework ————————————————————————
  {
    id: 'dt-cosmic-substrate', type: 'concept', kb_group: 'deeptime',
    name: 'The cosmological substrate (energy ceiling)', jp: '宇宙論的基層',
    summary:
      "Deep-time civilization is bounded by a falling ceiling of free energy. Availability rises as stars ignite, peaks (1.0) through the Stelliferous era — which contains the present and the whole civilizational window — then collapses across the Degenerate (~0.12) and Black-Hole (~0.02) eras toward heat death. The civilizational window runs from today (~13.8 Gyr) out to ~10¹⁴ yr; because the whole drama plays out inside the Stelliferous era, the cosmic ceiling is ~1 for most of a run and only bites in extended deep-time. That falling ceiling is why migration between Penrose aeons eventually becomes the only way to reset a dying universe's clock — but the Field-tapped energy tier persists even as stellar and galactic energy fade: il Campo è la costante.",
    attributes: [
      { k: 'Peak', v: 'Stelliferous era (10⁹–10¹² yr) · availability 1.0' },
      { k: 'Window', v: 'today (~13.8 Gyr) → ~10¹⁴ yr (late-Stelliferous)' },
      { k: 'Decline', v: 'Degenerate ~0.12 → Black-Hole ~0.02 → heat death' },
      { k: 'Constant', v: 'the Field-tapped tier persists — il Campo è la costante' },
    ],
    links: [L('concept-deeptime-civilizational-ladder'), L('dt-six-fates'), L('era-oceanic-age'), L('era-eonic-age')],
    sources: [SRC],
  },
  {
    id: 'dt-six-fates', type: 'concept', kb_group: 'deeptime',
    name: 'Six ways a universe may end', jp: '宇宙の六つの終末',
    summary:
      "Every universe samples one ultimate fate from an observationally-weighted prior; ΛCDM makes heat death likeliest, Penrose's Conformal Cyclic Cosmology is the escape. Heat Death / Big Freeze (45%) — freeze into maximal entropy as expansion dilutes everything. Penrose CCC (25%) — never truly ends; each aeon's remote future is reborn as the next aeon's hot beginning. Big Rip (10%) — dark energy strengthens until it tears bound structure apart. Big Bounce (10%) — oscillatory, no first beginning. Big Crunch (5%) — reverses and recollapses. Vacuum Decay (5%) — ends locally and abruptly when a false vacuum tunnels lower. MODEL ASSUMPTION: these are competing stochastic fates of THIS one universe, not an established eternally-inflating multiverse. Which late eras (and doors) stay reachable depends on the sampled fate — under CCC every era stays perpetually available.",
    attributes: [
      { k: 'Heat Death · 45%', v: 'freeze into maximal entropy (the ΛCDM default)' },
      { k: 'Penrose CCC · 25%', v: 'each aeon reborn as the next — the escape hatch' },
      { k: 'Big Rip · 10%', v: 'dark energy tears bound structure apart' },
      { k: 'Big Bounce · 10%', v: 'oscillatory, no first beginning' },
      { k: 'Big Crunch · 5%', v: 'reverses and recollapses' },
      { k: 'Vacuum Decay · 5%', v: 'a false vacuum tunnels to a lower state' },
    ],
    links: [L('concept-deeptime-civilizational-ladder'), L('recon-conformal-cyclic-cosmology'), L('recon-cyclic-ekpyrotic'), L('dt-cosmic-substrate'), L('term-curvature-limit')],
    sources: [SRC],
  },
  {
    id: 'dt-species-spectrum', type: 'concept', kb_group: 'deeptime',
    name: 'The projected species spectrum', jp: '推定種族相',
    summary:
      "The far-future, multi-galactic biosphere: science-based constraints plus controlled speculation, governed by five rules (same physics/similar constraints; energy availability drives complexity; gravity shapes anatomy; convergent evolution repeats useful forms; regression also occurs). These yield five convergent body plans — bilateral walkers, swimmers, gliders, modular colonies, distributed swarms — realized by eight rated archetypes, from Neo-Sapiens Federates and High-Gravity Compact Toolmakers (HIGH) through Oceanic Cephaliform Engineers (MEDIUM) to Ammonia-World Chemotroph Intellects (LOW–MED). The engine maps a civilization's mind-mix (baseline / post / artificial / collective) onto an archetype. As the era ladder is climbed, identity widens along the self-reference scale: individual self → species → planetary → galactic → intergalactic → universal self-reference.",
    attributes: [
      { k: 'Body plans', v: 'walkers · swimmers · gliders · modular colonies · swarms' },
      { k: 'Archetypes', v: '8 rated (HIGH → LOW) by plausibility under known physics' },
      { k: 'Selector', v: "mind-mix: baseline / post / artificial / collective" },
      { k: 'Self-reference scale', v: 'individual → species → planetary → galactic → universal' },
    ],
    links: [L('concept-deeptime-civilizational-ladder'), L('era-eonic-age'), L('era-chronal-self-reference'), L('dt-hybrid-model')],
    sources: [SRC],
  },
  {
    id: 'dt-phi-ladder', type: 'concept', kb_group: 'deeptime',
    name: 'The Field-mastery ladder (Φ₀–Φ₆)', jp: '場の熟達の梯子',
    summary:
      "Deep-time history reads the vessels as capabilities on the Field-mastery ladder Φ₀…Φ₆, each rung a navigational door the cartography already names — coupled to (but distinct from) the Kardashev energy index K. Φ₀ observation of quantum fluctuations (OCT-0 surface); Φ₁ industrial entanglement / nonlocal comms (ER=EPR); Φ₂ field propulsion, coastal navigation (Casimir-corridor sailing); Φ₃ deep-field superluminal navigation (the dive — the Idrenes Bridge at phase-lock); Φ₄ large-scale topological engineering of one universe (kindled seam-wells); Φ₅ cosmological Field integration & universe-scale cognitive networking (the Eonic proto-universal self); Φ₆ universal self-reference & possible trans-universal awareness. The K↔Φ coupling is the model's core: energy is not Field mastery, communication is not transport, but the two advance together — Oceanic Φ₄ needs galactic K≈3; Eonic/Chronal Φ₅–₆ need K≈4–5.",
    attributes: [
      { k: 'Φ₂', v: 'Casimir-corridor sailing (the Diaspora)' },
      { k: 'Φ₃', v: 'the dive — Idrenes Bridge (galactic & Oceanic ages)' },
      { k: 'Φ₄', v: 'kindled seam-wells (Oceanic · the ~50 Gyr present)' },
      { k: 'Φ₅', v: 'cosmological Field integration (Eonic proto-self)' },
      { k: 'Φ₆', v: 'universal self-reference (Chronal)' },
      { k: 'K↔Φ', v: 'distinct axes that advance together' },
    ],
    links: [L('concept-deeptime-civilizational-ladder'), L('term-the-dive'), L('term-oct-0-surface'), L('era-oceanic-age'), L('era-eonic-age'), L('term-ship-archetypes')],
    sources: [SRC],
  },
  {
    id: 'dt-hybrid-model', type: 'technology', kb_group: 'deeptime',
    name: 'The hybrid stochastic model (deeptime engine)', jp: '混成確率モデル',
    summary:
      "Beneath the codex's literary surface sits a genuine computational model — the 'deeptime' engine — of which the archive is the worldbuilding skin. Deep time is not one inevitable future but an ecology of possible histories: probability distributions over millions to billions of years. Four interacting methods drive it — differential equations for the mastery axes, graph dynamics for the Field ocean, agent-based modelling for civilizations, and Monte-Carlo ensembles for the probabilities — as a jump-diffusion system dX = F dt + Σ dW + J dN over a state-dependent graph, tracking a 15-variable civilization state. Every assumption is tagged empirical (E), extrapolative (X) or speculative (S). A default ensemble reproduces the seven-era ladder: P(K≥3) ≈ 0.85, P(K≥4) ≈ 0.6–0.7, chronal Φ₆ a rare late achievement — most histories culminate in the Eonic age, a few stall at Galactic.",
    attributes: [
      { k: 'Master equation', v: 'dX = F dt + Σ dW + J dN (jump-diffusion)' },
      { k: 'Methods', v: 'ODEs · graph dynamics · agent-based · Monte-Carlo' },
      { k: 'Tags', v: 'empirical (E) · extrapolative (X) · speculative (S)' },
      { k: 'Calibration', v: 'P(K≥3)≈0.85 · P(K≥4)≈0.6–0.7 · Chronal rare' },
      { k: 'Constant', v: 'civilization is the process; the Field is the constant' },
    ],
    links: [L('concept-deeptime-civilizational-ladder'), L('dt-cosmic-substrate'), L('dt-six-fates'), L('dt-species-spectrum'), L('dt-phi-ladder')],
    sources: [SRC],
  },

  // — the six ship archetypes (post-audit) ——————————————————————
  {
    id: 'term-ship-archetypes', type: 'concept', kb_group: 'ships',
    name: 'The six ship archetypes', jp: '六つの船の原型',
    summary:
      "Where a ship's CLASS measures how deep it can dive (its maximum navigable OCT depth), the six ARCHETYPES are distinct engineering strategies, each exploiting a different real quantum-vacuum effect — so each spans a range of classes, not one rung. Casimir Sailer (Class I) — field-sails open Casimir corridors, the most human ship. Unruh Catamaran (Class I–II) — accelerated hulls resample the vacuum thermally, the vertical dive. Squeezing Bathyscaphe (Class I–II) — squeezed states open a low-cost negative-energy window (the debt always repays). Parker Drifter (Class 0–I) — rides the cosmological expansion current, makes no crossing. Penrose Frontier Ship (Class II–III) — realigns to conformal directions to hold the seam 𝔍. Idrenes Composite (Class II–ω) — a reconfigurable hull that is all four in sequence, coordinated by a Solaris.Ai core. THE AUDIT CORRECTION: the Casimir Sailer is an FTL Class I ship, not a sub-light Class 0 Crawler.",
    attributes: [
      { k: 'Casimir Sailer · I', v: 'Casimir corridors — the route (most human)' },
      { k: 'Unruh Catamaran · I–II', v: 'thermal Unruh layer — the dive' },
      { k: 'Squeezing Bathyscaphe · I–II', v: 'squeezed negative-energy window' },
      { k: 'Parker Drifter · 0–I', v: 'rides the expansion current — no crossing' },
      { k: 'Penrose Frontier Ship · II–III', v: 'conformal realign — holds the seam 𝔍' },
      { k: 'Idrenes Composite · II–ω', v: 'all axes · needs a Solaris.Ai core' },
      { k: 'Audit fix', v: 'Casimir Sailer is FTL Class I, not Class 0' },
    ],
    links: [L('term-ship-classes-0'), L('ship-class-casimir'), L('ship-class-unruh'), L('ship-class-squeeze'), L('ship-class-parker'), L('ship-class-penrose'), L('ship-class-idrenes'), L('term-the-dive'), L('term-the-seam')],
    sources: [SRC],
  },
];

// — phrasebook lexicon additions (Rev 1.0 flags these fourteen coinings to be
//   "merged into the master lexicon"; ān already exists, so thirteen are added) —
const SRC_PB = '10_qtr-phrasebook.html';
const W = (slug, name, ipa, domain, gloss, ety, extra = []) => ({
  id: 'word-suchel-' + slug, type: 'lexicon', name, language: 'lang-suchel', language_name: 'Sūchel',
  ipa, domain, summary: gloss, etymology: ety,
  links: [L('lang-suchel', 'in_language'), ...extra], sources: [SRC_PB],
});
NEW.push(
  W('jed', 'jed', 'dʒed', 'motion', 'to go, move (always with a directional)', '*ged- → SC-1 (g→j /_e)'),
  W('tan', 'tan', 'tan', 'core', 'to hold, keep', '*tan-'),
  W('id-v', 'id', 'id', 'physics', 'to open (v.) — the Idrenes root, used as a verb', '*id-', [L('tech-idrenes-bridge', 'denotes')]),
  W('men', 'men', 'men', 'core', 'to wait, remain', '*men-'),
  W('ret', 'ret', 'ret', 'grammar', 'again', '*ret-'),
  W('kru', 'kru', 'kru', 'core', 'blood', '*kru-'),
  W('gal', 'gal', 'gal', 'navigation', 'the Still — becalmed vacuum (the Dead-Sea)', '*gal- (no front vowel: g survives)', [L('hazard-dead', 'denotes')]),
  W('lesh', 'lesh', 'leʃ', 'navigation', 'alignment; fair phase; luck', '*les- → s→sh /_front (SC-1 analog)'),
  W('maiel', 'maiel', 'ˈmai.el', 'kinship', 'kinsman; bound-one', '-mai "entangled" + agent -el'),
  W('om', 'om', 'om', 'grammar', 'all, every', '*om-'),
  W('vu', 'vu', 'vu', 'grammar', 'question particle (final)', '*wu → SC-3 (w→v)'),
  W('imp-u', '-u', 'u', 'grammar', 'imperative suffix (non-assertive: no mood, no anchor)', '*-u hortative'),
  W('voc-o', 'ō', 'oː', 'grammar', 'vocative particle', '*ō interjection'),
);

// ---- apply -----------------------------------------------------------------
const byId = new Map(db.entities.map((e) => [e.id, e]));

// reframes: patch name/summary/jp and merge any _addLinks
for (const [id, patch] of Object.entries(PATCH)) {
  const e = byId.get(id);
  if (!e) { console.warn('PATCH target missing:', id); continue; }
  if (patch.name) e.name = patch.name;
  if (patch.summary) e.summary = patch.summary;
  if (patch.jp) e.jp = patch.jp;
  for (const t of (patch._addLinks || [])) {
    if (!(e.links || []).some((l) => l.target === t)) (e.links ||= []).push(L(t));
  }
}

// text corrections: overwrite named fields on existing entities
for (const [id, fields] of Object.entries(TEXT_PATCH)) {
  const e = byId.get(id);
  if (!e) { console.warn('TEXT_PATCH target missing:', id); continue; }
  Object.assign(e, fields);
}
// layer corrections
for (const [id, fields] of Object.entries(LAYER_PATCH)) {
  const l = (db.layers || []).find((x) => x.id === id);
  if (l) Object.assign(l, fields); else console.warn('LAYER_PATCH target missing:', id);
}

// additions: replace-by-id (idempotent)
for (const rec of NEW) {
  const i = db.entities.findIndex((e) => e.id === rec.id);
  if (i >= 0) db.entities[i] = rec; else db.entities.push(rec);
}

// ---- validate: every link target must resolve; recompute counts ------------
const ids = new Set(db.entities.map((e) => e.id).concat((db.events || []).map((e) => e.id)));
let linkCount = 0, dangling = 0;
for (const e of db.entities) for (const l of (e.links || [])) { linkCount++; if (!ids.has(l.target)) { dangling++; console.warn('DANGLING:', e.id, '→', l.target); } }

const byType = {};
for (const e of db.entities) byType[e.type] = (byType[e.type] || 0) + 1;

db.meta.version = '3.0';
db.meta.generated = '2026-07-21';
db.meta.subtitle = 'Objects & events knowledge base + map feed, synced to the consolidated qtr-v2 canon (SYSTEM.md)';
db.meta.counts = {
  entities: String(db.entities.length),
  events: (db.events || []).length,
  map_nodes: db.entities.filter((e) => e.type === 'map_node').length,
  map_edges: (db.map_edges || []).length,
  by_type: Object.fromEntries(Object.entries(byType).sort((a, b) => b[1] - a[1])),
  total_kb_links: String(linkCount),
  dangling_links: String(dangling),
  v3_reframes: Object.keys(PATCH).length,
  v3_added: NEW.length,
};
db.meta.sources = [
  'qtr-v2 · SYSTEM.md (consolidated canon)',
  '01_qtr-codex.html', '02_qtr-reconciliation-codex.html', '03_cartography-omniverse.html',
  '04_qtr-map.html', '05_qtr-bestiary.html', '06_qtr-glossary.html', '07_qtr-time-codex.html',
  '08_qtr-timelines.html', '15_qtr-deeptime.html', 'time-sensations-prose.md',
  '09_qtr-language-codex.html', '10_qtr-phrasebook.html', '11_qtr-script.html',
  '12_qtr-sound.html', '13_qtr-sisters.html', '14_qtr-nubhel.html',
  'universe-map · Tekné NAVCOM',
];

writeFileSync(PATH, JSON.stringify(db, null, 2) + '\n');
console.log(`v3 written: ${db.entities.length} entities (+${NEW.length} new, ${Object.keys(PATCH).length} reframed), ${linkCount} links, ${dangling} dangling.`);
