import { act, renderHook } from '@testing-library/react-native';

import { LOCKOUT_BASE_MS } from '../lockout';
import { useLockoutCountdown } from './useLockoutCountdown';

describe('useLockoutCountdown', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('reads the lockout on the first render and ticks down once a second', async () => {
    const lockout = { failures: 5, lockedUntil: Date.now() + LOCKOUT_BASE_MS };
    const { result } = await renderHook(() => useLockoutCountdown(lockout));
    expect(result.current).toBe(30);

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(28);
  });

  it('is zero when there is no lockout', async () => {
    const { result } = await renderHook(() => useLockoutCountdown({ failures: 0, lockedUntil: 0 }));
    expect(result.current).toBe(0);
  });
});
