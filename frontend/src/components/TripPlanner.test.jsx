import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import TripPlanner from '../components/TripPlanner';

const routes = [
  { route_id: '44886', route_name: 'Central East', color: '#075CFF' },
  { route_id: '73972', route_name: 'Weekender West', color: '#00A651' },
];

const allStops = [
  { stop_id: '1', name: 'Crescent A', latitude: 33.95, longitude: -83.38, route_ids: ['44886', '73972'] },
  { stop_id: '2', name: 'East Campus Village', latitude: 33.938, longitude: -83.368, route_ids: ['44886', '73972'] },
];

const liveBuses = [
  { bus_id: 'b1', bus_name: '96316', route_id: '44886', is_stale: false, next_stop: 'Crescent A', etas: { '1': { eta_seconds: 240, eta_display: '4 min', eta_source: 'live' } } },
  { bus_id: 'b4', bus_name: '77777', route_id: '73972', is_stale: false, next_stop: 'West Campus', etas: { '1': { eta_seconds: 480, eta_display: '8 min', eta_source: 'live' } } },
  { bus_id: 'b2', bus_name: '12345', route_id: '44886', is_stale: false, next_stop: 'Mell Hall', etas: { '1': { eta_seconds: 600, eta_display: '10 min', eta_source: 'estimated' } } },
];

function renderPlanner(props = {}) {
  return render(
    <TripPlanner
      routes={routes}
      allStops={allStops}
      selectedRouteId={null}
      selectedRouteShape={null}
      liveBuses={liveBuses}
      userLocation={null}
      onClose={vi.fn()}
      onDirectionChange={vi.fn()}
      onSelectRoute={vi.fn()}
      {...props}
    />
  );
}

function pickFromAndTo() {
  const selects = screen.getAllByRole('combobox');
  fireEvent.change(selects[0], { target: { value: '1' } });
  fireEvent.change(selects[1], { target: { value: '2' } });
}

describe('TripPlanner leaderboard', () => {
  it('shows the top-3 buses sorted by ETA to the origin stop', () => {
    renderPlanner();
    pickFromAndTo();

    const cards = screen
      .getAllByRole('button')
      .filter((b) => b.className.includes('recommendation-card'));

    expect(cards).toHaveLength(3);
    expect(within(cards[0]).getByText(/96316/)).toBeTruthy();
    expect(within(cards[0]).getByText(/4 min/)).toBeTruthy();
    expect(within(cards[0]).getByText(/Central East/)).toBeTruthy();
    expect(within(cards[1]).getByText(/77777/)).toBeTruthy();
    expect(within(cards[2]).getByText(/12345/)).toBeTruthy();
  });

  it('shows a message when no buses are heading that way', () => {
    renderPlanner({ liveBuses: [] });
    pickFromAndTo();

    expect(screen.getByText(/No active buses right now/i)).toBeTruthy();
  });
});