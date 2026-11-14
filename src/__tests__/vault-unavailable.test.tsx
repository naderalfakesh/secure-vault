import * as SecureStore from 'expo-secure-store';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { File, Paths } from 'expo-file-system';
import { Alert, Platform, Text } from 'react-native';

import vault from '../../modules/expo-vault';
import { hashPasscode } from '@/testing/passcode';

const secureStoreMock = SecureStore as unknown as { __reset(): void };
const vaultMock = vault as unknown as { reset(): void };

const stub = (label: string) =>
  function Stub() {
    return <Text>{label}</Text>;
  };

// The real root layout, lock screen and unavailable screen; the rest are stand-ins.
const routes = {
  appDir: 'app',
  overrides: {
    '(tabs)/index': stub('Vault home'),
    '(tabs)/settings': stub('Settings screen'),
    'documents/[id]': stub('Document detail'),
    'documents/add': stub('Add document'),
    'settings/change-pin': stub('Change PIN'),
    'settings/auto-lock': stub('Auto-lock page'),
    'settings/protection': stub('Protection page'),
    'setup/index': stub('Welcome'),
    'setup/pin': stub('Choose a PIN'),
    'setup/biometrics': stub('Biometrics step'),
  },
};

const TITLE = 'SecureVault can’t open right now';
const keyReadFailure = () =>
  Object.assign(new Error('KeyStore load failed'), { code: 'HAS_VAULT_FAILED' });

