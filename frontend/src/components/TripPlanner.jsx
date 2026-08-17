import { useState, useMemo, useEffect } from 'react';
import { haversineDistance } from '../hooks/useGeolocation';

export default function TripPlanner({
  routes,
  allStops,
  selectedRouteId,
  selectedRouteShape,
  liveBuses,
  userLocation,
  onClose,
  onDirectionChange,
  onSelectRoute,
}) {
  const [fromStopId, setFromStopId] = useState('');
  const [toStopId, setToStopId] = useState('');
  const [useMyLocation, setUseMyLocation] = useState(false);

  // Global nearest stop for trip planner origin
  const globalNearestStop = useMemo(() => {
    if (!userLocation || !allStops.length) return null;
    return allStops.reduce((best, s) => {
      const d = haversineDistance(
        userLocation.lat,
        userLocation.lng,
        s.latitude || s.lat,
        s.longitude || s.lng
      );
      return !best || d < best.distance ? { ...s, distance: d } : best;
    }, null);
  }, [userLocation, allStops]);

  // Auto-set "from" stop when user location is available
  useEffect(() => {
    if (useMyLocation && globalNearestStop) {
      setFromStopId(String(globalNearestStop.stop_id));
    } else if (!useMyLocation) {
      setFromStopId('');
    }
  }, [useMyLocation, globalNearestStop]);

  // Find routes that serve both from and to stops
  const matchingRoutes = useMemo(() => {
    if (!fromStopId || !toStopId || fromStopId === toStopId || !allStops.length || !routes.length) {
      return [];
    }

    const fromStop = allStops.find((s) => String(s.stop_id) === String(fromStopId));
    const toStop = allStops.find((s) => String(s.stop_id) === String(toStopId));
    if (!fromStop?.route_ids?.length || !toStop?.route_ids?.length) return [];

    const commonRouteIds = fromStop.route_ids.filter((id) =>
      toStop.route_ids.includes(id)
    );

    return routes
      .filter((r) => commonRouteIds.includes(r.route_id))
      .map((r) => ({ ...r, isSelected: r.route_id === selectedRouteId }));
  }, [fromStopId, toStopId, allStops, routes, selectedRouteId]);

  // Direction-swap effect for the currently selected route
  useEffect(() => {
    if (!fromStopId || !toStopId || fromStopId === toStopId) return;
    if (!selectedRouteShape || selectedRouteShape.route_id !== selectedRouteId) return;
    if (!routes.length) return;

    const currentRoute = routes.find((r) => r.route_id === selectedRouteId);
    if (!currentRoute) return;

    const groupIds = routes
      .filter((r) => r.route_name === currentRoute.route_name)
      .map((r) => r.route_id);
    if (groupIds.length < 2) return;

    const stops = selectedRouteShape.stops || [];
    const fromIndex = stops.findIndex((s) => String(s.stop_id) === String(fromStopId));
    const toIndex = stops.findIndex((s) => String(s.stop_id) === String(toStopId));

    // Current direction is correct or stops are missing — no swap needed
    if (fromIndex === -1 || toIndex === -1 || fromIndex < toIndex) return;

    // Current direction is wrong; swap to the other direction in the group
    const otherId = groupIds.find((id) => id !== selectedRouteId);
    if (otherId && onDirectionChange) {
      onDirectionChange(otherId);
    }
  }, [fromStopId, toStopId, selectedRouteShape, selectedRouteId, routes, onDirectionChange]);

  // Build recommendations from matching routes and live buses
  const recommendations = useMemo(() => {
    if (!fromStopId || !toStopId || fromStopId === toStopId || !matchingRoutes.length) return [];

    const fromStop = allStops.find((s) => String(s.stop_id) === String(fromStopId));
    const toStop = allStops.find((s) => String(s.stop_id) === String(toStopId));
    if (!fromStop || !toStop) return [];

    return matchingRoutes.map((route) => {
      const routeBuses = liveBuses
        .filter((b) => b.route_id === route.route_id && !b.is_stale)
        .slice(0, 3);

      return {
        route_id: route.route_id,
        route_name: route.route_name,
        route_color: route.color,
        from_stop: fromStop.name,
        to_stop: toStop.name,
        buses: routeBuses,
        isSelected: route.isSelected,
      };
    });
  }, [fromStopId, toStopId, matchingRoutes, liveBuses, allStops]);

  // Calculate distance to each stop from user location
  const stopsWithDistance = useMemo(() => {
    if (!userLocation) return allStops.map((s) => ({ ...s, distance: null }));
    return allStops.map((s) => ({
      ...s,
      distance: haversineDistance(
        userLocation.lat,
        userLocation.lng,
        s.latitude || s.lat,
        s.longitude || s.lng
      ),
    }));
  }, [allStops, userLocation]);

  const sortedStops = useMemo(() => {
    return [...stopsWithDistance].sort((a, b) => {
      if (a.distance == null && b.distance == null) return a.name.localeCompare(b.name);
      if (a.distance == null) return 1;
      if (b.distance == null) return -1;
      return a.distance - b.distance;
    });
  }, [stopsWithDistance]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Plan your trip</div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="planner-body">
          {/* Location toggle */}
          {userLocation && (
            <div className="field-group">
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={useMyLocation}
                  onChange={(e) => setUseMyLocation(e.target.checked)}
                  style={{ width: 'auto', cursor: 'pointer' }}
                />
                Use my current location
              </label>
              {useMyLocation && globalNearestStop && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Nearest stop: <strong style={{ color: 'var(--text-primary)' }}>{globalNearestStop.name}</strong> ({Math.round(globalNearestStop.distance)}m away)
                </div>
              )}
            </div>
          )}

          <div className="field-group">
            <label className="field-label">From</label>
            {useMyLocation ? (
              <div className="stop-select" style={{ background: 'var(--surface-hover)', cursor: 'default' }}>
                {globalNearestStop ? globalNearestStop.name : 'Getting location...'}
              </div>
            ) : (
              <select
                className="stop-select"
                value={fromStopId}
                onChange={(e) => setFromStopId(e.target.value)}
              >
                <option value="" disabled>Pick your stop…</option>
                {sortedStops.map((s) => (
                  <option key={s.stop_id} value={String(s.stop_id)}>
                    {s.name} {s.distance != null ? `(${Math.round(s.distance)}m)` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="field-group">
            <label className="field-label">To</label>
            <select
              className="stop-select"
              value={toStopId}
              onChange={(e) => setToStopId(e.target.value)}
            >
              <option value="" disabled>Pick destination…</option>
              {sortedStops.map((s) => (
                <option key={s.stop_id} value={String(s.stop_id)}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {fromStopId && toStopId && fromStopId === toStopId && (
            <div className="no-results">
              You&apos;re already there.
            </div>
          )}

          {recommendations.length > 0 && (
            <div className="recommendation-list">
              {recommendations.map((rec) => (
                <button
                  key={rec.route_id}
                  className="recommendation-card"
                  style={{ borderLeftColor: rec.route_color, width: '100%', textAlign: 'left', background: 'var(--surface)' }}
                  onClick={() => {
                    if (onSelectRoute) {
                      onSelectRoute(rec.route_id);
                      onClose();
                    }
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div className="rec-route-name">{rec.route_name}</div>
                    <div className="rec-detail">
                      {rec.from_stop} → {rec.to_stop}
                    </div>
                  <div className="rec-detail">
                    {rec.buses.length > 0
                      ? `${rec.buses.length} active bus${rec.buses.length !== 1 ? 'es' : ''}`
                      : 'No active buses right now'}
                  </div>
                  </div>
                  {rec.isSelected && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Selected</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {fromStopId && toStopId && fromStopId !== toStopId && matchingRoutes.length === 0 && (
            <div className="no-results">
              No direct route serves these stops.
              <br />
              <small>Try a different origin or destination.</small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
