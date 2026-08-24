import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRouteShapes } from './useRouteShapes';

const ROUTE_GROUPS = [{ displayName: 'Central East', ids: ['44886', '53275'] }];
const shapeFor = (id) => ({
  route_id: id,
  route_name: 'Central East',
  color: '#075CFF',
  polyline: [{ lat: 33.95, lng: -83.38 }],
  stops: [{ stop_id: '1', name: 'Stop 1', latitude: 33.95, longitude: -83.38 }],
});

function renderWith({ fetchShape, onPicked, userLocation }) {
  return renderHook(
    ({ userLocation }) =>
      useRouteShapes({
        selectedGroupName: 'Central East',
        routeGroups: ROUTE_GROUPS,
        userLocation,
        hasManualDirection: false,
        selectedRouteId: null,
        onPicked,
        fetchShape,
      }),
    { initialProps: { userLocation } }
  );
}

describe('useRouteShapes', () => {
  it('does not refetch shapes when the user location changes', async () => {
    const fetchShape = vi.fn((id) => Promise.resolve(shapeFor(id)));
    const onPicked = vi.fn();

    const { rerender, result } = renderWith({ fetchShape, onPicked, userLocation: { lat: 33.95, lng: -83.38 } });

    await waitFor(() => expect(fetchShape).toHaveBeenCalledTimes(2));

    // Geolocation watch produces a NEW userLocation object repeatedly.
    rerender({ userLocation: { lat: 33.951, lng: -83.381 } });
    await waitFor(() => expect(fetchShape).toHaveBeenCalledTimes(2));
    rerender({ userLocation: { lat: 33.952, lng: -83.382 } });
    await waitFor(() => expect(fetchShape).toHaveBeenCalledTimes(2));

    expect(result.current.routeShape).toBeTruthy();
  });

  it('resolves direction once when location arrives after route selection', async () => {
    const fetchShape = vi.fn((id) => Promise.resolve(shapeFor(id)));
    const onPicked = vi.fn();

    const { rerender, result } = renderWith({ fetchShape, onPicked, userLocation: null });

    await waitFor(() => expect(fetchShape).toHaveBeenCalledTimes(2));

    rerender({ userLocation: { lat: 33.95, lng: -83.38 } });
    await waitFor(() => expect(onPicked).toHaveBeenCalled());
    expect(ROUTE_GROUPS[0].ids).toContain(onPicked.mock.calls[0][0]);

    // A later location update must not re-resolve / re-fetch.
    rerender({ userLocation: { lat: 33.951, lng: -83.381 } });
    await waitFor(() => expect(fetchShape).toHaveBeenCalledTimes(2));
    expect(result.current.routeShape).toBeTruthy();
  });

  it('reuses cached shapes when switching direction within the same group', async () => {
    const fetchShape = vi.fn((id) => Promise.resolve(shapeFor(id)));
    const onPicked = vi.fn();

    const { rerender } = renderHook(
      ({ selectedRouteId, hasManualDirection }) =>
        useRouteShapes({
          selectedGroupName: 'Central East',
          routeGroups: ROUTE_GROUPS,
          userLocation: null,
          hasManualDirection,
          selectedRouteId,
          onPicked,
          fetchShape,
        }),
      { initialProps: { selectedRouteId: null, hasManualDirection: false } }
    );

    await waitFor(() => expect(fetchShape).toHaveBeenCalledTimes(2));

    // Reverse button flips the direction id for the same group.
    rerender({ selectedRouteId: '53275', hasManualDirection: true });
    await waitFor(() => expect(onPicked).toHaveBeenCalledWith('53275'));
    // No extra fetch — both direction shapes were already loaded.
    expect(fetchShape).toHaveBeenCalledTimes(2);
  });

  it('clears the stale route shape immediately when switching to a new route', async () => {
    const GROUPS = [
      { displayName: 'Route A', ids: ['A1'] },
      { displayName: 'Route B', ids: ['B1'] },
    ];
    // Route B loads slowly, so the stale Route A shape must not linger.
    const fetchShape = vi.fn((id) =>
      id === 'B1' ? new Promise((r) => setTimeout(() => r(shapeFor('B1')), 50)) : Promise.resolve(shapeFor('A1'))
    );
    const onPicked = vi.fn();

    const { rerender, result } = renderHook(
      ({ g }) =>
        useRouteShapes({
          selectedGroupName: g,
          routeGroups: GROUPS,
          userLocation: null,
          hasManualDirection: false,
          selectedRouteId: null,
          onPicked,
          fetchShape,
        }),
      { initialProps: { g: 'Route A' } }
    );
    await waitFor(() => expect(result.current.routeShape?.route_id).toBe('A1'));

    // Switch to Route B — the old Route A shape must not remain visible.
    rerender({ g: 'Route B' });

    // After rerender triggers the new fetch, routeShape must be null (cleared),
    // not still pointing at Route A's stops.
    expect(result.current.routeShape).toBeNull();

    // Once B loads, it becomes the active shape.
    await waitFor(() => expect(result.current.routeShape?.route_id).toBe('B1'));
  });
});