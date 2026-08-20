// Chooses the best "from" stop near the user's location to reach a destination.
//
// Efficiency is ranked primarily by fewest stops forward along the route
// (wrap-aware for loop routes). When two candidate stops reach the destination
// equally efficiently, the one with a bus arriving sooner (ETA) wins.
//
// Returns { fromStop, routeId, forwardStops } or null if no candidate shares a
// route with the destination.
export function pickOptimalOrigin({ candidateStops, toStop, routeStopCounts, liveBuses = [] }) {
  const destRouteIds = toStop.route_ids || [];
  const destPositions = toStop.route_positions || {};

  const etaByStopAndRoute = new Map();
  for (const bus of liveBuses) {
    if (bus.is_stale) continue;
    for (const stop of candidateStops) {
      const eta = bus.etas?.[String(stop.stop_id)];
      if (eta && eta.eta_seconds != null) {
        const key = `${stop.stop_id}:${bus.route_id}`;
        const existing = etaByStopAndRoute.get(key);
        if (!existing || eta.eta_seconds < existing.eta_seconds) {
          etaByStopAndRoute.set(key, eta.eta_seconds);
        }
      }
    }
  }

  let best = null;

  for (const fromStop of candidateStops) {
    const fromPositions = fromStop.route_positions || {};
    const fromRouteIds = fromStop.route_ids || [];

    for (const routeId of destRouteIds) {
      if (!fromRouteIds.includes(routeId)) continue;
      const fromPos = fromPositions[routeId];
      const toPos = destPositions[routeId];
      const count = routeStopCounts[routeId];
      if (fromPos == null || toPos == null || !count) continue;

      const forwardStops = ((toPos - fromPos) % count + count) % count;

      // Favor fewer stops forward; tie-break by soonest arriving bus.
      const etaKey = `${fromStop.stop_id}:${routeId}`;
      const eta = etaByStopAndRoute.get(etaKey) ?? Infinity;

      const better =
        best == null ||
        forwardStops < best.forwardStops ||
        (forwardStops === best.forwardStops && eta < best.eta);

      if (better) {
        best = { fromStop, routeId, forwardStops, eta };
      }
    }
  }

  if (!best) return null;
  return { fromStop: best.fromStop, routeId: best.routeId, forwardStops: best.forwardStops };
}