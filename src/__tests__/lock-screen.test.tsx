import { fireEvent, render, waitFor } from '@testing-library/react-native';

import LockScreen from '../../app/lock';
import { hashPasscode } from '../features/auth/passcode';
import * as SecureStore from 'expo-secure-store';
import vault from '../../modules/expo-vault';
import { SessionProvider } from '../features/session/SessionProvider';

const secureStoreMock = SecureStore as unknown as { __reset(): void };
const vaultMock = vault as unknown as { reset(): void; unlockWithBiometrics(): Promise<boolean> };

describe('LockScreen', () => {
  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
  });

  it('offers the keypad and biometrics for an existing vault without the device warning', async () => {
    await vault.createVault();
    await SecureStore.setItemAsync('securevault.pin', hashPasscode('123456', { iterations: 64 }));
    const view = await render(
      <SessionProvider>
        <LockScreen />
      </SessionProvider>,
    );

    await waitFor(() => expect(view.getByText(/Use Face ID or enter your PIN/)).toBeOnTheScreen());
    expect(view.getByText('SecureVault is locked')).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Unlock with Face ID' })).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Use Face ID or passcode' })).toBeOnTheScreen();
    expect(view.getByRole('button', { name: '5' })).toBeOnTheScreen();
    expect(view.queryByText(/rooted or modified/)).toBeNull();
  });

  async function lockedVault(lockout?: { failures: number; lockedUntil: number }) {
    await vault.createVault();
    await SecureStore.setItemAsync('securevault.pin', hashPasscode('123456', { iterations: 64 }));
    if (lockout) await SecureStore.setItemAsync('securevault.lockout', JSON.stringify(lockout));
    // The automatic prompt is declined, so the keypad is what is left.
    jest.spyOn(vaultMock, 'unlockWithBiometrics').mockResolvedValue(false);
    const view = await render(
      <SessionProvider>
        <LockScreen />
      </SessionProvider>,
    );
    await waitFor(() =>
      expect(view.getByText(/^(SecureVault is locked|Try again in)/)).toBeOnTheScreen(),
    );
    return view;
  }

  afterEach(() => jest.restoreAllMocks());

  it('asks for the PIN first when biometric unlock was turned off', async () => {
    await vault.createVault();
    await SecureStore.setItemAsync('securevault.pin', hashPasscode('123456', { iterations: 64 }));
    await SecureStore.setItemAsync(
      'securevault.settings',
      JSON.stringify({ autoLockSeconds: 60, privacyScreen: true, biometricUnlock: false }),
    );
    const prompt = jest.spyOn(vaultMock, 'unlockWithBiometrics');
    const view = await render(
      <SessionProvider>
        <LockScreen />
      </SessionProvider>,
    );

    await waitFor(() => expect(view.getByText('Enter your PIN')).toBeOnTheScreen());
    expect(view.queryByRole('button', { name: 'Unlock with Face ID' })).toBeNull();
    expect(prompt).not.toHaveBeenCalled();
    // The device's own unlock stays offered; its prompt is the system's.
    expect(view.getByRole('button', { name: 'Use Face ID or passcode' })).toBeOnTheScreen();
  });

  it('fills the dots from the keypad and switches to the PIN subtitle', async () => {
    const view = await lockedVault();

    await fireEvent.press(view.getByRole('button', { name: '1' }));
    await fireEvent.press(view.getByRole('button', { name: '2' }));

    expect(view.getByLabelText('2 of 6 digits entered')).toBeOnTheScreen();
    expect(view.getByText('Enter your PIN')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Delete' }));
    expect(view.getByLabelText('1 of 6 digits entered')).toBeOnTheScreen();
  });

  it('dims the keypad to 32% once during a lockout and takes no digits', async () => {
    const view = await lockedVault({ failures: 5, lockedUntil: Date.now() + 30_000 });

    await waitFor(() => expect(view.getByText(/^Try again in 0:(29|30)$/)).toBeOnTheScreen());
    // The pad's own dim is the only one; no wrapper stacks another on top.
    expect(view.getByTestId('pin-pad')).toHaveStyle({ opacity: 0.32 });
    expect(view.getByTestId('pin-pad').parent?.props.style).not.toEqual(
      expect.objectContaining({ opacity: expect.any(Number) }),
    );
    expect(view.getByRole('button', { name: '1' })).toBeDisabled();
    expect(view.queryByRole('button', { name: 'Unlock with Face ID' })).toBeNull();
    expect(view.getByRole('button', { name: 'Use Face ID or passcode' })).toBeEnabled();
  });

  it('shows empty dimmed dots, not red ones, once a wrong PIN starts a lockout', async () => {
    const view = await lockedVault({ failures: 4, lockedUntil: 0 });

    for (const digit of ['9', '9', '9', '9', '9', '9']) {
      await fireEvent.press(view.getByRole('button', { name: digit }));
    }

    await waitFor(() => expect(view.getByText(/^Try again in /)).toBeOnTheScreen(), {
      timeout: 3000,
    });
    await waitFor(() =>
      expect(view.getByTestId('pin-dot-0', { includeHiddenElements: true })).toHaveStyle({
        borderWidth: 1.5,
        backgroundColor: 'transparent',
      }),
    );
  });
});
