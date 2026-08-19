// Builds the "Where to?" leaderboard: one bus per route — the fastest bus on
// each matching route — sorted by ETA to the origin stop, so the top-3 always
// come from 3 different routes.
export function buildRecommendations({ fromStop, toStop, matchingRoutes, liveBuses, limit = 3 }) {
  const routeById = Object.fromEntries(matchingRoutes.map((r) => [r.route_id, r]));
  const originKey = String(fromStop.stop_id);

  const fastestByRoute = new Map();

  for (const b of liveBuses) {
    if (b.is_stale || !routeById[b.route_id]) continue;
    const eta = b.etas?.[originKey];
    if (!eta || eta.eta_seconds == null) continue;

    const existing = fastestByRoute.get(b.route_id);
    if (existing && eta.eta_seconds >= existing.eta_seconds) continue;

    const route = routeById[b.route_id];
    fastestByRoute.set(b.route_id, {
      bus_id: b.bus_id,
      bus_name: b.bus_name,
      route_id: b.route_id,
      route_name: route.route_name,
      route_color: route.color,
      from_stop: fromStop.name,
      to_stop: toStop.name,
      next_stop: b.next_stop,
      eta_seconds: eta.eta_seconds,
      eta_display: eta.eta_display,
      eta_source: eta.eta_source,
      isSelected: route.isSelected === true,
    });
  }

  return Array.from(fastestByRoute.values())
    .sort((a, b) => a.eta_seconds - b.eta_seconds)
    .slice(0, limit);
}