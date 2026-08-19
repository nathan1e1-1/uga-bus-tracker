import { describe, it, expect } from 'vitest';
import { buildRecommendations } from './recommendations';

const routes = [
  { route_id: '44886', route_name: 'Central East', color: '#075CFF', isSelected: true },
  { route_id: '73972', route_name: 'Weekender West', color: '#00A651', isSelected: false },
  { route_id: '53275', route_name: 'Chicopee Shuttle', color: '#EF00B7', isSelected: false },
];

const fromStop = { stop_id: '1', name: 'Crescent A' };
const toStop = { stop_id: '2', name: 'East Campus Village' };

const bus = (id, route_id, eta_seconds) => ({
  bus_id: id,
  bus_name: id.toUpperCase(),
  route_id,
  is_stale: false,
  next_stop: 'Some Stop',
  etas: { '1': { eta_seconds, eta_display: `${eta_seconds / 60} min`, eta_source: 'live' } },
});

describe('buildRecommendations', () => {
  it('returns one bus per route, sorted by ETA, across 3 different routes', () => {
    const liveBuses = [
      bus('b1', '44886', 240),
      bus('b2', '44886', 600),   // same route as b1, slower -> dropped
      bus('b4', '73972', 480),
      bus('b5', '53275', 300),
    ];
    const recs = buildRecommendations({ fromStop, toStop, matchingRoutes: routes, liveBuses });

    expect(recs).toHaveLength(3);
    expect(recs.map((r) => r.route_id)).toEqual(['44886', '53275', '73972']);
    expect(new Set(recs.map((r) => r.route_id)).size).toBe(3);
  });

  it('keeps only the fastest bus when several share a route', () => {
    const liveBuses = [
      bus('slow', '44886', 900),
      bus('fast', '44886', 120),
      bus('mid', '44886', 400),
    ];
    const recs = buildRecommendations({ fromStop, toStop, matchingRoutes: routes, liveBuses });

    expect(recs).toHaveLength(1);
    expect(recs[0].bus_id).toBe('fast');
  });

  it('excludes stale buses and buses with no ETA to the origin stop', () => {
    const liveBuses = [
      { ...bus('stale', '44886', 120), is_stale: true },
      { bus_id: 'noeta', bus_name: 'NOETA', route_id: '73972', is_stale: false, next_stop: 'X', etas: { '999': { eta_seconds: 60, eta_display: '1 min', eta_source: 'live' } } },
      bus('good', '44886', 300),
    ];
    const recs = buildRecommendations({ fromStop, toStop, matchingRoutes: routes, liveBuses });

    expect(recs.map((r) => r.bus_id)).toEqual(['good']);
  });

  it('includes route and stop info for display', () => {
    const [top] = buildRecommendations({ fromStop, toStop, matchingRoutes: routes, liveBuses: [bus('b1', '44886', 240)] });
    expect(top).toMatchObject({
      bus_id: 'b1',
      bus_name: 'B1',
      route_id: '44886',
      route_name: 'Central East',
      route_color: '#075CFF',
      from_stop: 'Crescent A',
      to_stop: 'East Campus Village',
    });
  });

  it('limits results to the requested count', () => {
    const liveBuses = [bus('a', '44886', 100), bus('b', '73972', 200), bus('c', '53275', 300)];
    const recs = buildRecommendations({ fromStop, toStop, matchingRoutes: routes, liveBuses, limit: 2 });
    expect(recs).toHaveLength(2);
  });
});