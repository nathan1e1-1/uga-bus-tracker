function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6_371_000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function groupRoutes(routes) {
  const byName = new Map();
  for (const route of routes) {
    const list = byName.get(route.route_name) || [];
    list.push(route);
    byName.set(route.route_name, list);
  }
  return Array.from(byName.entries()).map(([displayName, items]) => ({
    displayName,
    ids: items.map((r) => r.route_id),
  }));
}

export function resolveDirectionByLocation(group, shapes, userLocation) {
  let bestId = null;
  let bestDistance = Infinity;
  for (const id of group.ids) {
    const shape = shapes[id];
    if (!shape?.stops?.length) continue;
    for (const stop of shape.stops) {
      const d = haversineMeters(
        userLocation.lat,
        userLocation.lng,
        stop.latitude ?? stop.lat,
        stop.longitude ?? stop.lng
      );
      if (d < bestDistance) {
        bestDistance = d;
        bestId = id;
      }
    }
  }
  return bestId;
}

export function resolveDirectionByStops(group, shapes, fromStopId, toStopId) {
  for (const id of group.ids) {
    const shape = shapes[id];
    if (!shape?.stops?.length) continue;
    const fromIndex = shape.stops.findIndex((s) => String(s.stop_id) === String(fromStopId));
    const toIndex = shape.stops.findIndex((s) => String(s.stop_id) === String(toStopId));
    if (fromIndex !== -1 && toIndex !== -1 && fromIndex < toIndex) {
      return id;
    }
  }
  return null;
}

export function getOppositeDirectionId(group, currentId) {
  if (group.ids.length < 2) return null;
  const index = group.ids.indexOf(currentId);
  if (index === -1) return null;
  return group.ids[(index + 1) % group.ids.length];
}
