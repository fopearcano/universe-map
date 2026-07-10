import './style.css';
import { Catalog } from './data/catalog.js';
import { CosmosData } from './data/cosmosData.js';
import { App } from './app.js';
import { initHUD } from './hud/hud.js';
import { initSearch } from './hud/search.js';
import { initInfoPanel } from './hud/infoPanel.js';
import { initVoyagePlayer } from './hud/voyages.js';

const boot = document.getElementById('boot');
const bootBar = document.getElementById('boot-bar-fill');
const bootLog = document.getElementById('boot-log');
const prog = (frac, msg) => { bootBar.style.width = Math.round(frac * 100) + '%'; if (msg) bootLog.textContent = msg; };

async function main() {
  const catalog = new Catalog();
  const cosmos = new CosmosData();
  try {
    await catalog.load((f, m) => prog(f * 0.55, m));
    await cosmos.load((f, m) => prog(0.55 + f * 0.45, m));
  } catch (e) {
    bootLog.innerHTML = `<span style="color:#ff6b6b">failed to load data: ${e.message}</span>`;
    console.error(e);
    return;
  }

  const canvas = document.getElementById('viewport');
  const app = new App(canvas, catalog, cosmos);

  initHUD(app);
  initSearch(app);
  initInfoPanel(app);
  initVoyagePlayer(app);

  app.start();

  boot.classList.add('hidden');
  setTimeout(() => boot.remove(), 700);
  window.__universe = app;
}

main();
