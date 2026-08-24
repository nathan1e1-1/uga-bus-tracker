import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TripSummary } from '../components/TripSummary';

const baseTrip = {
  originStop: { name: 'Coliseum/SLC Westbound' },
  getOffStop: { name: 'Tate Center - Memorial Hall' },
  routeName: 'Main Campus',
  busName: '96316',
  walkLine: null,
  walkMin: 1,
  arriveMin: 3,
  rideMin: 5,
};

describe('TripSummary', () => {
  it('renders the three plain-language steps with their times', () => {
    render(<TripSummary trip={baseTrip} />);

    const steps = screen.getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    expect(steps[0].textContent).toContain('Walk to Coliseum/SLC Westbound');
    expect(steps[0].textContent).toContain('1 min');
    expect(steps[1].textContent).toContain('Take Main Campus bus');
    expect(steps[1].textContent).toContain('3 min');
    expect(steps[2].textContent).toContain('Ride to Tate Center');
    expect(steps[2].textContent).toContain('5 min');
    expect(steps[2].textContent).toContain('get off at Tate Center - Memorial Hall');
  });

  it('renders nothing when there is no trip', () => {
    const { container } = render(<TripSummary trip={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows a dismiss button and calls onClose', () => {
    const onClose = vi.fn();
    render(<TripSummary trip={baseTrip} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close|dismiss/i }));
    expect(onClose).toHaveBeenCalled();
  });
});