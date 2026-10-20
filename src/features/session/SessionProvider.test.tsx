import { useEffect } from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus, Text } from 'react-native';

import { LOCKOUT_BASE_MS, LOCKOUT_THRESHOLD } from '../auth/lockout';
import { hashPasscode } from '../auth/passcode';
import * as SecureStore from 'expo-secure-store';
import vault from '../../../modules/expo-vault';
import { allowDocumentStore, closeDocumentStore } from '@/data/database';
import { documentService } from '@/services/DocumentService';
import {
  type PinUnlockResult,
  type SessionCapture,
  SessionProvider,
  useSession,
} from './SessionProvider';
import type { SecuritySettings } from './settings';

type AutoLockSeconds = SecuritySettings['autoLockSeconds'];
const secureStoreMock = SecureStore as unknown as { __reset(): void };
const vaultMock = vault as unknown as {
  reset(): void;
  unlockWithBiometrics: () => Promise<boolean>;
};

function Probe() {
  const session = useSession();
  return (
    <>
      <Text testID="status">{session.status}</Text>
      <Text testID="error">{session.error ?? ''}</Text>
      <Text testID="failures">{String(session.lockout.failures)}</Text>
      <Text testID="locked-until">{String(session.lockout.lockedUntil)}</Text>
      <Text testID="autolock">{String(session.settings.autoLockSeconds)}</Text>
      <Text onPress={() => void session.setUp('123456')}>run setup</Text>
      <Text onPress={() => void session.unlock()}>run unlock</Text>
      <Text onPress={() => void session.unlockWithPin('123456')}>run pin ok</Text>
      <Text onPress={() => void session.unlockWithPin('000000')}>run pin bad</Text>
      <Text onPress={() => void session.updateSettings({ autoLockSeconds: 900 })}>
        run settings
      </Text>
      <Text onPress={session.lock}>run lock</Text>
    </>
  );
}

function renderProbe() {
  return render(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
  );
}

describe('SessionProvider', () => {
  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts in setup when no vault exists, unlocks after PIN setup, and locks on demand', async () => {
    const view = await renderProbe();

    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
    await fireEvent.press(view.getByText('run setup'));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unlocked'));

    await fireEvent.press(view.getByText('run lock'));
    expect(view.getByTestId('status')).toHaveTextContent('locked');
  });

  it('unlocks with the right PIN and counts failures for the wrong one', async () => {
    const setup = await renderProbe();
    await waitFor(() => expect(setup.getByTestId('status')).toHaveTextContent('setup'));
    await fireEvent.press(setup.getByText('run setup'));
    await waitFor(() => expect(setup.getByTestId('status')).toHaveTextContent('unlocked'));
    await fireEvent.press(setup.getByText('run lock'));

    await fireEvent.press(setup.getByText('run pin bad'));
    await waitFor(() => expect(setup.getByTestId('failures')).toHaveTextContent('1'));
    expect(setup.getByTestId('status')).toHaveTextContent('locked');

    await fireEvent.press(setup.getByText('run pin ok'));
    await waitFor(() => expect(setup.getByTestId('status')).toHaveTextContent('unlocked'));
    expect(setup.getByTestId('failures')).toHaveTextContent('0');
  });

  it('persists settings across unlocks', async () => {
    const view = await renderProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
    await fireEvent.press(view.getByText('run setup'));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unlocked'));

    await fireEvent.press(view.getByText('run settings'));
    await waitFor(() => expect(view.getByTestId('autolock')).toHaveTextContent('900'));

    await fireEvent.press(view.getByText('run lock'));
    await fireEvent.press(view.getByText('run unlock'));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unlocked'));
    expect(view.getByTestId('autolock')).toHaveTextContent('900');
  });

  it('keeps an existing key when adding a PIN to a vault without one', async () => {
    await vault.createVault();
    await vault.put('file_legacy', 'ciphertext');
    const createVault = jest.spyOn(vault, 'createVault');

    const view = await renderProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
    await fireEvent.press(view.getByText('run setup'));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unlocked'));

    expect(createVault).not.toHaveBeenCalled();
    expect(await vault.get('file_legacy')).toBe('ciphertext');
    createVault.mockRestore();
  });

  it('replaces an invalidated device key when setting up an emptied vault', async () => {
    await vault.createVault();
    const keyInvalidated = () =>
      Object.assign(new Error('Key permanently invalidated'), { code: 'KEY_INVALIDATED' });
    let replaced = false;
    const createVault = jest.spyOn(vault, 'createVault').mockImplementation(async () => {
      replaced = true;
    });
    const put = vault.put.bind(vault);
    jest
      .spyOn(vault, 'put')
      .mockImplementation((key, value) =>
        replaced ? put(key, value) : Promise.reject(keyInvalidated()),
      );

    const view = await renderProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
    await fireEvent.press(view.getByText('run setup'));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unlocked'));

    expect(createVault).toHaveBeenCalledTimes(1);
    expect(await vault.get('_key_probe')).toBe('ok');
  });

  it('lets the index open again only once setup after "Delete everything" succeeded', async () => {
    await closeDocumentStore();
    allowDocumentStore();
    await vault.createVault();
    await documentService.eraseEverything();
    await expect(documentService.initialize()).rejects.toMatchObject({ code: 'VAULT_EMPTIED' });

    const view = await renderProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
    const unlock = jest.spyOn(vault, 'unlockWithBiometrics').mockResolvedValueOnce(false);
    await fireEvent.press(view.getByText('run setup'));
    await waitFor(() => expect(unlock).toHaveBeenCalledTimes(1));
    expect(view.getByTestId('status')).toHaveTextContent('setup');
    await expect(documentService.initialize()).rejects.toMatchObject({ code: 'VAULT_EMPTIED' });

    await fireEvent.press(view.getByText('run setup'));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unlocked'));
    await expect(documentService.initialize()).resolves.toBeUndefined();
  });

  it('keeps an invalidated device key while the vault still holds entries', async () => {
    await vault.createVault();
    await vault.put('file_legacy', 'ciphertext');
    jest
      .spyOn(vault, 'put')
      .mockRejectedValue(
        Object.assign(new Error('Key permanently invalidated'), { code: 'KEY_INVALIDATED' }),
      );
    const createVault = jest.spyOn(vault, 'createVault');

    const view = await renderProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
    await fireEvent.press(view.getByText('run setup'));
    await waitFor(() =>
      expect(view.getByTestId('error')).toHaveTextContent('Key permanently invalidated'),
    );

    expect(view.getByTestId('status')).toHaveTextContent('setup');
    expect(createVault).not.toHaveBeenCalled();
    expect(await vault.get('file_legacy')).toBe('ciphertext');
  });

  it('starts locked when a vault exists and surfaces biometric failures', async () => {
    await vault.createVault();
    await SecureStore.setItemAsync('securevault.pin', hashPasscode('123456', { iterations: 64 }));
    const original = vaultMock.unlockWithBiometrics;
    vaultMock.unlockWithBiometrics = async () => {
      throw Object.assign(new Error('Face Not Recognized'), { code: 'BIOMETRIC_AUTH_FAILED' });
    };

    const view = await renderProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('locked'));
    await act(async () => {
      await fireEvent.press(view.getByText('run unlock'));
    });
    expect(view.getByTestId('status')).toHaveTextContent('locked');
    expect(view.getByTestId('error')).toHaveTextContent(
      'That did not match. Try again or enter your PIN.',
    );

    vaultMock.unlockWithBiometrics = original;
  });
});

