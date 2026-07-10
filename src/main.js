import './style.css';
import { Catalog } from './data/catalog.js';
import { CosmosData } from './data/cosmosData.js';
import { App } from './app.js';
import { initHUD } from './hud/hud.js';
import { initSearch } from './hud/search.js';
import { initInfoPanel } from './hud/infoPanel.js';
import { initVoyagePlayer } from './hud/voyages.js';
import { initNavChart } from './hud/navchart.js';

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
    prog(0.92, 'clusters & structures');
    const [clusters, structures] = await Promise.all([
      fetch(durl('clusters.json')).then((r) => r.json()).catch(() => []),
      fetch(durl('structures.json')).then((r) => r.json()).catch(() => []),
    ]);
    extras = { clusters, structures };
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
  initNavChart(app);

  app.start();

  boot.classList.add('hidden');
  setTimeout(() => boot.remove(), 700);
  window.__universe = app;
}

main();
