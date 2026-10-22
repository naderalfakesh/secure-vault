import { useEffect } from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Directory } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import { AppState, type AppStateStatus, Platform, Text } from 'react-native';

import BackupScreen from '../../app/settings/backup';
import vault from '../../modules/expo-vault';
import { ToastProvider } from '../components/ui';
import * as saveModule from '../features/backup/saveToDevice';
import { SessionProvider, useSession } from '../features/session/SessionProvider';
import { backupService } from '../services/BackupService';

jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), navigate: jest.fn() },
  Stack: { Screen: () => null },
}));

const share = Sharing.shareAsync as jest.Mock;
const secureStoreMock = SecureStore as unknown as { __reset(): void };
const vaultMock = vault as unknown as { reset(): void };

const CONTAINER = expect.stringMatching(
  /\/backup\/SecureVault%20backup%20\d{4}-\d{2}-\d{2}\.svbackup$/,
);
const SAVED = 'Backup of 19 entries (450.1 MB) saved';
const CANCELLED = 'The backup wasn’t saved. Nothing left the vault.';
const FAILED =
  'The backup couldn’t be saved there. Nothing was left behind. Try again, or choose another folder.';
const INTERRUPTED =
  'SecureVault locked before the backup was saved. The temporary copy was removed.';

let session: ReturnType<typeof useSession>;

// In the foreground, so the sheet may present system UI.
function foreground() {
  const appState = AppState as unknown as {
    currentState: AppStateStatus;
    addEventListener: jest.Mock;
  };
  appState.currentState = 'active';
  appState.addEventListener.mockImplementation(() => ({ remove: () => {} }));
}

function Gate() {
  const value = useSession();
  useEffect(() => {
    session = value;
  });
  if (value.status !== 'unlocked') return <Text>{value.status}</Text>;
  return <BackupScreen />;
}

async function renderUnlocked() {
  const view = await render(
    <SessionProvider>
      <ToastProvider>
        <Gate />
      </ToastProvider>
    </SessionProvider>,
  );
  await waitFor(() => expect(view.getByText('setup')).toBeOnTheScreen());
  await act(async () => {
    await session.setUp('123456');
  });
  await act(async () => {
    await session.updateSettings({ autoLockSeconds: 0 });
  });
  return view;
}

