import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { shouldRefit } from '../utils/mapFit';

// UGA campus center
const CAMPUS_CENTER = [33.9519, -83.3776];
const DEFAULT_ZOOM = 14;

function FitBounds({ bounds, routeId }) {
  const map = useMap();
  const fittedRouteId = useRef(null);

  useEffect(() => {
    if (!bounds || bounds.length === 0) return;
    if (!shouldRefit({ routeId: routeId ?? null, fittedRouteId: fittedRouteId.current, hasBounds: true })) {
      return;
    }
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    fittedRouteId.current = routeId ?? 'all';
  }, [map, bounds, routeId]);
  return null;
}

function createBusIcon(bus, routeColor, isArriving) {
  const isStale = bus.is_stale;
  const color = isStale ? '#94A3B8' : (routeColor || '#3B82F6');
  const label = bus.bus_name?.slice(-2) || '??';

  const pulseHtml = isArriving && !isStale
    ? `<div class="pulse-ring"></div><div class="pulse-ring"></div><div class="pulse-ring"></div>`
    : '';

  return L.divIcon({
    className: '',
    html: `
      <div class="bus-marker ${isStale ? 'stale' : ''}" style="border-color:${color}">
        ${pulseHtml}
        ${label}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

function createStopIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div class="stop-marker" style="border-color:${color || '#3B82F6'}"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

function createLocationIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div class="location-marker">
        <div class="location-dot"></div>
        <div class="location-pulse"></div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function createHighlightIcon(kind) {
  const isDest = kind === 'dest';
  return L.divIcon({
    className: '',
    html: `
      <div class="trip-highlight ${isDest ? 'dest' : 'origin'}">
        ${isDest ? '▼' : '▲'}
      </div>
    `,
    iconSize: isDest ? [26, 26] : [24, 24],
    iconAnchor: [12, isDest ? 24 : 6],
    popupAnchor: isDest ? [1, -30] : [0, 18],
  });
}

export default function BusMap({ routeShape, buses, isDark, userLocation, nearestStop, trip }) {
  const bounds = useMemo(() => {
    const pts = [];
    if (routeShape) {
      pts.push(...routeShape.polyline.map((p) => [p.lat, p.lng]));
    }
    buses.forEach((b) => {
      if (b.lat && b.lon) pts.push([b.lat, b.lon]);
    });
    if (userLocation) {
      pts.push([userLocation.lat, userLocation.lng]);
    }
    return pts;
  }, [routeShape, buses, userLocation]);

  const polyline = routeShape?.polyline;
  const stops = routeShape?.stops || [];
  const color = routeShape?.color;
  const polyPoints = polyline ? polyline.map((p) => [p.lat, p.lng]) : [];

  return (
    <div className="map-wrapper">
      <MapContainer
        center={CAMPUS_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ height: '100%', width: '100%', background: '#0F172A' }}
        zoomControl={false}
      >
        <TileLayer
          attribution={isDark
            ? '&copy; <a href="https://carto.com/">CartoDB</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          }
          url={isDark
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          }
        />
        <FitBounds bounds={bounds} routeId={routeShape?.route_id ?? null} />

        {/* Route polyline */}
        <Polyline
          positions={polyPoints}
          pathOptions={{ color: color || '#3B82F6', weight: 5, opacity: 0.75 }}
        />

        {/* Walking path to the origin stop */}
        {trip?.walkLine && (
          <Polyline
            positions={trip.walkLine}
            pathOptions={{ color: '#BA0C2F', weight: 3, opacity: 0.9, dashArray: '6 6' }}
          />
        )}

        {/* Origin + get-off stop highlights */}
        {trip?.originStop && trip.originStop.latitude != null && (
          <Marker
            position={[trip.originStop.latitude, trip.originStop.longitude]}
            icon={createHighlightIcon('origin')}
            zIndexOffset={900}
          />
        )}
        {trip?.getOffStop && trip.getOffStop.latitude != null && (
          <Marker
            position={[trip.getOffStop.latitude, trip.getOffStop.longitude]}
            icon={createHighlightIcon('dest')}
            zIndexOffset={950}
          />
        )}

        {/* Stop markers */}
        {stops.map((stop) => (
          <Marker
            key={stop.stop_id}
            position={[stop.latitude, stop.longitude]}
            icon={createStopIcon(color)}
          >
            <Popup>
              <div style={{ fontFamily: 'Helvetica-Bold, sans-serif', fontSize: '0.85rem' }}>
                <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{stop.name}</strong>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: 2 }}>
                  Stop #{stop.position}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* User location marker */}
        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={createLocationIcon()}
            zIndexOffset={2000}
          >
            <Popup>
              <div style={{ fontFamily: 'Helvetica-Bold, sans-serif', fontSize: '0.85rem' }}>
                <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Your Location</strong>
                {nearestStop && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: 4 }}>
                    Nearest stop: {nearestStop.name} ({Math.round(nearestStop.distance)}m away)
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Bus markers */}
        {buses.map((bus) => {
          const isStale = bus.is_stale;
          const etaSource = bus.eta_source;
          const isArriving = etaSource === 'arriving' || (bus.eta_seconds != null && bus.eta_seconds < 60);

          return (
            <Marker
              key={bus.bus_id}
              position={[bus.lat, bus.lon]}
              icon={createBusIcon(bus, color, isArriving)}
              zIndexOffset={isStale ? 0 : 1000}
            >
              <Popup>
                <BusPopup bus={bus} routeColor={color} />
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

function BusPopup({ bus, routeColor }) {
  const isStale = bus.is_stale;
  const etaSource = bus.eta_source;
  const etaDisplay = bus.eta_display || formatEta(bus.eta_seconds);

  return (
    <div style={{ fontFamily: 'Helvetica-Bold, sans-serif', minWidth: 150 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: isStale ? '#94A3B8' : (routeColor || '#3B82F6'),
          }}
        />
        <strong style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Bus {bus.bus_name}
        </strong>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
        <span
          style={{
            fontSize: '1.2rem',
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            color: isStale
              ? '#94A3B8'
              : etaSource === 'live'
                ? '#10B981'
                : etaSource === 'arriving'
                  ? '#F59E0B'
                  : '#64748B',
            fontStyle: etaSource === 'estimated' || etaSource === 'default' ? 'italic' : 'normal',
          }}
        >
          {isStale ? 'Unavailable' : etaDisplay}
        </span>
        {!isStale && etaSource !== 'live' && (
          <span
            style={{
              fontSize: '0.6rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--text-muted)',
              fontWeight: 600,
            }}
          >
            {etaSource}
          </span>
        )}
      </div>

      {!isStale && bus.next_stop && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          → {bus.next_stop}
        </div>
      )}

      {isStale && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
          No recent position data
        </div>
      )}
    </div>
  );
}

function formatEta(seconds) {
  if (seconds == null) return 'Unavailable';
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  return `${Math.round(seconds / 60)} min`;
}
