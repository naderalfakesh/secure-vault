import { act, fireEvent, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import { documentDatabase } from '@/data/database';
import { documentService } from '@/services/DocumentService';
import { hashPasscode } from '@/testing/passcode';
import { secureStoreMock } from '@/testing/secureStore';
import { renderProbe } from '@/testing/sessionProvider';
import { vaultMock } from '@/testing/vault';
import vault from '@modules/expo-vault';

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
    await documentDatabase.close();
    documentDatabase.allow();
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
      expect(view.getByTestId('error')).toHaveTextContent(
        "This device's screen lock or biometrics changed, so the vault key can no longer be used. The documents already in this vault cannot be opened on this device.",
      ),
    );
    expect(view.getByTestId('error')).not.toHaveTextContent(/permanently invalidated/);

    expect(view.getByTestId('status')).toHaveTextContent('setup');
    expect(createVault).not.toHaveBeenCalled();
    expect(await vault.get('file_legacy')).toBe('ciphertext');
  });

  it('shows a plain sentence when the device key prompt ends with the native key-locked text', async () => {
    await vault.createVault();
    await SecureStore.setItemAsync('securevault.pin', hashPasscode('123456', { iterations: 64 }));
    jest
      .spyOn(vault, 'unlockWithBiometrics')
      .mockRejectedValue(
        Object.assign(new Error('User not authenticated'), { code: 'KEY_LOCKED' }),
      );

    const view = await renderProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('locked'));
    await act(async () => {
      await fireEvent.press(view.getByText('run unlock'));
    });

    expect(view.getByTestId('error')).toHaveTextContent(
      'The device key was not unlocked. Enter your PIN to try again.',
    );
  });

  it('does not ask for a PIN that setup has not created yet when the key prompt ends key-locked', async () => {
    jest
      .spyOn(vault, 'unlockWithBiometrics')
      .mockRejectedValue(
        Object.assign(new Error('User not authenticated'), { code: 'KEY_LOCKED' }),
      );

    const view = await renderProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
    await act(async () => {
      await fireEvent.press(view.getByText('run setup'));
    });

    expect(view.getByTestId('error')).toHaveTextContent(
      'The device key was not unlocked. Try again.',
    );
    expect(view.getByTestId('error')).not.toHaveTextContent(/PIN/);
  });

  it('says the PIN was not changed when the key prompt ends key-locked', async () => {
    const view = await renderProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
    await fireEvent.press(view.getByText('run setup'));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unlocked'));
    jest
      .spyOn(SecureStore, 'setItemAsync')
      .mockRejectedValue(
        Object.assign(new Error('User not authenticated'), { code: 'KEY_LOCKED' }),
      );

    await act(async () => {
      await fireEvent.press(view.getByText('run change pin'));
    });

    // The press does not await changePin, and its PIN check hashes with PBKDF2
    // slices that yield to the event loop, so one act flush can end first.
    await waitFor(() =>
      expect(view.getByTestId('error')).toHaveTextContent(
        'The device key was not unlocked, so the PIN was not changed. Try again.',
      ),
    );
  });

  it('keeps the standard setup copy when the vault listing fails at launch', async () => {
    await vault.createVault();
    jest.spyOn(vault, 'getAllKeys').mockRejectedValue(new Error('listing failed'));

    const view = await renderProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));

    expect(view.getByTestId('vault-empty')).toHaveTextContent('false');
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
