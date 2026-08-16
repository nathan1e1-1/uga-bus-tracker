import { useState, useMemo, useEffect } from 'react';
import { haversineDistance } from '../hooks/useGeolocation';

export default function TripPlanner({ routes, selectedRouteId, selectedRouteShape, liveBuses, userLocation, nearestStop, onClose, onDirectionChange }) {
  const [fromStopId, setFromStopId] = useState('');
  const [toStopId, setToStopId] = useState('');
  const [useMyLocation, setUseMyLocation] = useState(false);

  const stops = selectedRouteShape?.stops || [];
  const routeName = selectedRouteShape?.route_name || 'Route';
  const routeColor = selectedRouteShape?.color || '#3B82F6';

  // Auto-set "from" stop when user location is available
  useEffect(() => {
    if (useMyLocation && nearestStop) {
      setFromStopId(String(nearestStop.stop_id));
    } else if (!useMyLocation) {
      setFromStopId('');
    }
  }, [useMyLocation, nearestStop]);

  // Only the current shape is available here, so check stop order directly.
  // resolveDirectionByStops expects shape maps for all group directions.
  // Detect wrong direction and request swap
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

  // Build recommendations when both stops are selected
  const recommendations = useMemo(() => {
    if (!fromStopId || !toStopId || fromStopId === toStopId) return [];

    const fromStop = stops.find((s) => String(s.stop_id) === fromStopId);
    const toStop = stops.find((s) => String(s.stop_id) === toStopId);
    if (!fromStop || !toStop) return [];

    // For each live bus, calculate ETA to the FROM stop
    const busesToFrom = liveBuses
      .filter((b) => !b.is_stale && b.eta_seconds != null)
      .map((b) => ({
        bus_id: b.bus_id,
        bus_name: b.bus_name,
        eta_seconds: b.eta_seconds,
        eta_display: b.eta_display,
        next_stop: b.next_stop,
        next_stop_pos: b.next_stop_pos,
        eta_source: b.eta_source,
      }))
      .sort((a, b) => a.eta_seconds - b.eta_seconds);

    if (busesToFrom.length === 0) return [];

    return [
      {
        route_id: selectedRouteId,
        route_name: routeName,
        route_color: routeColor,
        from_stop: fromStop.name,
        to_stop: toStop.name,
        buses: busesToFrom.slice(0, 3),
      },
    ];
  }, [fromStopId, toStopId, stops, liveBuses, selectedRouteId, routeName, routeColor]);

  // Calculate distance to each stop from user location
  const stopsWithDistance = useMemo(() => {
    if (!userLocation) return stops.map(s => ({ ...s, distance: null }));
    return stops.map((s) => ({
      ...s,
      distance: haversineDistance(
        userLocation.lat,
        userLocation.lng,
        s.latitude || s.lat,
        s.longitude || s.lng
      ),
    }));
  }, [stops, userLocation]);

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
              {useMyLocation && nearestStop && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Nearest stop: <strong style={{ color: 'var(--text-primary)' }}>{nearestStop.name}</strong> ({Math.round(nearestStop.distance)}m away)
                </div>
              )}
            </div>
          )}

          <div className="field-group">
            <label className="field-label">From</label>
            {useMyLocation ? (
              <div className="stop-select" style={{ background: 'var(--surface-hover)', cursor: 'default' }}>
                {nearestStop ? nearestStop.name : 'Getting location...'}
              </div>
            ) : (
              <select
                className="stop-select"
                value={fromStopId}
                onChange={(e) => setFromStopId(e.target.value)}
              >
                <option value="" disabled>Pick your stop…</option>
                {stopsWithDistance.map((s) => (
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
              {stopsWithDistance.map((s) => (
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
                <div key={rec.route_id}>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: '0.5rem',
                    }}
                  >
                    {rec.from_stop} → {rec.to_stop}
                  </div>

                  {rec.buses.map((bus) => (
                    <div
                      key={bus.bus_id}
                      className="recommendation-card"
                      style={{ borderLeftColor: rec.route_color }}
                    >
                      <div>
                        <div className="rec-route-name">{rec.route_name}</div>
                        <div className="rec-detail">
                          Bus {bus.bus_name} · Next: {bus.next_stop || 'Unknown'}
                        </div>
                      </div>
                      <div
                        className="rec-eta"
                        style={{
                          color:
                            bus.eta_source === 'live'
                              ? '#10B981'
                              : bus.eta_source === 'arriving'
                                ? '#F59E0B'
                                : 'var(--text-secondary)',
                          fontStyle:
                            bus.eta_source === 'estimated' || bus.eta_source === 'default'
                              ? 'italic'
                              : 'normal',
                        }}
                      >
                        {bus.eta_display}
                        {bus.eta_source !== 'live' && (
                          <div
                            style={{
                              fontSize: '0.6rem',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              color: 'var(--text-muted)',
                              textAlign: 'right',
                              marginTop: 2,
                            }}
                          >
                            {bus.eta_source}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {fromStopId && toStopId && fromStopId !== toStopId && recommendations.length === 0 && (
            <div className="no-results">
              No active buses on this route right now.
              <br />
              <small>Check back during service hours.</small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
