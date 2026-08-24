import { describe, it, expect } from 'vitest';
import { getTripItinerary } from './itinerary';

const originStop = {
  stop_id: '155117', name: 'Coliseum/SLC Westbound',
  latitude: 33.942, longitude: -83.375,
};
const toStop = {
  stop_id: '155100', name: 'Tate Center - Memorial Hall',
  latitude: 33.949, longitude: -83.374,
};

const routeName = 'Main Campus';

// A bus that will reach the origin stop in 3 min and the destination in 8 min.
const bus = {
  bus_id: 'b1',
  bus_name: '96316',
  etas: {
    '155117': { eta_seconds: 180, eta_display: '3 min', eta_source: 'live' },
    '155100': { eta_seconds: 480, eta_display: '8 min', eta_source: 'live' },
  },
};

describe('getTripItinerary', () => {
  it('computes walk, arrive, and ride minutes plus a walk line', () => {
    const trip = getTripItinerary({
      originStop,
      toStop,
      userLocation: { lat: 33.9422, lng: -83.3751 },
      bus,
      routeName,
    });

    // ~24 m walk at 1.3 m/s rounds UP to 1 minute.
    expect(trip.walkMin).toBe(1);
    expect(trip.arriveMin).toBe(3);
    // Difference between destination ETA (8 min) and origin ETA (3 min).
    expect(trip.rideMin).toBe(5);

    expect(trip).toMatchObject({
      routeName: 'Main Campus',
      busName: '96316',
      originStop,
      getOffStop: toStop,
    });

    // Straight dashed line from the user's location to the origin stop.
    expect(trip.walkLine).toEqual([
      [33.9422, -83.3751],
      [33.942, -83.375],
    ]);
  });

  it('leaves walkMin null when there is no user location', () => {
    const trip = getTripItinerary({
      originStop,
      toStop,
      userLocation: null,
      bus,
      routeName,
    });
    expect(trip.walkMin).toBeNull();
    expect(trip.walkLine).toBeNull();
    expect(trip.arriveMin).toBe(3);
  });

  it('leaves arriveMin null when the bus has no origin ETA', () => {
    const trip = getTripItinerary({
      originStop,
      toStop,
      userLocation: null,
      bus: { ...bus, etas: {} },
      routeName,
    });
    expect(trip.arriveMin).toBeNull();
    expect(trip.rideMin).toBeNull();
  });
});