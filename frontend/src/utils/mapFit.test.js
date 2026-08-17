import { describe, it, expect } from 'vitest';
import { shouldRefit } from './mapFit';

describe('shouldRefit', () => {
  it('never fits when there are no bounds', () => {
    expect(shouldRefit({ routeId: null, fittedRouteId: null, hasBounds: false })).toBe(false);
  });

  it('fits once on first load with no route selected', () => {
    expect(shouldRefit({ routeId: null, fittedRouteId: null, hasBounds: true })).toBe(true);
  });

  it('does not refit on subsequent bus polls with no route', () => {
    expect(shouldRefit({ routeId: null, fittedRouteId: 'all', hasBounds: true })).toBe(false);
  });

  it('fits when a route is first selected', () => {
    expect(shouldRefit({ routeId: '44886', fittedRouteId: 'all', hasBounds: true })).toBe(true);
  });

  it('keeps the user zoom when the same route polls again (buses move)', () => {
    expect(shouldRefit({ routeId: '44886', fittedRouteId: '44886', hasBounds: true })).toBe(false);
  });

  it('refits when the route changes (direction/route switch)', () => {
    expect(shouldRefit({ routeId: '73972', fittedRouteId: '44886', hasBounds: true })).toBe(true);
  });
});