import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TripPlanner from '../components/TripPlanner';

const ROUTE = '72874';
const routes = [{ route_id: ROUTE, route_name: 'Main Campus', color: '#075CFF', stop_count: 21 }];

const allStops = [
  { stop_id: '155117', name: 'Coliseum/SLC Westbound', latitude: 33.942, longitude: -83.375, route_ids: [ROUTE], route_positions: { [ROUTE]: 6 } },
  { stop_id: '155115', name: 'Coliseum/SLC Eastbound', latitude: 33.942, longitude: -83.374, route_ids: [ROUTE], route_positions: { [ROUTE]: 17 } },
  { stop_id: '155132', name: 'Joe Frank Harris Commons', latitude: 33.950, longitude: -83.360, route_ids: [ROUTE], route_positions: { [ROUTE]: 19 } },
];

// A bus on route 72874 that will reach the EASTBOUND stop soon.
const bus = (id, etas) => ({
  bus_id: id, bus_name: id.toUpperCase(), route_id: ROUTE, is_stale: false,
  next_stop: 'X', etas,
});
const liveBuses = [
  bus('b1', { '155115': { eta_seconds: 120, eta_display: '2 min', eta_source: 'live' } }),
];

function renderPlanner() {
  return render(
    <TripPlanner
      routes={routes}
      allStops={allStops}
      selectedRouteId={null}
      selectedRouteShape={null}
      liveBuses={liveBuses}
      // User is closer to the WESTBOUND stop (global nearest = Westbound),
      // but for a Joe Frank destination the OPTIMAL origin is Eastbound.
      userLocation={{ lat: 33.942, lng: -83.3749 }}
      onClose={vi.fn()}
      onDirectionChange={vi.fn()}
      onSelectRoute={vi.fn()}
    />
  );
}

describe('TripPlanner optimal origin with my location', () => {
  it('switches the origin to the optimal eastbound stop for a Joe Frank destination', () => {
    renderPlanner();

    const fromDisplay = () => document.querySelector('.field-group .stop-select');

    // Without a destination, the global nearest stop (Westbound) is shown.
    fireEvent.click(screen.getByRole('checkbox'));
    expect(fromDisplay().textContent).toContain('Westbound');

    // Choose destination = Joe Frank -> origin should become Eastbound (2 stops away)
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '155132' } });

    expect(fromDisplay().textContent).toContain('Eastbound');
  });
});