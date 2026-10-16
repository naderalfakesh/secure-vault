import { useEffect } from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus, Text } from 'react-native';

import { hashPasscode } from '../auth/passcode';
import * as SecureStore from 'expo-secure-store';
import vault from '../../../modules/expo-vault';
import { type SessionCapture, SessionProvider, useSession } from './SessionProvider';
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