describe('SessionProvider session capture', () => {
  const appState = AppState as unknown as {
    currentState: AppStateStatus;
    addEventListener: jest.Mock;
  };
  const listeners = new Set<(state: AppStateStatus) => void>();
  const moveTo = (state: AppStateStatus) =>
    act(async () => {
      appState.currentState = state;
      for (const listener of [...listeners]) listener(state);
    });

  let session: ReturnType<typeof useSession>;
  function Capture() {
    const value = useSession();
    useEffect(() => {
      session = value;
    });
    return <Text testID="status">{value.status}</Text>;
  }

  async function unlocked(autoLockSeconds: AutoLockSeconds = 0) {
    const view = await render(
      <SessionProvider>
        <Capture />
      </SessionProvider>,
    );
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
    await act(async () => {
      await session.setUp('123456');
    });
    await act(async () => {
      await session.updateSettings({ autoLockSeconds });
    });
    expect(view.getByTestId('status')).toHaveTextContent('unlocked');
    return view;
  }

  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
    listeners.clear();
    appState.currentState = 'active';
    appState.addEventListener.mockImplementation(
      (_event: string, listener: (state: AppStateStatus) => void) => {
        listeners.add(listener);
        return { remove: () => listeners.delete(listener) };
      },
    );
  });

  it('confirms the same unlocked session in the foreground', async () => {
    await unlocked();
    const capture = session.captureSession();
    expect(capture.current()).toBe(true);
    await expect(capture.confirm()).resolves.toBe(true);
  });

  it('never confirms a session that ended, even after the next unlock', async () => {
    await unlocked();
    const capture = session.captureSession();
    await act(async () => {
      session.lock();
    });
    expect(capture.current()).toBe(false);
    await expect(capture.confirm()).resolves.toBe(false);

    await act(async () => {
      await session.unlock();
    });
    expect(session.status).toBe('unlocked');
    expect(capture.current()).toBe(false);
    await expect(capture.confirm()).resolves.toBe(false);
  });

  it('waits out a trip to the background and fails when auto-lock locks on return', async () => {
    await unlocked(0);
    const capture = session.captureSession();
    await moveTo('background');
    let outcome: boolean | null = null;
    void capture.confirm().then((value) => {
      outcome = value;
    });
    await act(async () => {});
    expect(outcome).toBeNull();

    await moveTo('active');
    await waitFor(() => expect(outcome).toBe(false));
    expect(session.status).toBe('locked');
  });

  it('waits out a trip to the background and confirms when auto-lock allows the time away', async () => {
    await unlocked(300);
    const capture: SessionCapture = session.captureSession();
    await moveTo('inactive');
    let outcome: boolean | null = null;
    void capture.confirm().then((value) => {
      outcome = value;
    });
    await act(async () => {});
    expect(outcome).toBeNull();

    await moveTo('active');
    await waitFor(() => expect(outcome).toBe(true));
    expect(session.status).toBe('unlocked');
  });

  it('holds a notice until the vault is unlocked and forgets it when the vault is erased', async () => {
    await unlocked();
    await act(async () => {
      session.postNotice({ message: 'Done' });
    });
    expect(session.notice).toEqual({ message: 'Done' });
    await act(async () => {
      session.dismissNotice();
    });
    expect(session.notice).toBeNull();

    await act(async () => {
      session.postNotice({ message: 'Again' });
    });
    await act(async () => {
      await session.eraseVault();
    });
    expect(session.notice).toBeNull();
  });
});

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
    let session: ReturnType<typeof useSession> | null = null;
    function Capture() {
      const value = useSession();
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
    let session: ReturnType<typeof useSession> | null = null;
    function Capture() {
      const value = useSession();
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
