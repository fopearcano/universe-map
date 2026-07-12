// Thematic sub-groups for the Ledger of Ways. Commercial and military routes are
// each split into a handful of groups (by the route's `kind`) so the overlay can
// be toggled group-by-group from a dropdown, not just commercial-vs-military.
// Groups are listed in display order; matching walks that order and the first
// group whose pattern hits the kind wins, falling back to the category's first
// group so every route lands somewhere.

export const ROUTE_GROUPS = {
  commercial: [
    { key: 'trade',   label: 'Trade & bulk',    match: /trade|spice|silk|grain|exchange|glass|bulk|barter/ },
    { key: 'courier', label: 'Courier',         match: /courier|short-haul|packet|post/ },
    { key: 'ore',     label: 'Ore & salvage',   match: /ore|salvage|fuel|survey|mining/ },
    { key: 'pilgrim', label: 'Pilgrim & relic', match: /pilgrim|relic|shrine/ },
    { key: 'supply',  label: 'Supply & ferry',  match: /supply|ferry|freight/ },
  ],
  military: [
    { key: 'patrol',   label: 'Patrol & picket',   match: /patrol|picket|sweep|watch/ },
    { key: 'war',      label: 'War & siege',       match: /war|siege|strike|assault|raid/ },
    { key: 'blockade', label: 'Blockade & screen', match: /blockade|screen|stealth|corridor/ },
    { key: 'fortress', label: 'Fortress & relief', match: /fortress|capital|relief|resupply|exile|garrison|ring/ },
  ],
};

// Resolve a route's group key from its category + kind.
export function routeGroup(category, kind) {
  const groups = ROUTE_GROUPS[category] || [];
  const k = String(kind || '').toLowerCase();
  for (const g of groups) if (g.match.test(k)) return g.key;
  return groups.length ? groups[0].key : 'other';
}

// "commercial:trade" → { cat, group } (for the network bucket keys).
export const groupKey = (category, group) => `${category}:${group}`;
