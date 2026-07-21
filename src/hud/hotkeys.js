// Global keyboard shortcuts. Kept inert while a text field is focused or an
// overlay is open. The manual (? / F1) documents the same set — keep them in sync.
export function initHotkeys(app) {
  window.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // let open overlays handle their own keys (their Esc closes them)
    if (overlayOpen()) return;

    const sel = app.selection?.info;
    switch (e.key) {
      case '1': app.setMode('local'); break;
      case '2': app.setMode('cosmos'); break;
      case '3': app.setMode('system'); break;
      case '4': app.setMode('deeptime'); break;
      case 'h': case 'H': app.home(); break;
      case '/': e.preventDefault(); document.getElementById('search')?.focus(); break;
      case '?': app._openManual?.(); break;
      case 'F1': e.preventDefault(); app._openManual?.(); break;
      case 'c': case 'C': document.getElementById('codex-btn')?.click(); break;
      case 'f': case 'F': if (sel) app.setFocus(); break;
      case 'r': case 'R': if (sel) app.addRouteWaypoint(); break;
      case 'p': case 'P': app.setPlotCourse(!app.plotCourse); break;
      case 'g': case 'G':
        if (app.mode === 'deeptime') {
          if (app.deeptime?.interior) app.deeptimeExitToOverview();
          else if (sel?.dtDesc) app.deeptimeEnterGalaxy(sel.dtDesc);
        } else if (app._inGalaxy) { app.autopilot?.atGalaxy ? app.resumeFromGalaxy() : app.exitGalaxy(); }
        else if (sel && galaxyish(sel)) app.enterGalaxy(sel);
        break;
      case 's': case 'S': app.setSectorGrid(!app.showSectorGrid); break;
      case 'b': case 'B': app.setGalaxyImagery(!app.showGalaxyImagery); break;
      case 'v': case 'V': app.setResolveStructures(!app.resolveStructures); break;
      case 't': case 'T': app.setTrackPanel(!app.showTrackPanel); break;
      case ' ': e.preventDefault(); engageOrPause(app); break;
      case '[': step(app, -1); break;
      case ']': step(app, 1); break;
      case '-': case '_': if (app.autopilot) app.setFlightRate((app._flightRate || 1) / 2); break;
      case '=': case '+': if (app.autopilot) app.setFlightRate((app._flightRate || 1) * 2); break;
      case 'Escape': escape(app); break;
      default: return;
    }
  });
}

function overlayOpen() {
  return ['manual', 'codex'].some((id) => { const o = document.getElementById(id); return o && !o.hidden; });
}
function galaxyish(sel) {
  if (sel.kind === 'galaxy' || sel.kind === 'localgalaxy') return true;
  if (sel.kind === 'procedural' && sel.pType === 'galaxy') return true;
  return /galax|spiral|elliptical|irregular|lenticular|magellanic|starburst|dwarf sph/i.test(`${sel.type || ''} ${sel.categoryLabel || ''} ${sel.sub || ''}`);
}
function engageOrPause(app) {
  if (app.autopilot) { app.autopilot.atGalaxy ? app.resumeFromGalaxy() : app.pauseRoute(); }
  else if ((app.route || []).length >= 2) app.engageRoute();
}
function step(app, d) {
  if (app.cruise) app.cruiseStep(d);
  else if (app.voyage) app.voyageStep(d);
  else if (app.autopilot) app.navStep(d);
}
function escape(app) {
  if (app.mode === 'deeptime' && app.deeptime?.interior) { app.deeptimeExitToOverview(); }
  else if (app._inGalaxy) { if (app.autopilot?.atGalaxy) app.resumeFromGalaxy(); else if (app.cruise) app.stopCruise(); else app.exitGalaxy(); }
  else if (app.cruise) app.stopCruise();
  else if (app.autopilot) app.stopRoute();
  else if (app.plotCourse) app.setPlotCourse(false);
  else if (app.selection) app.clearSelection();
  else if ((app.route || []).length) app.clearRoute();
}
