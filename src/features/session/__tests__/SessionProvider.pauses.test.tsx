import { act } from '@testing-library/react-native';

import { appState, moveAppStateTo, resetAppState } from '@/testing/appState';
import { secureStoreMock } from '@/testing/secureStore';
import { unlocked, session, pending, wait } from '@/testing/sessionProvider';
import { vaultMock } from '@/testing/vault';

import { AUTO_LOCK_RETURN_GRACE_MS, sharePause } from '../SessionProvider';

describe('SessionProvider session capture', () => {
  const moveTo = moveAppStateTo;

  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
    resetAppState();
  });

  it('does not lock behind system UI that is still open on return', async () => {
    await unlocked(0);
    const picker = pending();
    let done!: Promise<void>;
    await act(async () => {
      done = session.withoutAutoLock(() => picker.promise);
    });

    await moveTo('background');
    await moveTo('active');
    await wait(AUTO_LOCK_RETURN_GRACE_MS + 100);

    expect(session.status).toBe('unlocked');
    await act(async () => {
      picker.settle();
      await done;
    });
    expect(session.status).toBe('unlocked');
  });

  it('locks on return when a share sheet that should end on return is still pending', async () => {
    await unlocked(0);
    const share = pending();
    await act(async () => {
      void session.withoutAutoLock(() => share.promise, { endsOnReturn: true, maxAwayMs: 60_000 });
    });

    // Android blocked the chooser: the app left, and the share never settles.
    await moveTo('background');
    await moveTo('active');
    expect(session.status).toBe('unlocked');
    await wait(AUTO_LOCK_RETURN_GRACE_MS + 100);

    expect(session.status).toBe('locked');
  });

  it('keeps the vault open when a share that ends on return settles within the grace', async () => {
    await unlocked(0);
    const share = pending();
    await act(async () => {
      void session.withoutAutoLock(() => share.promise, { endsOnReturn: true, maxAwayMs: 60_000 });
    });

    await moveTo('background');
    await moveTo('active');
    await act(async () => share.settle());
    await wait(AUTO_LOCK_RETURN_GRACE_MS + 100);

    expect(session.status).toBe('unlocked');
  });

  it('locks on return once the time away passes the pause limit', async () => {
    await unlocked(0);
    const share = pending();
    await act(async () => {
      void session.withoutAutoLock(() => share.promise, { maxAwayMs: 1000 });
    });
    const now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now);

    await moveTo('background');
    clock.mockReturnValue(now + 5000);
    await moveTo('active');

    expect(session.status).toBe('locked');
    clock.mockRestore();
  });

  it('judges the time away after a pause that ends while the app is still away', async () => {
    await unlocked(0);
    const share = pending();
    let done!: Promise<void>;
    await act(async () => {
      done = session.withoutAutoLock(() => share.promise, sharePause());
    });
    const now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now);

    // iOS hands the share to another app: the sheet settles just after leaving.
    await moveTo('background');
    await act(async () => {
      share.settle();
      await done;
    });
    clock.mockReturnValue(now + 60 * 60_000);
    await moveTo('active');

    expect(session.status).toBe('locked');
    clock.mockRestore();
  });

  it('does not lock when a picker settles on the way back to the app', async () => {
    await unlocked(0);
    const picker = pending();
    let done!: Promise<void>;
    await act(async () => {
      done = session.withoutAutoLock(() => picker.promise);
    });

    // Android delivers the picker result just before the app is active again.
    await moveTo('background');
    await act(async () => {
      picker.settle();
      await done;
    });
    await moveTo('active');

    expect(session.status).toBe('unlocked');
  });

  it('locks while still away once a pending pause outlives its limit and auto-lock', async () => {
    await unlocked(0);
    const share = pending();
    await act(async () => {
      void session.withoutAutoLock(() => share.promise, { endsOnReturn: true, maxAwayMs: 100 });
    });

    // Android: the chooser stays up in front of the app, which never returns.
    await moveTo('background');
    await wait(250);

    expect(appState.currentState).toBe('background');
    expect(session.status).toBe('locked');
  });

  it('waits for the auto-lock limit before locking a pending pause while away', async () => {
    await unlocked(60);
    const share = pending();
    await act(async () => {
      void session.withoutAutoLock(() => share.promise, { maxAwayMs: 100 });
    });

    await moveTo('background');
    await wait(250);

    expect(session.status).toBe('unlocked');
  });

  it('never locks a pending pause while away when auto-lock is off', async () => {
    await unlocked(-1);
    const share = pending();
    await act(async () => {
      void session.withoutAutoLock(() => share.promise, { maxAwayMs: 100 });
    });

    await moveTo('background');
    await wait(250);

    expect(session.status).toBe('unlocked');
  });

  it('does not lock while away for a pause that settled before its limit', async () => {
    await unlocked(0);
    const share = pending();
    let done!: Promise<void>;
    await act(async () => {
      done = session.withoutAutoLock(() => share.promise, { maxAwayMs: 200 });
    });

    await moveTo('background');
    await act(async () => {
      share.settle();
      await done;
    });
    await wait(300);

    // Ended while away: the rest of the trip is judged on return, as before.
    expect(session.status).toBe('unlocked');
  });

  it('drops pauses left pending by a session that ended, so the next one auto-locks', async () => {
    await unlocked(0);
    // System UI that never settles, e.g. a share sheet dismissed by the lock.
    await act(async () => {
      void session.withoutAutoLock(() => new Promise<void>(() => {}), sharePause());
    });
    await act(async () => {
      session.lock();
    });
    await act(async () => {
      await session.unlock();
    });

    const now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
    await moveTo('background');
    clock.mockReturnValue(now + 90_000);
    await moveTo('active');

    expect(session.status).toBe('locked');
    clock.mockRestore();
  });
});
