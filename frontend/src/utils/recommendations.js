// Builds "Where to?" recommendations: for each route that serves both the
// origin and destination stops, list the live buses on that route with their
// name, next stop, and ETA so the user can see which bus to take.
export function buildRecommendations({ fromStop, toStop, matchingRoutes, liveBuses, limit = 4 }) {
  return matchingRoutes.map((route) => {
    const buses = liveBuses
      .filter((b) => b.route_id === route.route_id && !b.is_stale)
      .slice(0, limit)
      .map((b) => ({
        bus_id: b.bus_id,
        bus_name: b.bus_name,
        next_stop: b.next_stop,
        eta_display: b.eta_display,
        eta_source: b.eta_source,
        eta_seconds: b.eta_seconds,
      }));

    return {
      route_id: route.route_id,
      route_name: route.route_name,
      route_color: route.color,
      from_stop: fromStop.name,
      to_stop: toStop.name,
      buses,
      isSelected: route.isSelected,
    };
  });
}