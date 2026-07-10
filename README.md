# UNIVERSE MAP

An interactive **3D navigable HUD map of the known stellar neighbourhood** —
~100,000 real stars from the HYG catalogue, rendered as a data-dense
infographic you can **orbit, pan and zoom**, with **story-voyage tracking** so
you can trace a documented journey (like Ulysses' or Darwin's) across the star
field, one narrated waypoint at a time.

Almost no decorative graphics or animation: the stars *are* the data, and every
number in the HUD comes from a real catalogue.

![overview](docs/overview.png)

---

## What it does

- **Real 3D positions.** 100,000 stars placed by their true Cartesian
  coordinates in parsecs (equatorial J2000), with **Sol fixed at the origin**.
  Everything is a *relative* map measured from the Sun.
- **Navigate freely.** Orbit (drag), pan (right-drag), zoom (scroll); click a
  star to inspect it, double-click to fly to it, and a smooth camera tween
  carries you between stops.
- **HUD / infographic overlay.** Live telemetry (visible-star count, range from
  Sol, view heading in RA/Dec, FOV), distance rings labelled in light-years,
  celestial axes, and always-on labels for the brightest named stars.
- **Filter to navigate.** Cut the field by apparent magnitude, distance,
  spectral class (O B A F G K M), constellation, or "named/catalogued only",
  and scale star size — all applied on the GPU so 100k points stay interactive.
- **Search** by common name, Bayer/Flamsteed designation, **HIP**/**HD**
  number, or constellation (jumps to its brightest star).
- **Per-star data panel:** spectral type, distance (ly + pc), apparent and
  absolute magnitude, luminosity (L☉), B–V colour index, RA/Dec, constellation
  and every catalogue designation.
- **Star colour is physical:** derived from each star's B–V colour index via
  Ballesteros' temperature formula and a blackbody→RGB approximation, so O-type
  stars read blue and M dwarfs red.
- **Story voyages** (see below).
- **Dynamic data retrieval** (experimental): query the live NASA Exoplanet
  Archive for planets of the selected star.

## The three story voyages

Each voyage is a route of waypoints with a narrative at every stop; the camera
flies the route and a story card advances stop by stop (manual or autoplay).
Waypoint **coordinates and stellar data are pulled from the real catalogue** —
only the narrative is authored.

| Voyage | Kind | What it traces |
| --- | --- | --- |
| **The Sun's Nearest Neighbours** | survey traverse | Every star within ~12 ly, in true distance order — mostly the dim red dwarfs that are the galaxy's real demographic. |
| **Voyager — the Interstellar Errand** | real spacecraft | Where Voyager 1 & 2 and the Pioneers are actually heading over the next million years (Gliese 445, Ross 248, Sirius, Aldebaran). |
| **An Interstellar Odyssey** | narrative odyssey | A mythic grand tour of the brightest beacons, shaped like Homer's Odyssey — depart the Sun, endure the wonders and terrors of the deep, and return. |

## Controls

| Action | Input |
| --- | --- |
| Orbit | drag |
| Pan | right-drag (or two-finger) |
| Zoom | scroll / pinch |
| Select star | click |
| Fly to star | double-click |
| Search / jump | top search box |
| Recenter on Sol | Layers ▸ recenter |

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
```

Production build (fully static, deployable to any static host):

```bash
npm run build      # -> dist/
npm run preview
```

The preprocessed catalogue lives in `public/data/` and is committed, so the app
works out of the box with no build-time network access.

## Regenerating the star data

`npm run build:data` downloads the HYG v4.1 catalogue (cached under
`scripts/.cache/`), filters it to a navigable 100,000-star working set, resolves
the voyage waypoints against real coordinates, and writes the assets in
`public/data/`.

```bash
npm run build:data
# or point it at a local copy:
node scripts/build-data.mjs /path/to/hygdata_v41.csv
```

Selection logic keeps every named / Gliese-catalogued / nearby (<25 pc) star and
fills the remainder with the brightest, so nearby faint dwarfs (Proxima,
Barnard's Star, Wolf 359 …) are never dropped even though they're invisible to
the eye.

---

## Architecture

```
scripts/
  build-data.mjs        catalogue -> compact binary + JSON (offline preprocessing)
  voyages.source.mjs    authored voyage waypoints + narrative
  constellations.mjs    IAU abbreviation -> full name
public/data/            generated, committed assets (see "Data assets")
src/
  main.js               boot: load catalogue, wire HUD, start loop
  app.js                central state + orchestration + render loop
  data/
    catalog.js          loads the binary/JSON into typed arrays
    remote.js           experimental live retrieval (NASA Exoplanet Archive)
  render/
    scene.js            renderer, camera, OrbitControls, reference grid, fly-to
    starfield.js        100k GL points, blackbody colour, GPU filtering
    picking.js          CPU nearest-ray star selection
    labels.js           projected DOM labels
    voyagePath.js       voyage route line + waypoint markers
  hud/
    hud.js  filters.js  search.js  infoPanel.js  voyages.js
  util/
    color.js            B–V -> temperature -> RGB
    astro.js            coordinate & photometric conversions/formatting
```

### Data assets (`public/data/`)

| File | Contents |
| --- | --- |
| `stars.bin` | struct-of-arrays: positions (f32×3), mag, absmag, B–V, HIP, HD, constellation index — ~3.3 MB for 100k stars |
| `stars-meta.json` | binary layout, constellation table, bounds, counts |
| `stars-spect.txt` | index-aligned spectral-type strings |
| `search.json` | searchable index of named / bright stars |
| `labels.json` | brightest named stars for always-on labels |
| `voyages.json` | voyages with waypoints resolved to star indices + coordinates |

### Rendering notes

- One `THREE.Points` draw call for all 100k stars. A custom `ShaderMaterial`
  sizes each point from apparent magnitude with clamped distance attenuation
  (bright stars grow as you approach but never dominate), and a per-vertex
  visibility attribute lets filters hide stars on the GPU without rebuilding
  buffers.
- Picking is a single linear scan projecting every point onto the cursor ray and
  keeping the smallest **angular** offset — exact and ~1 ms for 100k points, so
  no GPU id-buffer is needed.

## Dynamic data retrieval

The base map is static so it always works offline. On top of that, selecting a
star exposes **◇ query exoplanets**, which hits the live
[NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) TAP service
for that host. Browser CORS varies by service, so the query is best-effort and
reports honestly when it's blocked; point `remote.setProxy(url)` at a small
CORS-adding pass-through to make it reliable. The module documents further
sources that can be wired in the same way — SIMBAD, the ESA Gaia archive, and
VizieR.

## Coordinate system & units

- World units are **parsecs**; Sol at the origin.
- Axes are **equatorial J2000**: +x → (RA 0h, Dec 0°), +y → (RA 6h, Dec 0°),
  +z → the north celestial pole.
- Distances are shown in both light-years and parsecs (1 pc = 3.2616 ly).

## Data & credits

- Star data: **HYG database v4.1** by David Nash / astronexus, compiled from the
  Hipparcos, Yale Bright Star and Gliese catalogues — <https://astronexus.com/hyg>.
- Exoplanet data (live): **NASA Exoplanet Archive**.
- Rendering: [three.js](https://threejs.org). Build: [Vite](https://vitejs.dev).
