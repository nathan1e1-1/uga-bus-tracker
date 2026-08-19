import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import TripPlanner from '../components/TripPlanner';

const routes = [
  { route_id: '44886', route_name: 'Central East', color: '#075CFF' },
  { route_id: '73972', route_name: 'Weekender West', color: '#00A651' },
  { route_id: '53275', route_name: 'Chicopee Shuttle', color: '#EF00B7' },
];

const allStops = [
  { stop_id: '1', name: 'Crescent A', latitude: 33.95, longitude: -83.38, route_ids: ['44886', '73972', '53275'] },
  { stop_id: '2', name: 'East Campus Village', latitude: 33.938, longitude: -83.368, route_ids: ['44886', '73972', '53275'] },
];

const bus = (id, route_id, eta_seconds) => ({
  bus_id: id,
  bus_name: id.toUpperCase(),
  route_id,
  is_stale: false,
  next_stop: 'Some Stop',
  etas: { '1': { eta_seconds, eta_display: `${eta_seconds / 60} min`, eta_source: 'live' } },
});

const liveBuses = [
  bus('b1', '44886', 240),
  bus('b4', '73972', 480),
  bus('b2', '44886', 600),
  bus('b3', '53275', 300),
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
  it('shows the top-3 buses from 3 different routes sorted by ETA to the origin stop', () => {
    renderPlanner();
    pickFromAndTo();

    const cards = screen
      .getAllByRole('button')
      .filter((b) => b.className.includes('recommendation-card'));

    expect(cards).toHaveLength(3);
    expect(within(cards[0]).getByText(/B1/)).toBeTruthy();
    expect(within(cards[0]).getByText(/4 min/)).toBeTruthy();
    expect(within(cards[0]).getByText(/Central East/)).toBeTruthy();
    expect(within(cards[1]).getByText(/B3/)).toBeTruthy();
    expect(within(cards[1]).getByText(/Chicopee/)).toBeTruthy();
    expect(within(cards[2]).getByText(/B4/)).toBeTruthy();

    // All three come from different routes.
    expect(new Set(cards.map((c) => within(c).getByText(/Central East|Weekender|Chicopee/).textContent)).size).toBe(3);
  });

  it('shows a message when no buses are heading that way', () => {
    renderPlanner({ liveBuses: [] });
    pickFromAndTo();

    expect(screen.getByText(/No active buses right now/i)).toBeTruthy();
  });
});