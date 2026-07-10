# UNIVERSE MAP

An interactive **3D navigable HUD map of the universe** — from the stars in our
own neighbourhood out to the cosmic microwave background at the edge of the
observable universe. It has two modes:

- **LOCAL** — a true-scale map of ~100,000 real stars (HYG catalogue), in
  parsecs, Sol at the origin.
- **COSMOS** — the whole **observable universe (~93 Gly across)** on a single
  logarithmic scale: ~327,000 real galaxies & quasars (2MRS + SDSS) placed by
  redshift, the Local Group, our galaxy's stars, and the CMB boundary shell.

Everything is **orbit / pan / zoom**, HUD/infographic in style, with almost no
decorative graphics — the objects *are* the data, and every number comes from a
real catalogue.

![local mode](docs/overview.png)
![cosmos mode](docs/cosmos.png)

---

## Two ways to read the sky

### LOCAL — the stellar neighbourhood
100,000 stars from **HYG v4.1** with true 3D positions, coloured by their B–V
index via a blackbody model, sized by apparent magnitude. Filter by magnitude,
distance, spectral class, constellation; search by name / HIP / HD; click any
star for full data (distance, magnitude, luminosity, spectral type, RA/Dec,
constellation, catalogue IDs); optionally query the **live NASA Exoplanet
Archive** for its planets.

### COSMOS — the observable universe
The great challenge of a "whole universe" map is dynamic range: ~1 parsec to
~14,000 megaparsecs is **10+ orders of magnitude**, impossible in one linear
space. The solution here is a **logarithmic radial scale** — every object keeps
its true sky direction, but its radius is `3 · log₁₀(distance)`, so the entire
cosmos becomes a navigable onion centred on the Sun:

| Shell | Source | Objects |
| --- | --- | --- |
| Our galaxy's stars | HYG (log-radialised) | 100,000 |
| Local Group galaxies | curated, direct distances | 20 (named, searchable) |
| Nearby galaxies | **2MRS** (all-sky) | 43,500 |
| Cosmic web | **SDSS** galaxies | 189,000 |
| The quasar era | **SDSS** quasars (to z≈3.9) | 95,000 |
| The horizon | **real WMAP 9-yr CMB** shell at z≈1100 | boundary at 45.4 Gly |

Objects are coloured by distance (cyan near → crimson far, mirroring redshift).
A **redshift slider peels back the universe** by look-back distance; a manual
**CMB opacity** control overrides the auto-fade; toggle each catalogue; click any
galaxy/quasar for its redshift, comoving distance (Gly & Mpc), look-back time,
RA/Dec, survey and a derived **IAU-style designation** (e.g. `SDSS J120702.4−024415`).

### On object counts, "galaxies made of stars", and LOD

The map plots ~430,000 real objects. That is *not* an arbitrary cap you can lift
to "hundreds of billions": the observable universe holds ~10²² stars, and a
browser GPU renders a few million points at most (tens of millions with heavy
LOD). Just as importantly, **per-star data simply does not exist** for other
galaxies — only for our own Milky Way (via Gaia). So selecting a galaxy blooms it
into a **procedural, illustrative star cloud** — a deterministic spiral,
elliptical or irregular morphology grown from the object's own coordinates,
clearly labelled as a representation, not a catalogue — to convey that galaxies
are made of stars while staying honest that no catalogue resolves them.

## The Cosmic Atlas (knowledge base)

A dedicated **ATLAS** tab and a set of typed markers overlay a curated knowledge
base of the most significant real objects and events across **every major class**:

> supermassive & stellar **black holes** · **neutron stars / pulsars / magnetars**
> · **supernovae & remnants** · **nebulae** · **exoplanet systems** · notable
> **galaxies** · **quasars & blazars** · **transient events** (gravitational-wave,
> gamma-ray & fast-radio bursts) · **extreme stars**

Each entry carries a real sky position, distance and a headline-astrophysics note
(e.g. Sgr A*, M87*, TON 618, the Crab & Vela pulsars, SGR 1806-20, Cassiopeia A,
the Pillars of Creation, TRAPPIST-1, GW170817, GRB 221009A, UY Scuti…). Browse by
category, filter by text, and click to fly to it (hopping to COSMOS when the
object is beyond the true-scale LOCAL view). It is deliberately **curated, not
exhaustive** — the universe holds billions of catalogued objects — but it's a real,
extensible foundation, and it grows two ways:

### Live data retrieval (SIMBAD) — and it persists

The ATLAS tab has a **resolve-live** box: type any real object's name and it is
resolved on the fly against **SIMBAD (CDS)** — coordinates, object type, spectral
type and a distance derived from parallax or redshift — then placed on the map and
**saved to your library**. Any real object's info panel also has a **⟲ SIMBAD**
button to enrich it with live data. SIMBAD's service is CORS-enabled, so this runs
straight from the browser (no proxy needed).

