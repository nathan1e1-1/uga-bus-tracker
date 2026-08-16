import { groupRoutes, resolveDirectionByLocation, resolveDirectionByStops, getOppositeDirectionId } from './routeGroups';

describe('groupRoutes', () => {
  it('groups routes with identical names', () => {
    const routes = [
      { route_id: '1', route_name: 'Central East' },
      { route_id: '2', route_name: 'Weekender' },
      { route_id: '3', route_name: 'Weekender' },
    ];
    const groups = groupRoutes(routes);
    expect(groups).toEqual([
      { displayName: 'Central East', ids: ['1'] },
      { displayName: 'Weekender', ids: ['2', '3'] },
    ]);
  });
});

describe('resolveDirectionByLocation', () => {
  it('picks direction whose nearest stop is closest', () => {
    const groups = { displayName: 'Weekender', ids: ['A', 'B'] };
    const shapes = {
      A: { stops: [{ stop_id: 1, latitude: 0, longitude: 0 }] },
      B: { stops: [{ stop_id: 2, latitude: 10, longitude: 10 }] },
    };
    const userLocation = { lat: 0.001, lng: 0.001 };
    expect(resolveDirectionByLocation(groups, shapes, userLocation)).toBe('A');
  });

  it('returns null if no shapes', () => {
    const groups = { displayName: 'Weekender', ids: ['A'] };
    expect(resolveDirectionByLocation(groups, {}, { lat: 0, lng: 0 })).toBeNull();
  });

  it('returns null if userLocation is missing', () => {
    const group = { displayName: 'Weekender', ids: ['A'] };
    const shapes = { A: { stops: [{ stop_id: 1, latitude: 0, longitude: 0 }] } };
    expect(resolveDirectionByLocation(group, shapes, null)).toBeNull();
    expect(resolveDirectionByLocation(group, shapes, undefined)).toBeNull();
    expect(resolveDirectionByLocation(group, shapes, {})).toBeNull();
  });
});

describe('resolveDirectionByStops', () => {
  it('picks direction where from stop appears before to stop', () => {
    const groups = { displayName: 'Weekender', ids: ['A', 'B'] };
    const shapes = {
      A: { stops: [{ stop_id: 1 }, { stop_id: 2 }] },
      B: { stops: [{ stop_id: 2 }, { stop_id: 1 }] },
    };
    expect(resolveDirectionByStops(groups, shapes, '1', '2')).toBe('A');
  });

  it('returns null if stops not found in any direction', () => {
    const groups = { displayName: 'Weekender', ids: ['A'] };
    const shapes = { A: { stops: [{ stop_id: 1 }] } };
    expect(resolveDirectionByStops(groups, shapes, '99', '88')).toBeNull();
  });
});

describe('getOppositeDirectionId', () => {
  it('returns the other id in the group', () => {
    const groups = { displayName: 'Weekender', ids: ['A', 'B'] };
    expect(getOppositeDirectionId(groups, 'A')).toBe('B');
    expect(getOppositeDirectionId(groups, 'B')).toBe('A');
  });

  it('returns null for single-id groups', () => {
    const groups = { displayName: 'Central East', ids: ['1'] };
    expect(getOppositeDirectionId(groups, '1')).toBeNull();
  });
});
