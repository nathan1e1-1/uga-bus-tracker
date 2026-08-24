import { haversineDistance } from '../hooks/useGeolocation';

const WALK_SPEED_MPS = 1.3; // ~3 mph comfortable campus pace

// Builds the plain-language, step-by-step trip for a new student:
//   walk to origin stop -> bus arrives -> ride to destination -> get off.
// Expects the chosen origin stop, destination stop, and the single best bus
// for the trip (the #1 recommendation). Returns null-safe times.
export function getTripItinerary({ originStop, toStop, userLocation, bus, routeName }) {
  const originKey = String(originStop.stop_id);
  const destKey = String(toStop.stop_id);

  const originEta = bus?.etas?.[originKey]?.eta_seconds ?? null;
  const destEta = bus?.etas?.[destKey]?.eta_seconds ?? null;

  // Walk: straight-line distance from the user to the origin stop.
  let walkLine = null;
  let walkMin = null;
  if (userLocation) {
    const walkMeters = haversineDistance(
      userLocation.lat,
      userLocation.lng,
      originStop.latitude ?? originStop.lat,
      originStop.longitude ?? originStop.lng
    );
    walkLine = [
      [userLocation.lat, userLocation.lng],
      [originStop.latitude ?? originStop.lat, originStop.longitude ?? originStop.lng],
    ];
    walkMin = Math.max(1, Math.ceil(walkMeters / WALK_SPEED_MPS / 60));
  }

  // Bus arrival at the origin stop.
  const arriveMin = originEta != null ? Math.max(1, Math.ceil(originEta / 60)) : null;

  // Ride: time from origin stop to destination stop.
  const rideMin =
    originEta != null && destEta != null
      ? Math.max(1, Math.ceil((destEta - originEta) / 60))
      : null;

  return {
    originStop,
    getOffStop: toStop,
    routeName,
    busName: bus?.bus_name ?? null,
    walkLine,
    walkMin,
    arriveMin,
    rideMin,
  };
}