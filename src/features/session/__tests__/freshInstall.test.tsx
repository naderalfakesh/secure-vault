import { render, waitFor } from '@testing-library/react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { Platform, Text } from 'react-native';

import vault from '../../../../modules/expo-vault';
import { reconcileInstall } from '@/features/session/freshInstall';
import { SessionProvider, useSession } from '@/features/session/SessionProvider';
import { sessionStorage } from '@/features/session/settings';
import { hashPasscode } from '@/testing/passcode';

const secureStoreMock = SecureStore as unknown as { __reset(): void };
const vaultMock = vault as unknown as {
  reset(): void;
  clearInstallMarker(): void;
  hasInstallMarker(): boolean;
};

const OUR_ENTRIES = [
  'securevault.pin',
  'securevault.settings',
  'securevault.lockout',
  'securevault.lastBackup',
  'securevault.appearance',
];

/** What the Keychain keeps after the app was deleted: the device key and our secure-store entries. */
async function keychainLeftovers() {
  await vault.createVault();
  await SecureStore.setItemAsync('securevault.pin', hashPasscode('123456', { iterations: 64 }));
  for (const entry of OUR_ENTRIES.slice(1)) await SecureStore.setItemAsync(entry, 'x');
}

async function storedEntries() {
  const kept: string[] = [];
  for (const entry of OUR_ENTRIES) {
    if ((await SecureStore.getItemAsync(entry)) !== null) kept.push(entry);
  }
  return kept;
}

const indexFolder = () => new Directory(Paths.document, 'SQLite');

describe('reconcileInstall (iOS: Keychain items outlive the app)', () => {
  const os = Platform.OS;

  beforeEach(() => {
    Platform.OS = 'ios';
    vaultMock.reset();
    secureStoreMock.__reset();
    vaultMock.clearInstallMarker();
    if (indexFolder().exists) indexFolder().delete();
  });

  afterEach(() => {
    Platform.OS = os;
    jest.restoreAllMocks();
  });

  it('treats Keychain items without any files as a reinstall and clears them', async () => {
    await keychainLeftovers();

    await expect(reconcileInstall()).resolves.toBe('cleared');

    expect(await vault.hasVault()).toBe(false);
    expect(await storedEntries()).toEqual([]);
    expect(vaultMock.hasInstallMarker()).toBe(true);
  });

  it('keeps everything on an update: the vault has entries on disk', async () => {
    await keychainLeftovers();
    await vault.put('_key_probe', 'ok');

    await expect(reconcileInstall()).resolves.toBe('kept');

    expect(await vault.hasVault()).toBe(true);
    expect(await storedEntries()).toEqual(OUR_ENTRIES);
    expect(vaultMock.hasInstallMarker()).toBe(true);
  });

  it('keeps everything on an update when only the index file is on disk', async () => {
    await keychainLeftovers();
    const folder = indexFolder();
    folder.create({ intermediates: true });
    new File(folder, 'securevault.db').create();

    await expect(reconcileInstall()).resolves.toBe('kept');
    expect(await vault.hasVault()).toBe(true);
    expect(await storedEntries()).toEqual(OUR_ENTRIES);
  });

  it('keeps everything on an update when only the PIN markers are on disk', async () => {
    await keychainLeftovers();
    await sessionStorage.readPinRecord(); // writes the marker, as every earlier build did

    // The marker read above happens before the check, like a launch of the old build.
    await expect(reconcileInstall()).resolves.toBe('kept');
    expect(await vault.hasVault()).toBe(true);
  });

  it('only sets the flag on a first install with nothing to clear', async () => {
    const remove = jest.spyOn(SecureStore, 'deleteItemAsync');

    await expect(reconcileInstall()).resolves.toBe('kept');

    expect(remove).not.toHaveBeenCalled();
    expect(vaultMock.hasInstallMarker()).toBe(true);
  });

  it('does nothing once the flag is set', async () => {
    await keychainLeftovers();
    await reconcileInstall();
    await keychainLeftovers();
    const has = jest.spyOn(vault, 'hasVault');

    await expect(reconcileInstall()).resolves.toBe('kept');
    expect(has).not.toHaveBeenCalled();
    expect(await vault.hasVault()).toBe(true);
  });

  it('decides nothing while the Keychain or the files cannot be read', async () => {
    await keychainLeftovers();
    const has = jest.spyOn(vault, 'hasVault').mockRejectedValueOnce(new Error('locked'));
    await expect(reconcileInstall()).resolves.toBe('undecided');
    has.mockRestore();

    jest.spyOn(vault, 'getAllKeys').mockRejectedValueOnce(new Error('EPERM'));
    await expect(reconcileInstall()).resolves.toBe('undecided');

    jest.spyOn(SecureStore, 'getItemAsync').mockRejectedValueOnce(new Error('not allowed'));
    await expect(reconcileInstall()).resolves.toBe('undecided');

    expect(await vault.hasVault()).toBe(true);
    expect(await storedEntries()).toEqual(OUR_ENTRIES);
    expect(vaultMock.hasInstallMarker()).toBe(false);
  });

  it('leaves the flag unset when clearing fails, so the next launch tries again', async () => {
    await keychainLeftovers();
    jest.spyOn(vault, 'deleteDeviceKey').mockRejectedValueOnce(new Error('-25300'));

    await expect(reconcileInstall()).resolves.toBe('undecided');
    expect(vaultMock.hasInstallMarker()).toBe(false);
  });

  it('does nothing on Android, where uninstalling removes the key and the store', async () => {
    Platform.OS = 'android';
    await keychainLeftovers();
    const has = jest.spyOn(vault, 'hasVault');

    await expect(reconcileInstall()).resolves.toBe('kept');
    expect(has).not.toHaveBeenCalled();
    expect(await storedEntries()).toEqual(OUR_ENTRIES);
  });

  it('sends a reinstall to setup instead of the old lock screen', async () => {
    await keychainLeftovers();
    function Status() {
      return <Text testID="status">{useSession().status}</Text>;
    }

    const view = await render(
      <SessionProvider>
        <Status />
      </SessionProvider>,
    );

    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
    expect(await vault.hasVault()).toBe(false);
  });

  it('opens the lock screen after an update', async () => {
    await keychainLeftovers();
    await vault.put('_key_probe', 'ok');
    function Status() {
      return <Text testID="status">{useSession().status}</Text>;
    }

    const view = await render(
      <SessionProvider>
        <Status />
      </SessionProvider>,
    );

    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('locked'));
  });
});
