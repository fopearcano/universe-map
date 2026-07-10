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
| The horizon | CMB shell at z≈1100 | boundary at 45.4 Gly |

Objects are coloured by distance (cyan near → crimson far, mirroring redshift).
A **redshift slider peels back the universe** by look-back distance; toggle each
catalogue; click any galaxy/quasar for its redshift, comoving distance (Gly &
Mpc), look-back time, RA/Dec and survey.

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

## Controls

| Action | Input |
| --- | --- |
| Orbit / pan / zoom | drag · right-drag · scroll |
| Select object | click · **fly to**: double-click |
| Switch scale | LOCAL / COSMOS toggle (top bar) |
| Search / jump | top search box |
| Recenter | Layers ▸ recenter on Sol |

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
node scripts/build-cosmos.mjs   # galaxies/quasars: 2MRS + SDSS -> layers + CMB
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
- The CMB is a dim procedural inside-out shell that fades in as you pull out
  toward the horizon (a representation, clearly labelled — not the Planck map).

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
- Exoplanets (live): **NASA Exoplanet Archive**.
- Cosmology: flat ΛCDM, **Planck 2018** parameters.
- Rendering [three.js](https://threejs.org) · build [Vite](https://vitejs.dev).