const pressAndSettle = (element: Parameters<typeof fireEvent.press>[0], ms: number) =>
  act(async () => {
    void fireEvent.press(element);
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

async function fillForm(view: Awaited<ReturnType<typeof renderUnlocked>>) {
  await fireEvent.press(view.getByText('Create a backup'));
  await fireEvent.changeText(view.getByLabelText('Passphrase'), 'correct horse battery');
  await fireEvent.changeText(view.getByLabelText('Repeat passphrase'), 'correct horse battery');
}

describe('Backup Save to device on Android', () => {
  const os = Platform.OS;
  let discard: jest.SpyInstance;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    foreground();
    vaultMock.reset();
    secureStoreMock.__reset();
    share.mockClear();
    jest.spyOn(vault, 'exportBackup').mockResolvedValue({ entries: 19, bytes: 471948836 });
    discard = jest.spyOn(backupService, 'discardBackup');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  });

  it('offers Save to device first and Share second, both waiting for a valid passphrase', async () => {
    const view = await renderUnlocked();
    await fireEvent.press(view.getByText('Create a backup'));

    const buttons = view.getAllByRole('button').map((button) => button.props.accessibilityLabel);
    const save = buttons.indexOf('Save to device');
    expect(save).toBeGreaterThanOrEqual(0);
    expect(buttons.indexOf('Share')).toBe(save + 1);
    expect(view.queryByRole('button', { name: 'Create backup' })).toBeNull();
    expect(view.getByRole('button', { name: 'Save to device' })).toBeDisabled();
    expect(view.getByRole('button', { name: 'Share' })).toBeDisabled();
  });

  it('saves the encrypted container, removes the staged copy and records the date', async () => {
    const save = jest.spyOn(saveModule, 'saveBackupToDevice').mockResolvedValue('saved');
    const view = await renderUnlocked();
    await fillForm(view);

    await pressAndSettle(view.getByRole('button', { name: 'Save to device' }), 1200);

    expect(save).toHaveBeenCalledWith(
      CONTAINER,
      expect.stringMatching(/^SecureVault backup \d{4}-\d{2}-\d{2}\.svbackup$/),
      expect.objectContaining({ stillCurrent: expect.any(Function) }),
    );
    expect(share).not.toHaveBeenCalled();
    expect(discard).toHaveBeenCalledWith(CONTAINER);
    expect(backupService.activity()).toBeNull();
    expect(view.getByText(SAVED)).toBeOnTheScreen();
    expect(view.getByText(/^Last created on this phone: \w+/)).toBeOnTheScreen();
    expect(await SecureStore.getItemAsync('securevault.lastBackup')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('leaves the last created date alone when the save screen is cancelled', async () => {
    // The real helper, with the system picker answering "cancelled".
    const picker = jest.spyOn(Directory, 'pickDirectoryAsync').mockRejectedValue(
      Object.assign(new Error('The file picker was cancelled by the user'), {
        code: 'ERR_PICKER_CANCELLED',
      }),
    );
    const view = await renderUnlocked();
    await fillForm(view);

    await pressAndSettle(view.getByRole('button', { name: 'Save to device' }), 1200);

    expect(picker).toHaveBeenCalledTimes(1);
    expect(view.getByText(CANCELLED)).toBeOnTheScreen();
    expect(view.queryByText(/Last created on this phone/)).toBeNull();
    expect(await SecureStore.getItemAsync('securevault.lastBackup')).toBeNull();
    expect(discard).toHaveBeenCalledWith(CONTAINER);
    expect(backupService.activity()).toBeNull();
  });

  it('shows one plain sentence, never the provider’s text, when saving fails', async () => {
    jest
      .spyOn(saveModule, 'saveBackupToDevice')
      .mockRejectedValue(new Error('content://com.android.externalstorage/tree/primary: EACCES'));
    const view = await renderUnlocked();
    await fillForm(view);

    await pressAndSettle(view.getByRole('button', { name: 'Save to device' }), 1200);

    expect(view.getByText(FAILED)).toBeOnTheScreen();
    expect(view.queryByText(/EACCES|content:\/\//)).toBeNull();
    expect(view.queryByText(/Last created on this phone/)).toBeNull();
    expect(discard).toHaveBeenCalledWith(CONTAINER);
    expect(backupService.activity()).toBeNull();
  });

  it('says so after the unlock when the vault locked while the save screen was up', async () => {
    jest.spyOn(saveModule, 'saveBackupToDevice').mockImplementation(async () => {
      session.lock();
      return 'interrupted';
    });
    const view = await renderUnlocked();
    await fillForm(view);

    await pressAndSettle(view.getByRole('button', { name: 'Save to device' }), 1200);

    expect(session.notice).toEqual({ message: INTERRUPTED });
    expect(await SecureStore.getItemAsync('securevault.lastBackup')).toBeNull();
    expect(discard).toHaveBeenCalledWith(CONTAINER);
  });

  it('still shares the same container through the share sheet', async () => {
    const save = jest.spyOn(saveModule, 'saveBackupToDevice');
    const view = await renderUnlocked();
    await fillForm(view);

    await pressAndSettle(view.getByRole('button', { name: 'Share' }), 1200);

    expect(save).not.toHaveBeenCalled();
    expect(share).toHaveBeenCalledWith(CONTAINER, expect.anything());
    expect(discard).toHaveBeenCalledWith(CONTAINER);
    expect(view.getByText(/^Last created on this phone: \w+/)).toBeOnTheScreen();
  });
});

describe('Backup create on iOS', () => {
  beforeEach(() => {
    foreground();
    vaultMock.reset();
    secureStoreMock.__reset();
  });

  it('keeps the single Create backup action, whose share sheet has Save to Files', async () => {
    expect(Platform.OS).toBe('ios');
    const view = await renderUnlocked();
    await fireEvent.press(view.getByText('Create a backup'));

    expect(view.getByRole('button', { name: 'Create backup' })).toBeOnTheScreen();
    expect(view.queryByRole('button', { name: 'Save to device' })).toBeNull();
  });
});
