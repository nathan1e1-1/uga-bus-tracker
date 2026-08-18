import { useState, useEffect, useMemo } from 'react';
import { fetchRoutes, fetchAllStops } from './api';
import { groupRoutes, getOppositeDirectionId } from './utils/routeGroups';
import { useBusPolling } from './hooks/useBusPolling';
import { useDarkMode } from './hooks/useDarkMode';
import { useGeolocation, findNearestStop } from './hooks/useGeolocation';
import { useRouteShapes } from './hooks/useRouteShapes';
import BusMap from './components/BusMap';
import TripPlanner from './components/TripPlanner';
import './App.css';

export default function App() {
  const [routes, setRoutes] = useState([]);
  const [routeGroups, setRouteGroups] = useState([]);
  const [selectedGroupName, setSelectedGroupName] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [showPlanner, setShowPlanner] = useState(false);
  const [hasManualDirection, setHasManualDirection] = useState(false);
  const [routesError, setRoutesError] = useState(null);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [allStops, setAllStops] = useState([]);

  const { buses: allBuses, loading, error, lastUpdated } = useBusPolling(null);
  const mapBuses = useMemo(
    () => (selectedRouteId ? allBuses.filter((b) => b.route_id === selectedRouteId) : []),
    [allBuses, selectedRouteId]
  );
  const { isDark, toggle } = useDarkMode();
  const { location: userLocation, loading: geoLoading, requestLocation } = useGeolocation();

  const { routeShape } = useRouteShapes({
    selectedGroupName,
    routeGroups,
    userLocation,
    hasManualDirection,
    selectedRouteId,
    onPicked: (id) => setSelectedRouteId(id),
  });

  // Load route list and all stops on mount
  useEffect(() => {
    setRoutesLoading(true);
    setRoutesError(null);
    fetchRoutes()
      .then((data) => {
        console.log('[App] Loaded routes:', data.length);
        setRoutes(data);
        const groups = groupRoutes(data);
        console.log('[App] Route groups:', groups.map((g) => `${g.displayName}(${g.ids.length})`).join(', '));
        setRouteGroups(groups);
      })
      .catch((e) => {
        console.error('[App] Failed to load routes:', e);
        setRoutesError(e.message || 'Failed to load routes');
      })
      .finally(() => setRoutesLoading(false));

    fetchAllStops()
      .then((data) => {
        console.log('[App] Loaded stops:', data.length);
        setAllStops(data);
      })
      .catch((e) => {
        console.error('[App] Failed to load stops:', e);
      });
  }, []);

  // Find nearest stop on the selected route
  const nearestStop = useMemo(() => {
    if (!userLocation || !routeShape?.stops?.length) return null;
    return findNearestStop(userLocation.lat, userLocation.lng, routeShape.stops);
  }, [userLocation, routeShape]);

  return (
    <div className="app">
      {/* Top bar: brand left, route selector right */}
      <div className="top-bar">
        <div className="brand">
          <div className="brand-dot blink" />
          <span className="brand-text">UGA BUS</span>
        </div>

        {routesLoading ? (
          <span className="pill-select" style={{ opacity: 0.6 }}>Loading routes…</span>
        ) : routesError ? (
          <span className="pill-select" style={{ color: '#EF4444' }}>Routes unavailable</span>
        ) : (
          <select
            className="pill-select"
            value={selectedGroupName || ''}
            onChange={(e) => {
              setSelectedGroupName(e.target.value);
              setHasManualDirection(false);
            }}
          >
            <option value="" disabled>Choose route…</option>
            {routeGroups.map((g) => (
              <option key={g.displayName} value={g.displayName}>
                {g.displayName}
              </option>
            ))}
          </select>
        )}
        {selectedRouteId && routeGroups.find((g) => g.displayName === selectedGroupName)?.ids.length > 1 && (
          <button
            className="reverse-btn"
            onClick={() => {
              const group = routeGroups.find((g) => g.displayName === selectedGroupName);
              const nextId = getOppositeDirectionId(group, selectedRouteId);
              if (!nextId) return;
              setHasManualDirection(true);
              setSelectedRouteId(nextId);
            }}
            aria-label="Reverse direction"
          >
            ⇄
          </button>
        )}
      </div>

      {/* Map — full screen hero */}
      <main className="map-container">
        <BusMap
          routeShape={routeShape}
          buses={mapBuses}
          isDark={isDark}
          userLocation={userLocation}
          nearestStop={nearestStop}
        />
      </main>

      {/* Bottom bar: controls left */}
      <div className="bottom-bar">
        <div className="bottom-controls">
          {/* Location button */}
          <button
            className="location-btn"
            onClick={requestLocation}
            disabled={geoLoading}
            aria-label="Find my location"
            title="Find my location"
          >
            {geoLoading ? (
              <span className="spinner" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
              </svg>
            )}
          </button>

          <button className="theme-toggle" onClick={toggle} aria-label="Toggle dark mode">
            {isDark ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          <div className={`status-pill ${error ? 'error-pill' : ''}`}>
            {error ? (
              <span>Error</span>
            ) : lastUpdated ? (
              <span>{Math.round((Date.now() - lastUpdated) / 1000)}s</span>
            ) : loading ? (
              <span className="spinner" />
            ) : (
              <span>Live</span>
            )}
          </div>
        </div>
      </div>

      {/* Floating "Where to?" FAB — bottom right */}
      <button
        className="fab-where-to"
        onClick={() => setShowPlanner(true)}
        aria-label="Plan trip"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span>Where to?</span>
      </button>

      {/* Trip Planner Modal */}
      {showPlanner && (
        <TripPlanner
          routes={routes}
          routeGroups={routeGroups}
          allStops={allStops}
          selectedRouteId={selectedRouteId}
          selectedRouteShape={routeShape}
          liveBuses={allBuses}
          userLocation={userLocation}
          nearestStop={nearestStop}
          onClose={() => setShowPlanner(false)}
          onDirectionChange={(nextId) => {
            setSelectedRouteId(nextId);
            setHasManualDirection(true);
          }}
          onSelectRoute={(routeId) => {
            const group = routeGroups.find((g) => g.ids.includes(routeId));
            if (group) {
              setSelectedGroupName(group.displayName);
              setSelectedRouteId(routeId);
              setHasManualDirection(true);
            }
          }}
        />
      )}
    </div>
  );
}
