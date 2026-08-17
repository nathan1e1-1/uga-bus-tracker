// Decides when the map should auto-fit to the route bounds.
// We only fit when the selection changes — never on bus-position polls,
// so the user's zoom/pan is preserved while buses move underneath.
export function shouldRefit({ routeId, fittedRouteId, hasBounds }) {
  if (!hasBounds) return false;
  return fittedRouteId !== (routeId ?? 'all');
}