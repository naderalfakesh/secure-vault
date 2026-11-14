import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { allowDocumentStore, closeDocumentStore } from '@/data/database';

import vault from '../../modules/expo-vault';

const secureStoreMock = SecureStore as unknown as { __reset(): void };
const vaultMock = vault as unknown as { reset(): void };

const stub = (label: string) =>
  function Stub() {
    return <Text>{label}</Text>;
  };

// The real root layout and setup screens; the vault behind the gate is a stand-in.
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
  },
};

async function press(label: string) {
  await act(async () => fireEvent.press(screen.getByRole('button', { name: label })));
}

async function enterPin(pin: string) {
  for (const digit of pin) await press(digit);
}

async function storedSettings() {
  return JSON.parse((await SecureStore.getItemAsync('securevault.settings')) ?? '{}');
}

describe('onboarding', () => {
  beforeEach(async () => {
    vaultMock.reset();
    secureStoreMock.__reset();
    await closeDocumentStore();
    allowDocumentStore();
  });

  afterEach(() => jest.restoreAllMocks());

  async function throughIntro() {
    await renderRouter(routes, { initialUrl: '/' });
    await screen.findByRole('header', { name: 'One place for the papers that matter' });
    expect(screen.getByLabelText('Step 1 of 3')).toBeOnTheScreen();
    await press('Continue');
    expect(screen.getByLabelText('Step 2 of 3')).toBeOnTheScreen();
    await press('Continue');
    await screen.findByText(
      'Face ID opens the vault. A 6-digit PIN is always there as a backup, and the vault locks itself when you leave.',
    );
    await press('Set up your vault');
    await screen.findByRole('header', { name: 'Choose a 6-digit PIN' });
  }

  it('walks a first run through the intro, the PIN and the biometrics step to the vault', async () => {
    await throughIntro();
    expect(screen.getByText('Step 1 of 2')).toBeOnTheScreen();
    expect(screen.getByText('Your backup way in when Face ID isn’t available.')).toBeOnTheScreen();

    await enterPin('120399');
    await screen.findByRole('header', { name: 'Enter it again' });
    expect(screen.getByText('Step 2 of 2')).toBeOnTheScreen();
    await enterPin('120399');

    await screen.findByRole('header', { name: 'Unlock with Face ID?' });
    expect(
      screen.getByText(
        'Open the vault with a glance. Your PIN still works, and you can change this in Settings.',
      ),
    ).toBeOnTheScreen();
    await press('Not now');

    await screen.findByText('Vault home');
    expect((await storedSettings()).biometricUnlock).toBe(false);
  });

  it('asks the OS for Face ID from the biometrics step and keeps biometric unlock on', async () => {
    const authenticate = jest.spyOn(LocalAuthentication, 'authenticateAsync');
    await throughIntro();
    await enterPin('120399');
    await screen.findByRole('header', { name: 'Enter it again' });
    await enterPin('120399');
    await screen.findByRole('header', { name: 'Unlock with Face ID?' });

    await press('Use Face ID');

    await screen.findByText('Vault home');
    expect(authenticate).toHaveBeenCalledWith(
      expect.objectContaining({ disableDeviceFallback: true }),
    );
    expect((await storedSettings()).biometricUnlock).toBe(true);
  });

  it('lands on the vault after a refused Face ID prompt too', async () => {
    jest
      .spyOn(LocalAuthentication, 'authenticateAsync')
      .mockResolvedValue({ success: false, error: 'user_cancel' });
    await throughIntro();
    await enterPin('120399');
    await screen.findByRole('header', { name: 'Enter it again' });
    await enterPin('120399');
    await screen.findByRole('header', { name: 'Unlock with Face ID?' });

    await press('Use Face ID');

    await screen.findByText('Vault home');
    // Cancelling the prompt (its button also reads "Not now") is a no.
    expect((await storedSettings()).biometricUnlock).toBe(false);
  });

  it('skips the biometrics step when no biometrics are set up', async () => {
    jest.spyOn(LocalAuthentication, 'isEnrolledAsync').mockResolvedValue(false);
    await throughIntro();
    await enterPin('120399');
    await screen.findByRole('header', { name: 'Enter it again' });
    await enterPin('120399');

    await screen.findByText('Vault home');
    expect(screen.queryByText('Unlock with Face ID?')).toBeNull();
  });

  it('jumps from Skip straight to Choose PIN', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    await screen.findByRole('header', { name: 'One place for the papers that matter' });

    await press('Skip');

    await screen.findByRole('header', { name: 'Choose a 6-digit PIN' });
  });

  it('warns about an easy PIN without blocking it', async () => {
    await throughIntro();
    await enterPin('123456');

    await screen.findByText('This PIN is easy to guess.');
    expect(screen.getByRole('button', { name: '1' })).toBeDisabled();
    await press('Use it anyway');
    await screen.findByRole('header', { name: 'Enter it again' });
  });

  it('lets an easy PIN be swapped for another', async () => {
    await throughIntro();
    await enterPin('000000');
    await screen.findByText('This PIN is easy to guess.');

    await press('Choose another');

    await screen.findByRole('header', { name: 'Choose a 6-digit PIN' });
    expect(screen.queryByText('This PIN is easy to guess.')).toBeNull();
    expect(screen.getByLabelText('0 of 6 digits entered')).toBeOnTheScreen();
  });

  it('starts again with nothing saved when the PINs do not match', async () => {
    await throughIntro();
    await enterPin('120399');
    await screen.findByRole('header', { name: 'Enter it again' });
    await enterPin('120398');

    await screen.findByText('The PINs didn’t match. Start again.');
    await screen.findByRole('header', { name: 'Choose a 6-digit PIN' });
    expect(await SecureStore.getItemAsync('securevault.pin')).toBeNull();
  });

  it('explains a refused key prompt during setup and drops it once a new PIN starts', async () => {
    jest
      .spyOn(vault, 'unlockWithBiometrics')
      .mockRejectedValueOnce(
        Object.assign(new Error('Face Not Recognized'), { code: 'BIOMETRIC_AUTH_FAILED' }),
      );
    await throughIntro();
    await enterPin('120399');
    await screen.findByRole('header', { name: 'Enter it again' });
    await enterPin('120399');

    // Setup has no PIN to fall back to yet, so it does not offer one.
    await screen.findByText('The device key was not unlocked. Try again.');
    expect(screen.getByRole('header', { name: 'Choose a 6-digit PIN' })).toBeOnTheScreen();
    expect(screen.queryByText('That did not match. Try again or enter your PIN.')).toBeNull();

    await press('1');

    expect(screen.queryByText('The device key was not unlocked. Try again.')).toBeNull();
    expect(screen.getByText('Your backup way in when Face ID isn’t available.')).toBeOnTheScreen();
  });

  it('opens Add a PIN directly for a key without a PIN and skips the biometrics step', async () => {
    await vault.createVault();
    await vault.put('file_legacy', 'ciphertext');
    const createVault = jest.spyOn(vault, 'createVault');
    await renderRouter(routes, { initialUrl: '/' });

    await screen.findByRole('header', { name: 'Add a PIN to your vault' });
    expect(
      screen.getByText('Your documents stay where they are. The PIN is a second way in.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    await enterPin('120399');
    await screen.findByRole('header', { name: 'Enter it again' });
    await enterPin('120399');

    await screen.findByText('Vault home');
    expect(createVault).not.toHaveBeenCalled();
  });

  it('never shows the biometrics step before a PIN was chosen', async () => {
    await renderRouter(routes, { initialUrl: '/setup/biometrics' });

    await screen.findByRole('header', { name: 'One place for the papers that matter' });
    await waitFor(() => expect(screen.queryByText('Unlock with Face ID?')).toBeNull());
  });
});
