import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { Text } from 'react-native';

import LockScreen from '../../app/lock';
import { hashPasscode } from '../features/auth/passcode';
import { SessionProvider, useSession } from '../features/session/SessionProvider';
import { sessionStorage } from '../features/session/settings';

// The real key recovery wrapper over the in-memory vault, with an Android-style
// key whose authentication window has lapsed until the prompt is answered.
jest.mock('../../modules/expo-vault', () => {
  const { createVaultMock } = jest.requireActual(
    '../../modules/expo-vault/src/ExpoVaultModule.mock',
  );
  const { withKeyRecovery } = jest.requireActual('../../modules/expo-vault/src/withKeyRecovery');
  const native = createVaultMock();
  const state = { keyOpen: false, answer: false };
  const get = native.get.bind(native);
  native.biometryType = async () => 'none';
  native.get = async (key: string) => {
    if (!state.keyOpen) {
      throw Object.assign(new Error('User not authenticated'), { code: 'KEY_LOCKED' });
    }
    return get(key);
  };
  native.unlockWithBiometrics = jest.fn(async () => {
    state.keyOpen = state.answer;
    return state.answer;
  });
  return { __esModule: true, default: withKeyRecovery(native), native, state };
});

const { native, state } = jest.requireMock('../../modules/expo-vault') as {
  native: {
    reset(): void;
    put(key: string, value: string): Promise<void>;
    createVault(): Promise<void>;
    unlockWithBiometrics: jest.Mock;
  };
  state: { keyOpen: boolean; answer: boolean };
};
const secureStoreMock = SecureStore as unknown as { __reset(): void };

function Status() {
  return <Text testID="status">{useSession().status}</Text>;
}

async function lockedVault(storedLockout?: { failures: number; lockedUntil: number }) {
  native.reset();
  secureStoreMock.__reset();
  await native.createVault();
  await native.put('_key_probe', 'ok');
  await SecureStore.setItemAsync('securevault.pin', hashPasscode('123456', { iterations: 64 }));
  if (storedLockout) {
    await SecureStore.setItemAsync('securevault.lockout', JSON.stringify(storedLockout));
  }
  native.unlockWithBiometrics.mockClear();
  state.keyOpen = false;
  const view = await render(
    <SessionProvider>
      <LockScreen />
      <Status />
    </SessionProvider>,
  );
  await waitFor(() => expect(view.getByText('Enter your PIN')).toBeOnTheScreen());
  return view;
}

async function enterPin(view: Awaited<ReturnType<typeof lockedVault>>, pin: string) {
  for (const digit of pin) await fireEvent.press(view.getByRole('button', { name: digit }));
}

describe('LockScreen PIN unlock with a locked device key', () => {
  it('shows one prompt and does not count a cancelled prompt as a wrong PIN', async () => {
    state.answer = false;
    const view = await lockedVault();

    await enterPin(view, '123456');

    await waitFor(() =>
      expect(
        view.getByText('The device key was not unlocked. Enter your PIN to try again.'),
      ).toBeOnTheScreen(),
    );
    expect(native.unlockWithBiometrics).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('status')).toHaveTextContent('locked');
    expect(view.queryByText(/Wrong PIN/)).toBeNull();
    expect((await sessionStorage.loadLockout())?.failures).toBe(0);
  });

  it('still counts a wrong PIN without prompting', async () => {
    state.answer = false;
    const view = await lockedVault();

    await enterPin(view, '000000');

    await waitFor(() => expect(view.getByText(/Wrong PIN\. 4 attempts left/)).toBeOnTheScreen());
    expect(native.unlockWithBiometrics).not.toHaveBeenCalled();
    expect((await sessionStorage.loadLockout())?.failures).toBe(1);
  });

  it('keeps the counter from before a relaunch when the key prompt is cancelled', async () => {
    state.answer = false;
    const view = await lockedVault({ failures: 2, lockedUntil: 0 });

    await enterPin(view, '123456');

    await waitFor(() =>
      expect(
        view.getByText('The device key was not unlocked. Enter your PIN to try again.'),
      ).toBeOnTheScreen(),
    );
    expect(native.unlockWithBiometrics).toHaveBeenCalledTimes(1);
    expect(view.queryByText(/Wrong PIN/)).toBeNull();
    expect(await sessionStorage.loadLockout()).toEqual({ failures: 2, lockedUntil: 0 });

    await enterPin(view, '000000');

    await waitFor(() => expect(view.getByText(/Wrong PIN\. 2 attempts left/)).toBeOnTheScreen());
    expect(native.unlockWithBiometrics).toHaveBeenCalledTimes(1);
    expect(await sessionStorage.loadLockout()).toEqual({ failures: 3, lockedUntil: 0 });
  });

  it('shows a pause that was running before the relaunch and takes no PIN', async () => {
    state.answer = true;
    native.reset();
    secureStoreMock.__reset();
    await native.createVault();
    await native.put('_key_probe', 'ok');
    await SecureStore.setItemAsync('securevault.pin', hashPasscode('123456', { iterations: 64 }));
    await SecureStore.setItemAsync(
      'securevault.lockout',
      JSON.stringify({ failures: 5, lockedUntil: Date.now() + 20_000 }),
    );
    native.unlockWithBiometrics.mockClear();
    const view = await render(
      <SessionProvider>
        <LockScreen />
        <Status />
      </SessionProvider>,
    );

    await waitFor(() =>
      expect(view.getByText(/Too many attempts\. Try again in (19|20)s\./)).toBeOnTheScreen(),
    );
    await enterPin(view, '123456');
    expect(view.getByTestId('status')).toHaveTextContent('locked');
    expect(native.unlockWithBiometrics).not.toHaveBeenCalled();
    expect((await sessionStorage.loadLockout())?.failures).toBe(5);
  });

  it('unlocks after one answered prompt', async () => {
    state.answer = true;
    const view = await lockedVault();

    await enterPin(view, '123456');

    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unlocked'));
    expect(native.unlockWithBiometrics).toHaveBeenCalledTimes(1);
    expect(view.queryByText(/Wrong PIN|not unlocked/)).toBeNull();
  });
});