Everything you add is written to **localStorage**, so it **persists across reloads**
(it does *not* reset on restart). **Export / Import** round-trips your whole library
as JSON, and **Clear** wipes it.

### The Codex — an imported fiction knowledge base

A **📖 CODEX** button (top bar) opens the *Immeasurable Spaces* universe database —
a bundled example of a large, richly-linked story knowledge base (406 records
across 16 types: objects, events, concepts, hazards, reconciliations, a two-fleet
lexicon, phrases, places, worlds, ships, factions, technologies, nav axes…). It's
a full browser: **search + type facets + a graph-linked detail view** (every record
shows its `related` / `same_as` / `denotes` / `in_language` / `located_on` links as
clickable chips that walk the graph), a **real ↔ fiction** anchor line, and a
**DIAGRAM** tab that renders the canon's 2D "tower" map (the depth / adjacency /
constitution axes, substrate floor → the limit Κ) with clickable nodes. Drop a
different `qtr-universe-db.json` in `public/data/` to swap in your own corpus; the
schema block in the file is self-describing.

### Story Studio — imagined objects & events

The **✦ Imagine** button opens an authoring modal to add **hypothetical objects
and events** for story-crafting: name, category, type, position (RA/Dec, or *use
view* to drop it where you're looking), distance, and lore/notes. Imagined objects
render as distinct magenta ✦ markers in both modes, are searchable, route-able and
focus-able like anything else, and persist in your library. Provide a batch as a
JSON file via **Import** — the format is `{ "objects": [ { "name", "kind":
"imagined", "category", "type", "ra"(h), "dec"(°), "distLy", "facts" }, … ] }`.

## Story voyages

A voyage is a route of stops with a narrative at each — a documented journey
traced across the map, the way Ulysses' or Darwin's voyages are charted.

**Local mode**
- **The Sun's Nearest Neighbours** — every star within ~12 ly, in distance order.
- **Voyager — the Interstellar Errand** — where the real probes are actually heading.
- **An Interstellar Odyssey** — a mythic grand tour shaped like Homer's Odyssey.

**Cosmos mode**
- **To the Edge of the Universe** — a scale-ladder zoom out from the Sun through
  the Milky Way, Local Group, supercluster, cosmic web and quasar era to the CMB,
  progressively revealing more distant objects at each stop.

## Navigation — plot & fly a course

The map doubles as a **spaceship navigation computer**. You are not limited to the
preset voyages — you can plot arbitrary routes:

- **Plot a course**: toggle **◉ plot** and click the map to drop waypoints (they
  snap to an object under the cursor, or land in free space at the focal depth),
  or select any object and hit **＋ route**. **＋ pt** drops a free-space waypoint
  where you're looking, so you can route through empty space.
- **Edit the course**: reorder (▲▼), remove (✕) or reverse (⇄) any waypoint.
- **Cruise speed → travel time**: pick a cruise velocity (Voyager's 17 km/s up to
  light speed). Each leg then shows its **distance, heading (RA/Dec) and travel
  time**, and the totals show the **mission time** *and* the **relativistic ship
  (proper) time** — at 0.99 c a 700-year crossing is only ~100 years for the crew.
- **⏵ ENGAGE autopilot**: a chase-cam flies the plotted course with a live nav HUD
  (current leg, heading, range to next, ETA, ship time); hold / step / disengage.
- **Save / load**: name and save routes (persisted in localStorage), reload them,
  and import/export the whole set as JSON.

Distances are always *physically correct* even in COSMOS mode: the display radius
there is logarithmic, but every object carries its real direction and distance, so
leg lengths and times come from true 3-D positions (parsecs → ly / Mly / Gly).
LOCAL mode is metrically exact throughout.

You can also **◎ focus** any object to re-centre the orbit pivot on it (navigate
around *it* instead of the Sun).

Also plotted: **star clusters** (open + globular) in both modes, and named
**large-scale structures** in COSMOS — the Virgo & Coma clusters, the Great
Attractor, the Shapley & Laniakea superclusters, the Sloan Great Wall, the Boötes
Void and more.

## Controls

| Action | Input |
| --- | --- |
| Orbit / pan / zoom | drag · right-drag · scroll |
| Select object | click · **fly to**: double-click |
| Re-centre pivot on object | object panel ▸ ◎ focus |
| Add waypoint / trace a route | object panel ▸ ＋ route |
| Switch scale | LOCAL / COSMOS toggle (top bar) |
| Search / jump | top search box |
| Recenter on Sol | Layers ▸ recenter · focus chip ✕ |

Dev/preview server runs on **port 5333** (`npm run dev`).

### Deferred (by request)

"Focus" re-centres the camera *pivot* on an object, but the coordinate origin
stays at the Sun. A stronger **"re-origin on object X"** — translating the whole
LOCAL frame so X is at (0,0,0) and every ring / distance / telemetry reads *from
X* — is intentionally **not** built yet (noted here for later). It is clean and
exact in LOCAL (a rigid translation preserves all distances); it is deliberately
avoided in COSMOS, where the logarithmic radius is inherently Sun-centred and
re-origining would misrepresent the cosmology.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # -> dist/ (fully static)
```

All catalogues are preprocessed and committed under `public/data/`, so the app
runs offline with no build-time network.

## Regenerating the data

```bash
npm run build:data     # stars: HYG v4.1 -> 100k working set + voyages
npm run build:cosmos   # galaxies/quasars: 2MRS + SDSS -> layers + scale voyage
npm run build:cmb      # real WMAP 9-yr CMB map -> equirectangular shell texture
npm run build:extras   # curated star clusters + large-scale structures
npm run build:atlas    # curated cosmic-atlas knowledge base
```

`build-cosmos.mjs` fetches the 2MASS Redshift Survey (VizieR) and SDSS
spectroscopic samples (SkyServer SQL) in redshift slices, converts each object's
redshift to a comoving distance, and writes the compact binary layers. Raw
responses are cached under `scripts/.cache/`.

### Cosmology — no Astropy required

Redshift → comoving distance uses a flat **ΛCDM (Planck 2018)** model integrated
numerically in `scripts/cosmology.mjs` (and mirrored in `src/util/cosmology.js`
with a lookup table for the frontend). It is dependency-free and validated
against published distances (z=1 → 3400 Mpc, horizon at z=1100 → 45.4 Gly radius
≈ 91–93 Gly diameter). Run `node scripts/cosmology.mjs` to see the self-test.

## Architecture

```
scripts/
  build-data.mjs      HYG catalogue -> star binary + local voyages
  build-cosmos.mjs    2MRS + SDSS -> galaxy/quasar layers + CMB + scale voyage
  cosmology.mjs       ΛCDM comoving-distance integral (+ self-test)
  voyages.source.mjs  authored local voyages
  localgroup.mjs      curated Local Group galaxies
public/data/          generated, committed assets (stars + cosmos, ~10 MB)
src/
  main.js             boot: load both datasets, wire HUD, start loop
  app.js              mode-aware state, selection, voyages, render loop
  data/               catalog.js (stars) · cosmosData.js · remote.js (live)
  render/
    scene.js          renderer, camera, OrbitControls, fly-to
    starfield.js      100k star points (blackbody colour, GPU filtering)
    cosmos.js         log-radial galaxy/quasar layers, Local Group, CMB shell
    picking.js        CPU nearest-ray selection
    labels.js         projected DOM labels
    voyagePath.js     local voyage route + markers
  hud/                hud.js · filters.js · cosmosHud.js · search.js
                      infoPanel.js · voyages.js
  util/               color.js · astro.js · cosmology.js
```

### Rendering notes
- Each mode is a set of `THREE.Points` clouds sharing one renderer/camera/HUD.
  Stars use a blackbody-colour shader sized by magnitude; cosmos layers use a
  constant-screen-size shader coloured by distance, with a redshift cut-off
  uniform.
- Picking is a CPU nearest-ray angular scan — exact and ~1–3 ms even across
  100k–330k points, so no GPU id-buffer is needed.
- The CMB shell carries the **real WMAP 9-year ILC map**: `scripts/build-cmb.mjs`
  reprojects the HEALPix FITS (Nside 512, NESTED, galactic) to an equatorial
  equirectangular PNG — implementing `ang2pix_nest` and the equatorial↔galactic
  rotation by hand, dependency-free. It fades in as the camera nears the horizon,
  and falls back to a procedural texture if the PNG is absent.

## Dynamic data retrieval

The base map is static so it always works. On top of that, a selected star
exposes **◇ query exoplanets**, a live call to the NASA Exoplanet Archive TAP
service (best-effort; honest CORS fallback; `remote.setProxy(url)` to route
through a pass-through). The module documents wiring SIMBAD, Gaia and VizieR the
same way.

## Data & credits
- Stars: **HYG database v4.1** (astronexus) — Hipparcos / Yale / Gliese.
- Galaxies (nearby): **2MASS Redshift Survey** (Huchra et al.), via VizieR/CDS.
- Galaxies & quasars (deep): **Sloan Digital Sky Survey** DR17, via SkyServer.
- CMB map: **WMAP 9-year ILC** (NASA / LAMBDA), reprojected from HEALPix.
- Exoplanets (live): **NASA Exoplanet Archive**.
- Cosmology: flat ΛCDM, **Planck 2018** parameters.
- Rendering [three.js](https://threejs.org) · build [Vite](https://vitejs.dev).
