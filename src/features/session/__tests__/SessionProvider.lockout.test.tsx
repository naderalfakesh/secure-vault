import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { LOCKOUT_BASE_MS, LOCKOUT_THRESHOLD } from '@/features/auth/lockout';
import { hashPasscode } from '@/testing/passcode';
import { secureStoreMock } from '@/testing/secureStore';
import { useSessionValue, type Session } from '@/testing/session';
import { renderProbe } from '@/testing/sessionProvider';
import { vaultMock } from '@/testing/vault';
import vault from '@modules/expo-vault';

import { type PinUnlockResult, SessionProvider } from '../SessionProvider';

describe('SessionProvider PIN lockout across relaunches', () => {
  const LOCKOUT_ENTRY = 'securevault.lockout';
  const realNow = Date.now.bind(Date);
  let offset = 0;

  async function lockedVault() {
    await vault.createVault();
    await SecureStore.setItemAsync('securevault.pin', hashPasscode('123456', { iterations: 64 }));
  }

  async function launch() {
    const view = await renderProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('locked'));
    return view;
  }

  async function stored() {
    const raw = await SecureStore.getItemAsync(LOCKOUT_ENTRY);
    return raw ? JSON.parse(raw) : null;
  }

  async function wrongPins(view: Awaited<ReturnType<typeof launch>>, count: number) {
    const start = Number(view.getByTestId('failures').props.children);
    for (let attempt = 1; attempt <= count; attempt += 1) {
      await fireEvent.press(view.getByText('run pin bad'));
      await waitFor(() =>
        expect(view.getByTestId('failures')).toHaveTextContent(String(start + attempt)),
      );
    }
  }

  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
    offset = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => realNow() + offset);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps a running pause and its remaining time after a relaunch', async () => {
    await lockedVault();
    const first = await launch();
    await wrongPins(first, LOCKOUT_THRESHOLD);
    const pausedUntil = (await stored()).lockedUntil;
    expect(pausedUntil).toBeGreaterThan(Date.now());
    await first.unmount();

    const second = await launch();
    expect(second.getByTestId('failures')).toHaveTextContent(String(LOCKOUT_THRESHOLD));
    expect(second.getByTestId('locked-until')).toHaveTextContent(String(pausedUntil));

    // The right PIN is refused and the stored counter is left alone.
    await fireEvent.press(second.getByText('run pin ok'));
    await act(async () => {});
    expect(second.getByTestId('status')).toHaveTextContent('locked');
    expect(await stored()).toEqual({ failures: LOCKOUT_THRESHOLD, lockedUntil: pausedUntil });

    offset = LOCKOUT_BASE_MS + 1;
    await fireEvent.press(second.getByText('run pin ok'));
    await waitFor(() => expect(second.getByTestId('status')).toHaveTextContent('unlocked'));
    expect(await stored()).toEqual({ failures: 0, lockedUntil: 0 });
  });

  it('continues the failure count after a relaunch instead of starting over', async () => {
    await lockedVault();
    const first = await launch();
    await wrongPins(first, 2);
    await first.unmount();

    const second = await launch();
    expect(second.getByTestId('failures')).toHaveTextContent('2');
    await wrongPins(second, 1);
    expect(await stored()).toEqual({ failures: 3, lockedUntil: 0 });

    await wrongPins(second, 2);
    expect((await stored()).lockedUntil).toBeGreaterThan(Date.now());
  });

  it('judges an attempt against the stored lockout when it is stricter than memory', async () => {
    await lockedVault();
    const view = await launch();
    await SecureStore.setItemAsync(
      LOCKOUT_ENTRY,
      JSON.stringify({ failures: 5, lockedUntil: Date.now() + 60_000 }),
    );

    await fireEvent.press(view.getByText('run pin ok'));
    await waitFor(() => expect(view.getByTestId('failures')).toHaveTextContent('5'));
    expect(view.getByTestId('status')).toHaveTextContent('locked');
  });

  it('keeps counting in memory when the lockout cannot be saved', async () => {
    await lockedVault();
    const view = await launch();
    const setItem = SecureStore.setItemAsync;
    jest.spyOn(SecureStore, 'setItemAsync').mockImplementation(async (key, value, options) => {
      if (key === LOCKOUT_ENTRY) throw new Error('write failed');
      return setItem(key, value, options);
    });

    await wrongPins(view, LOCKOUT_THRESHOLD);
    expect(Number(view.getByTestId('locked-until').props.children)).toBeGreaterThan(Date.now());
    await fireEvent.press(view.getByText('run pin ok'));
    await act(async () => {});
    expect(view.getByTestId('status')).toHaveTextContent('locked');
  });

  it('starts with a pause that ends on its own when the stored lockout cannot be read', async () => {
    await lockedVault();
    await SecureStore.setItemAsync(LOCKOUT_ENTRY, JSON.stringify({ failures: 12, lockedUntil: 0 }));
    const getItem = SecureStore.getItemAsync;
    const read = jest
      .spyOn(SecureStore, 'getItemAsync')
      .mockImplementation(async (key, options) => {
        if (key === LOCKOUT_ENTRY) throw new Error('read failed');
        return getItem(key, options);
      });
    const save = jest.spyOn(SecureStore, 'setItemAsync');

    const view = await launch();
    expect(view.getByTestId('failures')).toHaveTextContent('0');
    expect(Number(view.getByTestId('locked-until').props.children)).toBeGreaterThan(Date.now());

    await fireEvent.press(view.getByText('run pin ok'));
    await act(async () => {});
    expect(view.getByTestId('status')).toHaveTextContent('locked');

    // A wrong PIN still counts, but never overwrites a copy that could not be read.
    offset = LOCKOUT_BASE_MS + 1;
    await wrongPins(view, 1);
    expect(save).not.toHaveBeenCalledWith(LOCKOUT_ENTRY, expect.anything(), expect.anything());
    read.mockRestore();
    expect(await stored()).toEqual({ failures: 12, lockedUntil: 0 });

    // Once the pause is over the owner gets in, and a readable store wins again.
    await fireEvent.press(view.getByText('run pin ok'));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unlocked'));
    expect(await stored()).toEqual({ failures: 0, lockedUntil: 0 });
  });

  it('caps a corrupt far-future pause and writes the cap back', async () => {
    await lockedVault();
    await SecureStore.setItemAsync(
      LOCKOUT_ENTRY,
      JSON.stringify({ failures: 5, lockedUntil: 1e15 }),
    );

    const view = await launch();
    const capped = (await stored()).lockedUntil;
    expect(capped).toBeLessThanOrEqual(Date.now() + LOCKOUT_BASE_MS);
    expect(view.getByTestId('locked-until')).toHaveTextContent(String(capped));

    await fireEvent.press(view.getByText('run pin ok'));
    await act(async () => {});
    expect(view.getByTestId('status')).toHaveTextContent('locked');

    offset = LOCKOUT_BASE_MS + 1;
    await fireEvent.press(view.getByText('run pin ok'));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unlocked'));
  });

  it('ends a pause on time after the clock was moved back a year', async () => {
    await lockedVault();
    const first = await launch();
    await wrongPins(first, LOCKOUT_THRESHOLD);
    await first.unmount();

    offset = -365 * 24 * 3_600_000;
    const second = await launch();
    const capped = (await stored()).lockedUntil;
    expect(capped).toBeLessThanOrEqual(Date.now() + LOCKOUT_BASE_MS);
    expect(second.getByTestId('locked-until')).toHaveTextContent(String(capped));

    // Later attempts judge against the written-back cap, which does not slide.
    offset += LOCKOUT_BASE_MS / 2;
    await fireEvent.press(second.getByText('run pin ok'));
    await act(async () => {});
    expect(second.getByTestId('status')).toHaveTextContent('locked');
    expect((await stored()).lockedUntil).toBe(capped);

    offset += LOCKOUT_BASE_MS;
    await fireEvent.press(second.getByText('run pin ok'));
    await waitFor(() => expect(second.getByTestId('status')).toHaveTextContent('unlocked'));
  });

  it('does not pad the stored count after a read failure at launch clears up', async () => {
    await lockedVault();
    await SecureStore.setItemAsync(LOCKOUT_ENTRY, JSON.stringify({ failures: 2, lockedUntil: 0 }));
    const getItem = SecureStore.getItemAsync;
    const read = jest
      .spyOn(SecureStore, 'getItemAsync')
      .mockImplementation(async (key, options) => {
        if (key === LOCKOUT_ENTRY) throw new Error('interaction not allowed');
        return getItem(key, options);
      });

    const view = await launch();
    expect(view.getByTestId('failures')).toHaveTextContent('0');
    expect(Number(view.getByTestId('locked-until').props.children)).toBeGreaterThan(Date.now());
    read.mockRestore();

    offset = LOCKOUT_BASE_MS + 1;
    await fireEvent.press(view.getByText('run pin bad'));
    await waitFor(() => expect(view.getByTestId('failures')).toHaveTextContent('3'));
    expect(await stored()).toEqual({ failures: 3, lockedUntil: 0 });
  });

  it('pauses on content that is not JSON and replaces it with the next count', async () => {
    await lockedVault();
    await SecureStore.setItemAsync(LOCKOUT_ENTRY, 'not json');

    const view = await launch();
    expect(view.getByTestId('failures')).toHaveTextContent('0');
    const pausedUntil = Number(view.getByTestId('locked-until').props.children);
    expect(pausedUntil).toBeGreaterThan(Date.now());
    expect(await stored()).toEqual({ failures: 0, lockedUntil: pausedUntil });

    offset = LOCKOUT_BASE_MS + 1;
    await wrongPins(view, 1);
    expect(await stored()).toEqual({ failures: 1, lockedUntil: 0 });
  });

  it('judges one PIN attempt at a time so none of them is lost', async () => {
    await lockedVault();
    let session: Session | null = null;
    function Capture() {
      const value = useSessionValue();
      useEffect(() => {
        session = value;
      });
      return <Text testID="status">{value.status}</Text>;
    }
    const view = await render(
      <SessionProvider>
        <Capture />
      </SessionProvider>,
    );
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('locked'));

    let results: PinUnlockResult[] = [];
    await act(async () => {
      results = await Promise.all([
        session!.unlockWithPin('000000'),
        session!.unlockWithPin('000001'),
      ]);
    });
    expect(results).toEqual(['wrong-pin', 'not-unlocked']);
    expect(await stored()).toEqual({ failures: 1, lockedUntil: 0 });

    await act(async () => {
      results = [await session!.unlockWithPin('000000')];
    });
    expect(results).toEqual(['wrong-pin']);
    expect(await stored()).toEqual({ failures: 2, lockedUntil: 0 });
  });

  it('ignores PIN attempts until the stored lockout has been read', async () => {
    await lockedVault();
    let finishStartup: (exists: boolean) => void = () => {};
    jest
      .spyOn(vault, 'hasVault')
      .mockImplementationOnce(() => new Promise<boolean>((resolve) => (finishStartup = resolve)));
    let session: Session | null = null;
    function Capture() {
      const value = useSessionValue();
      useEffect(() => {
        session = value;
      });
      return <Text testID="status">{value.status}</Text>;
    }
    const view = await render(
      <SessionProvider>
        <Capture />
      </SessionProvider>,
    );
    expect(view.getByTestId('status')).toHaveTextContent('loading');

    let result: PinUnlockResult | null = null;
    await act(async () => {
      result = await session!.unlockWithPin('000000');
    });
    expect(result).toBe('not-unlocked');
    expect(await stored()).toBeNull();

    await act(async () => finishStartup(true));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('locked'));
    expect(session!.lockout.failures).toBe(0);
  });
});
