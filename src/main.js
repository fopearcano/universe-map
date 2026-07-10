import './style.css';
import { Catalog } from './data/catalog.js';
import { App } from './app.js';
import { initHUD } from './hud/hud.js';
import { initFilters } from './hud/filters.js';
import { initSearch } from './hud/search.js';
import { initInfoPanel } from './hud/infoPanel.js';
import { initVoyages } from './hud/voyages.js';

const boot = document.getElementById('boot');
const bootBar = document.getElementById('boot-bar-fill');
const bootLog = document.getElementById('boot-log');

async function main() {
  const catalog = new Catalog();
  try {
    await catalog.load((frac, msg) => {
      bootBar.style.width = Math.round(frac * 100) + '%';
      if (msg) bootLog.textContent = msg;
    });
  } catch (e) {
    bootLog.innerHTML = `<span style="color:#ff6b6b">failed to load catalogue: ${e.message}</span>`;
    console.error(e);
    return;
  }

  const canvas = document.getElementById('viewport');
  const app = new App(canvas, catalog);

  // HUD wiring
  initHUD(app);
  initFilters(app);
  initSearch(app);
  initInfoPanel(app);
  initVoyages(app);

  app.start();

  // fade out boot screen
  boot.classList.add('hidden');
  setTimeout(() => boot.remove(), 700);

  // expose for debugging
  window.__universe = app;
}

main();
