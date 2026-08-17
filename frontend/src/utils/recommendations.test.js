import { describe, it, expect } from 'vitest';
import { buildRecommendations } from './recommendations';

const routes = [
  { route_id: '44886', route_name: 'Central East', color: '#075CFF', isSelected: true },
  { route_id: '73972', route_name: 'Weekender West', color: '#00A651', isSelected: false },
];

const fromStop = { stop_id: '1', name: 'Crescent A' };
const toStop = { stop_id: '2', name: 'East Campus Village' };

const liveBuses = [
  { bus_id: 'b1', bus_name: '96316', route_id: '44886', is_stale: false, next_stop: 'Crescent A', eta_display: '4 min', eta_source: 'live', eta_seconds: 240 },
  { bus_id: 'b2', bus_name: '12345', route_id: '44886', is_stale: false, next_stop: 'Mell Hall', eta_display: '10 min', eta_source: 'estimated', eta_seconds: 600 },
  { bus_id: 'b3', bus_name: '22222', route_id: '44886', is_stale: true, next_stop: 'Lot E01', eta_display: '2 min', eta_source: 'live', eta_seconds: 120 },
  { bus_id: 'b4', bus_name: '77777', route_id: '73972', is_stale: false, next_stop: 'West Campus', eta_display: '8 min', eta_source: 'live', eta_seconds: 480 },
];

describe('buildRecommendations', () => {
  it('lists the actual buses on each matching route with their info', () => {
    const recs = buildRecommendations({ fromStop, toStop, matchingRoutes: routes, liveBuses });

    const centralEast = recs.find((r) => r.route_id === '44886');
    expect(centralEast).toBeTruthy();
    expect(centralEast.buses).toHaveLength(2);
    expect(centralEast.buses[0]).toMatchObject({
      bus_name: '96316',
      next_stop: 'Crescent A',
      eta_display: '4 min',
      eta_source: 'live',
    });

    const weekender = recs.find((r) => r.route_id === '73972');
    expect(weekender.buses[0]).toMatchObject({ bus_name: '77777', eta_display: '8 min' });
  });

  it('excludes stale buses from the candidate list', () => {
    const recs = buildRecommendations({ fromStop, toStop, matchingRoutes: routes, liveBuses });
    const centralEast = recs.find((r) => r.route_id === '44886');
    expect(centralEast.buses.every((b) => b.bus_id !== 'b3')).toBe(true);
  });

  it('limits buses per route', () => {
    const manyBuses = Array.from({ length: 6 }, (_, i) => ({
      bus_id: `x${i}`, bus_name: `B${i}`, route_id: '44886', is_stale: false,
      next_stop: 'Crescent A', eta_display: '3 min', eta_source: 'live', eta_seconds: 180,
    }));
    const recs = buildRecommendations({ fromStop, toStop, matchingRoutes: routes, liveBuses: manyBuses, limit: 3 });
    expect(recs[0].buses).toHaveLength(3);
  });
});