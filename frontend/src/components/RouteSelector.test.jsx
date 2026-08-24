import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import RouteSelector from '../components/RouteSelector';

const routeGroups = [
  { displayName: 'Central East', ids: ['44886'] },
  { displayName: 'Weekender', ids: ['74535', '74536'] },
];

describe('RouteSelector', () => {
  it('keeps the select and reverse button grouped in a single right-side container', () => {
    render(
      <RouteSelector
        routeGroups={routeGroups}
        selectedGroupName="Weekender"
        selectedRouteId="74535"
        routesLoading={false}
      />
    );

    // The select and reverse button must share one parent container
    // so flex space-between keeps them together on the right.
    const controls = document.querySelector('.top-bar-controls');
    expect(controls).toBeTruthy();
    expect(within(controls).getByRole('combobox')).toBeTruthy();
    expect(within(controls).getByRole('button', { name: /reverse/i })).toBeTruthy();
  });

  it('renders the reverse button only for multi-direction routes', () => {
    render(
      <RouteSelector
        routeGroups={routeGroups}
        selectedGroupName="Central East"
        selectedRouteId="44886"
        routesLoading={false}
      />
    );
    expect(screen.queryByRole('button', { name: /reverse/i })).toBeNull();
  });
});