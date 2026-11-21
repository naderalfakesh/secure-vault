import { act } from '@testing-library/react-native';

import { moveAppStateTo, resetAppState } from '@/testing/appState';
import { secureStoreMock } from '@/testing/secureStore';
import { unlocked, session, wait } from '@/testing/sessionProvider';
import { vaultMock } from '@/testing/vault';

import { AUTO_LOCK_RETURN_GRACE_MS } from '../SessionProvider';

describe('SessionProvider session capture', () => {
  const moveTo = moveAppStateTo;

  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
    resetAppState();
  });

  describe('an Android chooser that settles before the app is active again (H1)', () => {
    const androidShare = { maxAwayMs: 2 * 60_000, endsOnReturn: true };

    /**
     * Opens a pending pause, leaves the foreground, and settles it `awayMs`
     * later while still away, the way Android delivers the chooser's Back or a
     * pick just before the activity resumes.
     */
    async function settleAway<T>(
      awayMs: number,
      result: T,
      pause: { maxAwayMs?: number; endsOnReturn?: boolean } = androidShare,
    ) {
      let settle!: (value: T) => void;
      const work = new Promise<T>((resolve) => {
        settle = resolve;
      });
      let done!: Promise<T>;
      await act(async () => {
        done = session.withoutAutoLock(() => work, pause);
      });
      const now = Date.now();
      const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
      await moveTo('background');
      clock.mockReturnValue(now + awayMs);
      await act(async () => {
        settle(result);
        await done;
      });
      return { clock, now };
    }

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('locks when the chooser stayed up past its bound and was closed with Back', async () => {
      await unlocked(0);
      const { clock, now } = await settleAway(3 * 60_000, { action: 'dismissed' });
      clock.mockReturnValue(now + 3 * 60_000 + 200);
      await moveTo('active');

      expect(session.status).toBe('locked');
    });

    it('locks when the chooser stayed up past its bound and a target was picked', async () => {
      await unlocked(0);
      const { clock, now } = await settleAway(2 * 60_000 + 5_000, { action: 'shared' });
      // Locked before the return, so a waiting share is never confirmed.
      expect(session.status).toBe('locked');
      clock.mockReturnValue(now + 2 * 60_000 + 5_300);
      await moveTo('active');

      expect(session.status).toBe('locked');
    });

    it('keeps the vault open for a chooser closed within its bound', async () => {
      await unlocked(300);
      const { clock, now } = await settleAway(90_000, { action: 'shared' });
      clock.mockReturnValue(now + 90_200);
      await moveTo('active');

      expect(session.status).toBe('unlocked');
    });

    it('keeps the vault open for a chooser closed within its bound with auto-lock Immediately', async () => {
      await unlocked(0);
      const { clock, now } = await settleAway(90_000, { action: 'dismissed' });
      clock.mockReturnValue(now + 90_200);
      await moveTo('active');

      expect(session.status).toBe('unlocked');
    });

    it('judges the whole trip against auto-lock once the bound has passed', async () => {
      await unlocked(300);
      const { clock, now } = await settleAway(4 * 60_000, { action: 'dismissed' });
      // Past the bound but within auto-lock: still open while away.
      expect(session.status).toBe('unlocked');
      // The return comes 6 minutes after the app first left, past auto-lock.
      clock.mockReturnValue(now + 6 * 60_000);
      await moveTo('active');

      expect(session.status).toBe('locked');
    });

    it('locks on return when the user left the chooser with Home and came back later', async () => {
      await unlocked(0);
      let done!: Promise<void>;
      await act(async () => {
        done = session.withoutAutoLock(() => new Promise<void>(() => {}), androidShare);
      });
      void done;
      const now = Date.now();
      const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
      await moveTo('background');
      clock.mockReturnValue(now + 3 * 60_000);
      await moveTo('active');

      expect(session.status).toBe('locked');
    });

    describe('Home from the chooser within its bound', () => {
      /**
       * Opens the chooser's pause and leaves the foreground. Home stops the
       * activity `homeAfterMs` later; Android delivers the chooser's result only
       * with the return, `returnAfterMs` after the app first left.
       */
      async function leaveWithHome(homeAfterMs: number) {
        let settle!: (value: { action: string }) => void;
        const work = new Promise<{ action: string }>((resolve) => {
          settle = resolve;
        });
        let done!: Promise<{ action: string }>;
        await act(async () => {
          done = session.withoutAutoLock(() => work, androidShare);
        });
        const now = Date.now();
        const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
        await moveTo('background');
        vaultMock.stopActivity(now + homeAfterMs);
        return {
          now,
          clock,
          /** The result lands just before the app is active again, as Android orders it. */
          resultThenActive: async (returnAfterMs: number) => {
            clock.mockReturnValue(now + returnAfterMs);
            await act(async () => {
              settle({ action: 'dismissed' });
              await done;
            });
            clock.mockReturnValue(now + returnAfterMs + 150);
            await moveTo('active');
          },
          /** The app is active again first, and the result follows. */
          activeThenResult: async (returnAfterMs: number) => {
            clock.mockReturnValue(now + returnAfterMs);
            await moveTo('active');
            clock.mockReturnValue(now + returnAfterMs + 150);
            await act(async () => {
              settle({ action: 'dismissed' });
              await done;
            });
          },
        };
      }

      it('locks on return with auto-lock Immediately when the result lands first', async () => {
        await unlocked(0);
        const trip = await leaveWithHome(10_000);
        await trip.resultThenActive(22_000);

        expect(session.status).toBe('locked');
      });

      it('locks on return with auto-lock Immediately when the return comes first', async () => {
        await unlocked(0);
        const trip = await leaveWithHome(10_000);
        await trip.activeThenResult(22_000);
        await wait(AUTO_LOCK_RETURN_GRACE_MS + 100);

        expect(session.status).toBe('locked');
      });

      it('counts only the time since Home against a longer auto-lock', async () => {
        await unlocked(60);
        const trip = await leaveWithHome(70_000);
        // 70 s under the chooser are excused; the 30 s since Home are not past 1 minute.
        await trip.resultThenActive(100_000);

        expect(session.status).toBe('unlocked');
      });

      it('locks once the time since Home passes a longer auto-lock', async () => {
        await unlocked(60);
        const trip = await leaveWithHome(10_000);
        await trip.resultThenActive(75_000);

        expect(session.status).toBe('locked');
      });

      it('ignores a stop from before the chooser opened, so Back within the bound stays open', async () => {
        await unlocked(0);
        vaultMock.stopActivity(Date.now() - 5_000);
        const { clock, now } = await settleAway(90_000, { action: 'dismissed' });
        clock.mockReturnValue(now + 90_200);
        await moveTo('active');

        expect(session.status).toBe('unlocked');
      });
    });

    it('applies the same rule to a picker that answers after its bound', async () => {
      await unlocked(0);
      const { clock, now } = await settleAway(11 * 60_000, { canceled: true }, {});
      clock.mockReturnValue(now + 11 * 60_000 + 200);
      await moveTo('active');

      expect(session.status).toBe('locked');
    });

    it('starts the next session without the time a locked trip was being timed', async () => {
      await unlocked(300);
      const { clock, now } = await settleAway(4 * 60_000, { action: 'dismissed' });
      await act(async () => {
        session.lock();
      });
      await act(async () => {
        await session.unlock();
      });
      await moveTo('active');
      // A new trip of 90 seconds, measured from its own start.
      await moveTo('background');
      clock.mockReturnValue(now + 5 * 60_000 + 30_000);
      await moveTo('active');

      expect(session.status).toBe('unlocked');
    });
  });
});
