import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePwaUpdate } from './usePwaUpdate';

const { registerSW } = vi.hoisted(() => ({ registerSW: vi.fn() }));
vi.mock('virtual:pwa-register', () => ({ registerSW }));

function mockRegister() {
  let captured = null;
  const updateSW = vi.fn();
  registerSW.mockReturnValue(updateSW);
  registerSW.mockImplementation((opts) => {
    captured = opts;
    return updateSW;
  });
  return { getOptions: () => captured, updateSW };
}

beforeEach(() => {
  registerSW.mockReset();
});

describe('usePwaUpdate', () => {
  it('registers the service worker and exposes reload', () => {
    const mocked = mockRegister();
    const { result } = renderHook(() => usePwaUpdate());
    expect(registerSW).toHaveBeenCalledWith(expect.objectContaining({ onNeedRefresh: expect.any(Function) }));
    act(() => result.current.reload());
    expect(mocked.updateSW).toHaveBeenCalledWith(true);
  });

  it('sets needRefresh when the service worker reports a new version', () => {
    const mocked = mockRegister();
    const { result } = renderHook(() => usePwaUpdate());
    expect(result.current.needRefresh).toBe(false);
    act(() => mocked.getOptions().onNeedRefresh());
    expect(result.current.needRefresh).toBe(true);
  });

  it('sets offlineReady when the service worker is ready offline', () => {
    const mocked = mockRegister();
    const { result } = renderHook(() => usePwaUpdate());
    act(() => mocked.getOptions().onOfflineReady());
    expect(result.current.offlineReady).toBe(true);
  });
});