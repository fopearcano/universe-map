import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
const PORT = 5493;
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: process.cwd(), stdio: 'ignore' });
await sleep(3500);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--no-sandbox'] });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 800 });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message));
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
await sleep(4000);

// 1) numeric sweep of _flightDuration across distance × drive
const sweep = await page.evaluate(() => {
  const app = window.__universe;
  app.setMode('cosmos');
  const drives = app.__drivesForTest || null;
  // build a synthetic route of a given physical ly by plotting Sol -> object, then read _flightDuration per drive
  const cases = [];
  const routes = [
    { name: 'local hop (Sol→Sirius ~8.6ly)', stops: [{name:'Sol'},{name:'Sirius'}] },
    { name: 'Andromeda (~2.5 Mly)', stops: [{name:'Sol'},{name:'Andromeda Galaxy (M31)'}] },
    { name: 'Virgo (~54 Mly)', stops: [{name:'Sol'},{name:'Virgo Cluster'}] },
    { name: 'Great Attractor (~250 Mly)', stops: [{name:'Sol'},{name:'Norma Cluster · Great Attractor'}] },
  ];
  // drive ids from the ladder
  const driveIds = ['casimir-sailer','relativistic','idrenes-sorn','unruh-catamaran','squeezing-bathyscaphe','idrenes-composite-tekne'];
  for (const r of routes) {
    app.agentPlotRoute(r.stops);
    const physLy = app._routePhysicalLy();
    const perDrive = {};
    for (const d of driveIds) {
      const res = app.agentSetDrive(d) || {};
      perDrive[d] = { sc: app.drive.sc, T: +app._flightDuration().toFixed(1) };
    }
    cases.push({ route: r.name, physLy: Math.round(physLy), perDrive });
  }
  return cases;
});

// 2) real timed flight: short route, fast drive vs slow drive — measure wall-clock
async function timeFlight(stops, driveId) {
  await page.evaluate(({stops, driveId}) => {
    const app = window.__universe;
    app.setMode('cosmos');
    app.agentSetDrive(driveId);
    app.agentPlotRoute(stops);
    window.__navDone = false;
    app.on('nav', (n) => { if (n && n.arrived) window.__navDone = true; });
    app.engageRoute();
    window.__t0 = performance.now();
  }, {stops, driveId});
  // poll until arrived (or timeout)
  let elapsed = 0;
  for (let i=0;i<200;i++){ await sleep(500); const done = await page.evaluate(()=>window.__navDone); if(done){ elapsed = await page.evaluate(()=>performance.now()-window.__t0); break; } }
  return Math.round(elapsed/100)/10;
}
// Andromeda at relativistic (0.994c, slow) vs Class ω (fast) — expect slow > fast
const tSlow = await timeFlight([{name:'Sol'},{name:'Andromeda Galaxy (M31)'}], 'relativistic');
const tFast = await timeFlight([{name:'Sol'},{name:'Andromeda Galaxy (M31)'}], 'idrenes-composite-tekne');

console.log('SWEEP:', JSON.stringify(sweep, null, 2));
console.log('TIMED Andromeda relativistic(0.994c):', tSlow, 's  |  Class ω:', tFast, 's');
console.log('CONSOLE ERRORS:', errs.length ? errs.slice(0,6) : 'none');
await browser.close(); preview.kill('SIGTERM');
