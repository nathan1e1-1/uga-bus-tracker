import { describe, it, expect } from 'vitest';
import { buildRecommendations } from './recommendations';

const routes = [
  { route_id: '44886', route_name: 'Central East', color: '#075CFF', isSelected: true },
  { route_id: '73972', route_name: 'Weekender West', color: '#00A651', isSelected: false },
];

const fromStop = { stop_id: '1', name: 'Crescent A' };
const toStop = { stop_id: '2', name: 'East Campus Village' };

const liveBuses = [
  { bus_id: 'b1', bus_name: '96316', route_id: '44886', is_stale: false, next_stop: 'Crescent A', etas: { '1': { eta_seconds: 240, eta_display: '4 min', eta_source: 'live' } } },
  { bus_id: 'b2', bus_name: '12345', route_id: '44886', is_stale: false, next_stop: 'Mell Hall', etas: { '1': { eta_seconds: 600, eta_display: '10 min', eta_source: 'estimated' } } },
  { bus_id: 'b3', bus_name: '22222', route_id: '44886', is_stale: true, next_stop: 'Lot E01', etas: { '1': { eta_seconds: 120, eta_display: '2 min', eta_source: 'live' } } },
  { bus_id: 'b4', bus_name: '77777', route_id: '73972', is_stale: false, next_stop: 'West Campus', etas: { '1': { eta_seconds: 480, eta_display: '8 min', eta_source: 'live' } } },
  { bus_id: 'b5', bus_name: '55555', route_id: '44886', is_stale: false, next_stop: 'Mell Hall', etas: { '999': { eta_seconds: 60, eta_display: '1 min', eta_source: 'live' } } },
];

describe('buildRecommendations', () => {
  it('returns a flat top-3 list sorted by ETA to the origin stop', () => {
    const recs = buildRecommendations({ fromStop, toStop, matchingRoutes: routes, liveBuses });
    expect(recs).toHaveLength(3);
    expect(recs.map((r) => r.bus_id)).toEqual(['b1', 'b4', 'b2']);
  });

  it('excludes stale buses and buses with no ETA to the origin stop', () => {
    const recs = buildRecommendations({ fromStop, toStop, matchingRoutes: routes, liveBuses });
    const ids = recs.map((r) => r.bus_id);
    expect(ids).not.toContain('b3');
    expect(ids).not.toContain('b5');
  });

  it('includes route and stop info for display', () => {
    const [top] = buildRecommendations({ fromStop, toStop, matchingRoutes: routes, liveBuses });
    expect(top).toMatchObject({
      bus_id: 'b1',
      bus_name: '96316',
      route_id: '44886',
      route_name: 'Central East',
      route_color: '#075CFF',
      from_stop: 'Crescent A',
      to_stop: 'East Campus Village',
      eta_display: '4 min',
      eta_source: 'live',
    });
  });

  it('limits results to the requested count', () => {
    const recs = buildRecommendations({ fromStop, toStop, matchingRoutes: routes, liveBuses, limit: 2 });
    expect(recs).toHaveLength(2);
  });

  it('returns fewer when fewer buses qualify', () => {
    const recs = buildRecommendations({ fromStop, toStop, matchingRoutes: routes, liveBuses: [liveBuses[0]] });
    expect(recs).toHaveLength(1);
  });
});