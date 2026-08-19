// Builds the "Where to?" leaderboard: the buses — across every matching route —
// that will arrive at the origin stop soonest, sorted by ETA to that stop.
export function buildRecommendations({ fromStop, toStop, matchingRoutes, liveBuses, limit = 3 }) {
  const routeById = Object.fromEntries(matchingRoutes.map((r) => [r.route_id, r]));
  const originKey = String(fromStop.stop_id);

  return liveBuses
    .filter((b) => !b.is_stale && routeById[b.route_id])
    .map((b) => {
      const eta = b.etas?.[originKey];
      if (!eta || eta.eta_seconds == null) return null;
      const route = routeById[b.route_id];
      return {
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
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.eta_seconds - b.eta_seconds)
    .slice(0, limit);
}