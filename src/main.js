import './style.css';
import { Catalog } from './data/catalog.js';
import { CosmosData } from './data/cosmosData.js';
import { App } from './app.js';
import { initHUD } from './hud/hud.js';
import { initSearch } from './hud/search.js';
import { initInfoPanel } from './hud/infoPanel.js';
import { initVoyagePlayer, initExpeditionCruise } from './hud/voyages.js';
import { initNavChart } from './hud/navchart.js';
import { initStudio } from './hud/studio.js';
import { buildAtlasBrowser } from './hud/atlasBrowser.js';
import { QtrData } from './data/qtrData.js';
import { initCodex } from './hud/codex.js';
import { initManual } from './hud/manual.js';
import { initHotkeys } from './hud/hotkeys.js';
import { initNavcomAgent } from './hud/navcomAgent.js';

const boot = document.getElementById('boot');
const bootBar = document.getElementById('boot-bar-fill');
const bootLog = document.getElementById('boot-log');
const prog = (frac, msg) => { bootBar.style.width = Math.round(frac * 100) + '%'; if (msg) bootLog.textContent = msg; };

async function main() {
  const catalog = new Catalog();
  const cosmos = new CosmosData();
  const base = import.meta.env.BASE_URL || '/';
  const durl = (p) => `${base}data/${p}`.replace(/([^:])\/\/+/g, '$1/');
  let extras = { clusters: [], structures: [] };
  try {
    await catalog.load((f, m) => prog(f * 0.5, m));
    await cosmos.load((f, m) => prog(0.5 + f * 0.4, m));
    prog(0.92, 'clusters, structures & cosmic atlas');
    const [clusters, structures, atlas, expeditions, tradeRoutes] = await Promise.all([
      fetch(durl('clusters.json')).then((r) => r.json()).catch(() => []),
      fetch(durl('structures.json')).then((r) => r.json()).catch(() => []),
      fetch(durl('atlas.json')).then((r) => r.json()).catch(() => ({ objects: [], categories: {} })),
      fetch(durl('expeditions.json')).then((r) => r.json()).catch(() => ({ expeditions: [] })),
      fetch(durl('trade-routes.json')).then((r) => r.json()).catch(() => ({ routes: [] })),
    ]);
    extras = { clusters, structures, atlas, expeditions, tradeRoutes };
  } catch (e) {
    bootLog.innerHTML = `<span style="color:#ff6b6b">failed to load data: ${e.message}</span>`;
    console.error(e);
    return;
  }

  const canvas = document.getElementById('viewport');
  const app = new App(canvas, catalog, cosmos, extras);

  initHUD(app);
  initSearch(app);
  initInfoPanel(app);
  initVoyagePlayer(app);
  initExpeditionCruise(app);
  initManual(app);
  initHotkeys(app);
  initNavChart(app);
  initStudio(app);
  // keep the atlas browser in sync when the user's library changes
  app.on('custom', () => buildAtlasBrowser(app));

  // load the imagined "Immeasurable Spaces" codex (optional; button hides if absent)
  const qtr = new QtrData();
  initNavcomAgent(app, qtr);   // the Solaris.Ai NAVCOM agent (qtr fills in after load)
  qtr.load().then(() => initCodex(qtr, app));

  // real ↔ fiction bridge: jumping from a codex class to the real atlas category
  // rebuilds the atlas browser (with the category pre-filtered) and shows it.
  app.on('revealCategory', () => {
    buildAtlasBrowser(app);
    const tab = document.querySelector('.tab[data-tab="atlas"]');
    if (tab) tab.click();
  });

  app.start();

  boot.classList.add('hidden');
  setTimeout(() => boot.remove(), 700);
  window.__universe = app;
}

main();