describe('Vault unavailable', () => {
  let errors: string[];
  let consoleError: jest.SpyInstance;

  beforeEach(async () => {
    vaultMock.reset();
    secureStoreMock.__reset();
    await vault.createVault();
    await SecureStore.setItemAsync('securevault.pin', hashPasscode('123456', { iterations: 64 }));
    errors = [];
    consoleError = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(String(args[0]));
      if (errors.length > 20) throw new Error(`console.error flood: ${errors[0]}`);
    });
  });

  afterEach(() => {
    consoleError.mockRestore();
    jest.restoreAllMocks();
  });

  it('shows the unavailable screen, not setup, when the key cannot be read', async () => {
    jest.spyOn(vault, 'hasVault').mockRejectedValue(keyReadFailure());
    await renderRouter(routes, { initialUrl: '/' });

    expect(await screen.findByRole('header', { name: TITLE })).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Your phone didn’t give SecureVault access to its key. Nothing in the vault was touched.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Try again. If this keeps happening, restart your phone and open SecureVault again.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Welcome')).toBeNull();
    // Try again is the only control.
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(errors.filter((message) => message.includes('Maximum update depth'))).toEqual([]);
  });

  it('never opens setup or the vault by URL while unavailable', async () => {
    jest.spyOn(vault, 'hasVault').mockRejectedValue(keyReadFailure());
    await renderRouter(routes, { initialUrl: '/setup/pin' });

    await screen.findByText(TITLE);
    expect(screen.queryByText('Choose a PIN')).toBeNull();
    expect(screen.queryByText('Vault home')).toBeNull();
  });

  it('shows the busy label while trying again and opens the lock screen once it works', async () => {
    jest.spyOn(vault, 'unlockWithBiometrics').mockResolvedValue(false);
    let release: (exists: boolean) => void = () => {};
    jest
      .spyOn(vault, 'hasVault')
      .mockRejectedValueOnce(keyReadFailure())
      .mockImplementationOnce(() => new Promise<boolean>((resolve) => (release = resolve)));
    await renderRouter(routes, { initialUrl: '/' });
    await screen.findByText(TITLE);

    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Try again' })));

    const busy = await screen.findByRole('button', { name: 'Trying again…' });
    expect(busy).toBeBusy();
    await act(async () => release(true));
    await screen.findByText(/enter your PIN/);
    await waitFor(() => expect(screen.queryByText(TITLE)).toBeNull());
  });

  it('stays on the unavailable screen when trying again fails again', async () => {
    jest.spyOn(vault, 'hasVault').mockRejectedValue(keyReadFailure());
    await renderRouter(routes, { initialUrl: '/' });
    await screen.findByText(TITLE);

    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Try again' })));

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeOnTheScreen();
    expect(screen.getByText(TITLE)).toBeOnTheScreen();
  });

  it('offers a new PIN behind the device key when the PIN record was lost', async () => {
    // The record was written (its marker is there) and the secure store dropped it.
    new File(Paths.document, 'securevault-session', 'pin').create({ intermediates: true });
    await SecureStore.deleteItemAsync('securevault.pin');
    await renderRouter(routes, { initialUrl: '/' });

    await screen.findByText(TITLE);
    expect(
      screen.getByText(
        'SecureVault can’t read your PIN. Your documents are still there, encrypted with your phone’s key.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Welcome')).toBeNull();

    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Set a new PIN' })));

    expect(await screen.findByText('Welcome')).toBeOnTheScreen();
  });

  it.each([
    ['ios', 'faceId', 'Unlock with Face ID or your passcode to set a new PIN.'],
    ['ios', 'touchId', 'Unlock with Touch ID or your passcode to set a new PIN.'],
    ['ios', 'none', 'Unlock with your passcode to set a new PIN.'],
    [
      'android',
      'biometrics',
      'Unlock with your fingerprint, face or screen lock to set a new PIN.',
    ],
    ['android', 'none', 'Unlock with your screen lock to set a new PIN.'],
  ] as const)(
    'names only %s’s own way to unlock (%s) for a lost PIN',
    async (os, biometry, hint) => {
      const platform = Platform.OS;
      Platform.OS = os;
      try {
        jest.spyOn(vault, 'biometryType').mockResolvedValue(biometry);
        new File(Paths.document, 'securevault-session', 'pin').create({ intermediates: true });
        await SecureStore.deleteItemAsync('securevault.pin');
        await renderRouter(routes, { initialUrl: '/' });

        expect(await screen.findByText(hint)).toBeOnTheScreen();
      } finally {
        Platform.OS = platform;
      }
    },
  );

  it('offers Delete everything as the way out when the lost PIN guards a key that can no longer decrypt', async () => {
    new File(Paths.document, 'securevault-session', 'pin').create({ intermediates: true });
    await SecureStore.deleteItemAsync('securevault.pin');
    await vault.put('file_kept', 'ciphertext');
    jest
      .spyOn(vault, 'get')
      .mockRejectedValue(Object.assign(new Error('invalidated'), { code: 'KEY_INVALIDATED' }));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _body, buttons) => {
      const destructive = buttons?.find((button) => button.style === 'destructive');
      void destructive?.onPress?.();
    });
    await renderRouter(routes, { initialUrl: '/' });
    await screen.findByText(TITLE);

    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Set a new PIN' })));

    expect(await screen.findByText(/screen lock or biometrics changed/i)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Set a new PIN' })).toBeNull();
    await act(async () =>
      fireEvent.press(screen.getByRole('button', { name: 'Delete everything' })),
    );

    expect(alert).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Welcome')).toBeOnTheScreen();
    expect(await vault.getAllKeys()).toEqual([]);
    expect(new File(Paths.document, 'securevault-session', 'pin').exists).toBe(false);
  });

  it('offers only Delete everything when the device key is gone but entries remain', async () => {
    // The PIN record and the key went with the removed screen lock; 11 entries stayed.
    new File(Paths.document, 'securevault-session', 'pin').create({ intermediates: true });
    await SecureStore.deleteItemAsync('securevault.pin');
    await vault.put('file_kept', 'ciphertext');
    await vault.deleteDeviceKey();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _body, buttons) => {
      const destructive = buttons?.find((button) => button.style === 'destructive');
      void destructive?.onPress?.();
    });
    await renderRouter(routes, { initialUrl: '/' });

    expect(
      await screen.findByText(
        'The key that opens this vault is no longer on this phone, so the documents in it can’t be opened here.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Welcome')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Set a new PIN' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    await act(async () =>
      fireEvent.press(screen.getByRole('button', { name: 'Delete everything' })),
    );

    expect(alert).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Welcome')).toBeOnTheScreen();
    expect(await vault.getAllKeys()).toEqual([]);
  });
});
