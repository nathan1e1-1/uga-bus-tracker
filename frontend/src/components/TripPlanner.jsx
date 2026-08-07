import { useState, useMemo } from 'react';

export default function TripPlanner({ routes, selectedRouteId, selectedRouteShape, liveBuses, onClose }) {
  const [fromStopId, setFromStopId] = useState('');
  const [toStopId, setToStopId] = useState('');

  const stops = selectedRouteShape?.stops || [];
  const routeName = selectedRouteShape?.route_name || 'Route';
  const routeColor = selectedRouteShape?.color || '#3B82F6';

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
          <div className="field-group">
            <label className="field-label">From</label>
            <select
              className="stop-select"
              value={fromStopId}
              onChange={(e) => setFromStopId(e.target.value)}
            >
              <option value="" disabled>Pick your stop…</option>
              {stops.map((s) => (
                <option key={s.stop_id} value={String(s.stop_id)}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label className="field-label">To</label>
            <select
              className="stop-select"
              value={toStopId}
              onChange={(e) => setToStopId(e.target.value)}
            >
              <option value="" disabled>Pick destination…</option>
              {stops.map((s) => (
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
                      color: '#64748B',
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
                                : '#64748B',
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
                              color: '#94A3B8',
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
