import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

import { LOCKOUT_BASE_MS } from '@/features/auth/lockout';
import { secureStoreMock } from '@/testing/secureStore';
import {
  failPinReads,
  PIN_ENTRY,
  renderUnavailableProbe,
  seedLockedVault,
} from '@/testing/sessionUnavailable';
import { vaultMock } from '@/testing/vault';
import vault from '@modules/expo-vault';

import { SESSION_MARKER_DIRECTORY, sessionStorage } from '../settings';

describe('SessionProvider PIN and lockout markers (M1)', () => {
  const LOCKOUT_ENTRY = 'securevault.lockout';
  const marker = (name: string) => new File(Paths.document, SESSION_MARKER_DIRECTORY, name);

  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Sets up a vault through the session, so the PIN and lockout markers are written as in the app. */
  async function setUpVault() {
    const view = await renderUnavailableProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
    await fireEvent.press(view.getByText('run setup'));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unlocked'));
    await view.unmount();
  }

  /** What expo-secure-store does on Android with an entry it cannot decrypt: deletes it, returns null. */
  const corrupt = (entry: string) => SecureStore.deleteItemAsync(entry);

  it('writes the markers when setup stores the PIN and the lockout', async () => {
    await setUpVault();

    expect(marker('pin').exists).toBe(true);
    expect(marker('lockout').exists).toBe(true);
  });

  it('keeps the marker folder out of device backups (iOS), so a restored phone has none', async () => {
    await setUpVault();

    const markers = decodeURIComponent(
      new Directory(Paths.document, SESSION_MARKER_DIRECTORY).uri.replace(/^file:\/\//, ''),
    ).replace(/\/$/, '');
    expect(vaultMock.excludedFromBackup()).toContain(markers);
  });

  it('falls back to the PIN record alone after a device restore brought no markers', async () => {
    await setUpVault();
    // A restore of the same phone: Keychain items and documents back, excluded markers not.
    new Directory(Paths.document, SESSION_MARKER_DIRECTORY).delete();

    const view = await renderUnavailableProbe();

    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('locked'));
    expect(marker('pin').exists).toBe(true);
  });

  it('is unavailable, not setup, when a PIN record that was written reads as absent', async () => {
    await setUpVault();
    await corrupt(PIN_ENTRY);
    const createVault = jest.spyOn(vault, 'createVault');

    const view = await renderUnavailableProbe();

    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unavailable'));
    expect(view.getByTestId('pin-lost')).toHaveTextContent('true');
    expect(createVault).not.toHaveBeenCalled();
    expect(await SecureStore.getItemAsync(PIN_ENTRY)).toBeNull();
  });

  it('stops setup when the PIN record vanishes after launch', async () => {
    await vault.createVault();
    await vault.put('_key_probe', 'ok');
    const view = await renderUnavailableProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
    // Written and lost between launch and the setup press.
    await sessionStorage.savePinRecord('record');
    await corrupt(PIN_ENTRY);

    await fireEvent.press(view.getByText('run setup'));

    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unavailable'));
    expect(await SecureStore.getItemAsync(PIN_ENTRY)).toBeNull();
  });

  it('sends a first run with no marker to setup', async () => {
    const view = await renderUnavailableProbe();

    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
    expect(view.getByTestId('pin-lost')).toHaveTextContent('false');
    expect(new Directory(Paths.document, SESSION_MARKER_DIRECTORY).exists).toBe(false);
  });

  it('sends a marker without a device key to setup: there is no vault for it to guard', async () => {
    await setUpVault();
    await corrupt(PIN_ENTRY);
    // A device backup restored the documents folder, not the Keychain or Keystore.
    vaultMock.reset();

    const view = await renderUnavailableProbe();

    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
  });

  describe('entries whose device key is gone', () => {
    it('offers only Delete everything when the PIN is lost and the key was deleted with entries left', async () => {
      await setUpVault();
      await vault.put('file_kept', 'ciphertext');
      await corrupt(PIN_ENTRY);
      // Removing the Android screen lock deletes the Keystore key rather than invalidating it.
      await vault.deleteDeviceKey();
      const createVault = jest.spyOn(vault, 'createVault');

      const view = await renderUnavailableProbe();

      await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unavailable'));
      expect(view.getByTestId('key-invalidated')).toHaveTextContent('true');
      expect(view.getByTestId('pin-lost')).toHaveTextContent('false');
      expect(createVault).not.toHaveBeenCalled();
      expect(await vault.getAllKeys()).toContain('file_kept');
    });

    it('treats entries without a key and without a PIN marker the same way', async () => {
      // An earlier install that lost its key: entries, no key, no PIN, no marker.
      await vault.put('_database_key', 'ciphertext');
      await vault.put('file_kept', 'ciphertext');

      const view = await renderUnavailableProbe();

      await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unavailable'));
      expect(view.getByTestId('key-invalidated')).toHaveTextContent('true');
      expect(new Directory(Paths.document, SESSION_MARKER_DIRECTORY).exists).toBe(false);
    });

    it('never runs setup over the entries when the key goes after launch', async () => {
      await vault.createVault();
      await vault.put('_key_probe', 'ok');
      await vault.put('file_kept', 'ciphertext');
      const view = await renderUnavailableProbe();
      await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
      await vault.deleteDeviceKey();
      const createVault = jest.spyOn(vault, 'createVault');

      await fireEvent.press(view.getByText('run setup'));

      await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unavailable'));
      expect(view.getByTestId('key-invalidated')).toHaveTextContent('true');
      expect(createVault).not.toHaveBeenCalled();
      expect(await SecureStore.getItemAsync(PIN_ENTRY)).toBeNull();
    });

    it('still sends a lone key probe without a key to setup', async () => {
      await vault.put('_key_probe', 'ok');

      const view = await renderUnavailableProbe();

      await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
      expect(view.getByTestId('key-invalidated')).toHaveTextContent('false');
    });

    it('goes to setup once Delete everything emptied the vault', async () => {
      await vault.put('file_kept', 'ciphertext');
      const view = await renderUnavailableProbe();
      await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unavailable'));
      // The screen's erase removes the entries first, then forgets the session.
      for (const key of await vault.getAllKeys()) await vault.delete(key);

      await fireEvent.press(view.getByText('run erase'));

      await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
      expect(view.getByTestId('key-invalidated')).toHaveTextContent('false');
    });
  });

  it('marks a PIN record written before markers existed when it is read', async () => {
    await seedLockedVault();
    expect(marker('pin').exists).toBe(false);

    const view = await renderUnavailableProbe();

    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('locked'));
    expect(marker('pin').exists).toBe(true);
  });

  it('clears the markers on "Delete everything", so the next launch is a first run', async () => {
    await setUpVault();
    const view = await renderUnavailableProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('locked'));
    await act(async () => {
      await fireEvent.press(view.getByText('run erase'));
    });
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
    expect(marker('pin').exists).toBe(false);
    expect(marker('lockout').exists).toBe(false);
    await view.unmount();

    const relaunch = await renderUnavailableProbe();
    await waitFor(() => expect(relaunch.getByTestId('status')).toHaveTextContent('setup'));
    expect(relaunch.getByTestId('pin-lost')).toHaveTextContent('false');
  });

  it('keeps the PIN marker when the erase cannot remove it, and deletes no record then', async () => {
    await setUpVault();
    const remove = SecureStore.deleteItemAsync;
    const deleteItem = jest.spyOn(SecureStore, 'deleteItemAsync').mockImplementation(remove);
    jest.spyOn(File.prototype, 'delete').mockImplementation(() => {
      throw new Error('EACCES');
    });
    const view = await renderUnavailableProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('locked'));

    await act(async () => {
      await fireEvent.press(view.getByText('run erase'));
    });

    expect(deleteItem).not.toHaveBeenCalled();
    expect(marker('pin').exists).toBe(true);
    expect(await SecureStore.getItemAsync(PIN_ENTRY)).not.toBeNull();
  });

  it('pauses instead of resetting when a lockout record that was written reads as absent', async () => {
    await setUpVault();
    await SecureStore.setItemAsync(LOCKOUT_ENTRY, JSON.stringify({ failures: 4, lockedUntil: 0 }));
    await corrupt(LOCKOUT_ENTRY);
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);

    const view = await renderUnavailableProbe();

    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('locked'));
    expect(view.getByTestId('locked-until')).toHaveTextContent(String(now + LOCKOUT_BASE_MS));
    // Written back, so the pause is judged once and ends on time.
    expect(JSON.parse((await SecureStore.getItemAsync(LOCKOUT_ENTRY))!)).toEqual({
      failures: 0,
      lockedUntil: now + LOCKOUT_BASE_MS,
    });
  });

  it('reads no pause when no lockout was ever written', async () => {
    await seedLockedVault();

    expect(await sessionStorage.loadLockout()).toEqual({ failures: 0, lockedUntil: 0 });
  });

  it('opens setup for a new PIN once the device key gate opens after a lost PIN record', async () => {
    await setUpVault();
    await vault.put('file_kept', 'ciphertext');
    await corrupt(PIN_ENTRY);
    const createVault = jest.spyOn(vault, 'createVault');
    const view = await renderUnavailableProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unavailable'));

    await fireEvent.press(view.getByText('run reset pin'));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
    await fireEvent.press(view.getByText('run setup'));

    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unlocked'));
    expect(createVault).not.toHaveBeenCalled();
    expect(await vault.get('file_kept')).toBe('ciphertext');
    expect(await SecureStore.getItemAsync(PIN_ENTRY)).not.toBeNull();
  });

  it('keeps a declined Face ID declined when a new PIN replaces a lost one', async () => {
    await setUpVault();
    const declined = { ...(await sessionStorage.loadSettings()), biometricUnlock: false };
    await sessionStorage.saveSettings(declined);
    await corrupt(PIN_ENTRY);
    const view = await renderUnavailableProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unavailable'));

    await fireEvent.press(view.getByText('run reset pin'));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
    await fireEvent.press(view.getByText('run setup'));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unlocked'));

    expect(await sessionStorage.loadSettings()).toEqual(declined);
  });

  it('starts a vault set up after Delete everything from the default settings', async () => {
    await setUpVault();
    await sessionStorage.saveSettings({
      ...(await sessionStorage.loadSettings()),
      biometricUnlock: false,
      autoLockSeconds: 0,
    });
    const view = await renderUnavailableProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('locked'));
    for (const key of await vault.getAllKeys()) await vault.delete(key);
    await fireEvent.press(view.getByText('run erase'));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));

    await fireEvent.press(view.getByText('run setup'));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unlocked'));

    const settings = await sessionStorage.loadSettings();
    expect(settings.biometricUnlock).toBe(true);
    expect(settings.autoLockSeconds).toBe(60);
  });

  const keyInvalidated = () =>
    Object.assign(new Error('Key permanently invalidated'), { code: 'KEY_INVALIDATED' });

  it('offers only Delete everything when the PIN is lost and the device key was invalidated', async () => {
    await setUpVault();
    await vault.put('file_kept', 'ciphertext');
    await corrupt(PIN_ENTRY);
    // The screen lock was removed and set again: the key exists but can never decrypt.
    jest.spyOn(vault, 'get').mockRejectedValue(keyInvalidated());
    const view = await renderUnavailableProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unavailable'));

    await act(async () => {
      await fireEvent.press(view.getByText('run reset pin'));
    });

    expect(view.getByTestId('status')).toHaveTextContent('unavailable');
    expect(view.getByTestId('key-invalidated')).toHaveTextContent('true');
    expect(view.getByTestId('error')).toHaveTextContent(/screen lock or biometrics changed/i);
    expect(await vault.getAllKeys()).toContain('file_kept');
  });

  it('lets setup replace an invalidated key when the vault behind a lost PIN is empty', async () => {
    await setUpVault();
    for (const key of await vault.getAllKeys()) await vault.delete(key);
    await corrupt(PIN_ENTRY);
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
    const view = await renderUnavailableProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unavailable'));

    await fireEvent.press(view.getByText('run reset pin'));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
    await fireEvent.press(view.getByText('run setup'));

    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unlocked'));
    expect(createVault).toHaveBeenCalledTimes(1);
  });

  it('stays unavailable when the device key prompt for a new PIN is cancelled', async () => {
    await setUpVault();
    await corrupt(PIN_ENTRY);
    const view = await renderUnavailableProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unavailable'));
    jest.spyOn(vault, 'unlockWithBiometrics').mockResolvedValue(false);

    await act(async () => {
      await fireEvent.press(view.getByText('run reset pin'));
    });

    expect(view.getByTestId('status')).toHaveTextContent('unavailable');
    // The PIN is the thing that was lost: nothing asks for it.
    expect(view.getByTestId('error')).toHaveTextContent(
      'The device key was not unlocked, so no new PIN was set. Try again.',
    );
  });

  it('offers no new PIN for an unreadable store that lost nothing', async () => {
    await seedLockedVault();
    failPinReads();
    const view = await renderUnavailableProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unavailable'));
    expect(view.getByTestId('pin-lost')).toHaveTextContent('false');

    await act(async () => {
      await fireEvent.press(view.getByText('run reset pin'));
    });

    expect(view.getByTestId('status')).toHaveTextContent('unavailable');
  });
});
