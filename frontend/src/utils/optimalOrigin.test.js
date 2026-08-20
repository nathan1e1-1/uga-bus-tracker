import { describe, it, expect } from 'vitest';
import { pickOptimalOrigin } from './optimalOrigin';

// Modeled on route 72874 (Main Campus): 21 stops (positions 1..21).
const ROUTE = '72874';
const ROUTE_STOP_COUNTS = { [ROUTE]: 21 };

const coliseumWest = {
  stop_id: '155117', name: 'Coliseum/SLC Westbound',
  latitude: 33.942, longitude: -83.375,
  route_ids: [ROUTE], route_positions: { [ROUTE]: 6 },
};
const coliseumEast = {
  stop_id: '155115', name: 'Coliseum/SLC Eastbound',
  latitude: 33.942, longitude: -83.374,
  route_ids: [ROUTE], route_positions: { [ROUTE]: 17 },
};
const joeFrank = {
  stop_id: '155132', name: 'Joe Frank Harris Commons',
  route_ids: [ROUTE], route_positions: { [ROUTE]: 19 },
};
const tateMemorial = {
  stop_id: '155100', name: 'Tate Center - Memorial Hall',
  route_ids: [ROUTE], route_positions: { [ROUTE]: 9 },
};

const candidateStops = [coliseumWest, coliseumEast];

describe('pickOptimalOrigin', () => {
  it('picks the eastbound stop for a destination to the east (Joe Frank)', () => {
    const result = pickOptimalOrigin({
      candidateStops,
      toStop: joeFrank,
      routeStopCounts: ROUTE_STOP_COUNTS,
    });
    expect(result.fromStop.stop_id).toBe('155115'); // Eastbound
    expect(result.routeId).toBe(ROUTE);
    // Eastbound is 2 stops from Joe Frank; Westbound would be 13.
    expect(result.forwardStops).toBe(2);
  });

  it('picks the westbound stop for a destination to the west (Tate)', () => {
    const result = pickOptimalOrigin({
      candidateStops,
      toStop: tateMemorial,
      routeStopCounts: ROUTE_STOP_COUNTS,
    });
    expect(result.fromStop.stop_id).toBe('155117'); // Westbound
    expect(result.forwardStops).toBe(3);
  });

  it('tie-breaks equal-efficiency stops by soonest-arriving bus ETA', () => {
    // Westbound reaches the destination in 3 stops via route RA (20 stops),
    // Eastbound reaches it in 3 stops via route RB (20 stops). Equal ride
    // efficiency, so the stop with a bus arriving sooner should win.
    const dest = {
      stop_id: '777', name: 'Equal Stop',
      route_ids: ['RA', 'RB'],
      route_positions: { RA: 10, RB: 10 },
    };
    const westStopsRA = { ...coliseumWest, route_ids: ['RA'], route_positions: { RA: 7 } };
    const eastStopsRB = { ...coliseumEast, route_ids: ['RB'], route_positions: { RB: 7 } };

    const liveBuses = [
      { bus_id: 'b1', route_id: 'RA', is_stale: false, etas: { '155117': { eta_seconds: 400, eta_display: '6 min', eta_source: 'live' } } },
      { bus_id: 'b2', route_id: 'RB', is_stale: false, etas: { '155115': { eta_seconds: 120, eta_display: '2 min', eta_source: 'live' } } },
    ];
    const result = pickOptimalOrigin({
      candidateStops: [westStopsRA, eastStopsRB],
      toStop: dest,
      routeStopCounts: { RA: 20, RB: 20 },
      liveBuses,
    });
    expect(result.fromStop.stop_id).toBe('155115'); // soonest bus (2 min)
  });

  it('returns null when no candidate stop shares a route with the destination', () => {
    const result = pickOptimalOrigin({
      candidateStops,
      toStop: { stop_id: '999', name: 'Far', route_ids: ['OTHER'], route_positions: { OTHER: 1 } },
      routeStopCounts: ROUTE_STOP_COUNTS,
    });
    expect(result).toBeNull();
  });
});