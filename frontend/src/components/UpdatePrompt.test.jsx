import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { UpdatePrompt } from '../components/UpdatePrompt';

describe('UpdatePrompt', () => {
  it('renders the reload banner when a new version is available', () => {
    render(<UpdatePrompt needRefresh onReload={vi.fn()} />);
    expect(screen.getByText(/new version available/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /reload/i })).toBeTruthy();
  });

  it('renders nothing when the app is up to date', () => {
    const { container } = render(<UpdatePrompt needRefresh={false} onReload={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls onReload when the button is clicked', () => {
    const onReload = vi.fn();
    render(<UpdatePrompt needRefresh onReload={onReload} />);
    fireEvent.click(screen.getByRole('button', { name: /reload/i }));
    expect(onReload).toHaveBeenCalled();
  });
});