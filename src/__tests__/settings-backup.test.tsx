import { useEffect } from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import { AppState, type AppStateStatus, Text } from 'react-native';

import SettingsScreen from '../../app/(tabs)/settings';
import vault from '../../modules/expo-vault';
import { ToastProvider } from '../components/ui';
import { SessionProvider, useSession } from '../features/session/SessionProvider';
import type { SecuritySettings } from '../features/session/settings';
import { type BackupResult, backupService } from '../services/BackupService';

type AutoLockSeconds = SecuritySettings['autoLockSeconds'];
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

const share = Sharing.shareAsync as jest.Mock;
const pick = DocumentPicker.getDocumentAsync as jest.Mock;
const secureStoreMock = SecureStore as unknown as { __reset(): void };
const vaultMock = vault as unknown as { reset(): void };

const appState = AppState as unknown as {
  currentState: AppStateStatus;
  addEventListener: jest.Mock;
};
const listeners = new Set<(state: AppStateStatus) => void>();
// Called from inside mocked work, which already runs in the press's act scope.
const moveTo = (state: AppStateStatus) => {
  appState.currentState = state;
  for (const listener of [...listeners]) listener(state);
};

const STOPPED = 'The backup was cancelled before it could be shared. Nothing left the vault.';
const PICKED = 'file:///mock/cache/DocumentPicker/839E8D63.svbackup';

let session: ReturnType<typeof useSession>;

// The lock gate as the root layout applies it: no settings screen while locked.
function Gate() {
  const value = useSession();
  useEffect(() => {
    session = value;
  });
  return value.status === 'unlocked' ? <SettingsScreen /> : <Text>{value.status}</Text>;
}

async function renderUnlocked(autoLockSeconds: AutoLockSeconds = 0) {
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
    await session.updateSettings({ autoLockSeconds });
  });
  return view;
}

const backup: BackupResult = {
  uri: 'file:///mock/cache/backup/SecureVault backup 2026-10-16.svbackup',
  name: 'SecureVault backup 2026-10-16.svbackup',
  entries: 19,
  bytes: 471948836,
};

// Presses inside one act that also covers the work the press starts: the
// pause before the share sheet and any trip away.
const pressAndSettle = (element: Parameters<typeof fireEvent.press>[0], ms: number) =>
  act(async () => {
    void fireEvent.press(element);
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

async function runExport(view: Awaited<ReturnType<typeof renderUnlocked>>) {
  await fireEvent.press(view.getByText('Export vault'));
  await fireEvent.changeText(view.getByLabelText('Backup passphrase'), 'correct horse battery');
  await fireEvent.changeText(
    view.getByLabelText('Repeat the backup passphrase'),
    'correct horse battery',
  );
  await pressAndSettle(view.getByText('Create backup'), 1200);
}

async function openRestore(view: Awaited<ReturnType<typeof renderUnlocked>>) {
  pick.mockResolvedValue({ canceled: false, assets: [{ uri: PICKED, name: 'backup.svbackup' }] });
  jest
    .spyOn(backupService, 'inspectBackup')
    .mockResolvedValue({ version: 1, app: 'SecureVault', created: '2026-10-16', entries: 19 });
  await fireEvent.press(view.getByText('Restore from backup'));
  await waitFor(() => expect(view.getByText(/19 entries/)).toBeOnTheScreen());
}

describe('Settings backup and the lock gate', () => {
  let discard: jest.SpyInstance;
  let discardPicked: jest.SpyInstance;

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
    share.mockClear();
    pick.mockReset();
    discard = jest.spyOn(backupService, 'discardBackup');
    discardPicked = jest.spyOn(backupService, 'discardPickedFile');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shares a finished backup while the vault stays unlocked, then removes it', async () => {
    jest.spyOn(backupService, 'createBackup').mockResolvedValue(backup);
    const view = await renderUnlocked();

    await runExport(view);

    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith(backup.uri, expect.anything());
    expect(discard).toHaveBeenCalledWith(backup.uri);
    expect(session.notice).toBeNull();
  });

  it('deletes a backup that finished after the vault locked and never opens the share sheet', async () => {
    jest.spyOn(backupService, 'createBackup').mockImplementation(async () => {
      session.lock();
      return backup;
    });
    const view = await renderUnlocked();

    await runExport(view);

    expect(view.getByText('locked')).toBeOnTheScreen();
    expect(share).not.toHaveBeenCalled();
    expect(discard).toHaveBeenCalledWith(backup.uri);
    // The outcome waits for the next unlock and names nothing about the vault.
    expect(session.notice).toEqual({ message: STOPPED });
  });

  it('does not share when auto-lock locks on the return from a trip away before the sheet', async () => {
    jest.spyOn(backupService, 'createBackup').mockImplementation(async () => {
      moveTo('background');
      // Back in the foreground after the pause before the share sheet.
      setTimeout(() => moveTo('active'), 700);
      return backup;
    });
    const view = await renderUnlocked(0);

    await runExport(view);

    expect(view.getByText('locked')).toBeOnTheScreen();
    expect(share).not.toHaveBeenCalled();
    expect(discard).toHaveBeenCalledWith(backup.uri);
    expect(session.notice).toEqual({ message: STOPPED });
  });

  it('still shares after a trip away that auto-lock allows', async () => {
    let sharedWhileAway = false;
    share.mockImplementationOnce(async () => {
      sharedWhileAway = appState.currentState !== 'active';
    });
    jest.spyOn(backupService, 'createBackup').mockImplementation(async () => {
      moveTo('background');
      setTimeout(() => moveTo('active'), 700);
      return backup;
    });
    const view = await renderUnlocked(300);

    await runExport(view);

    expect(share).toHaveBeenCalledTimes(1);
    expect(sharedWhileAway).toBe(false);
    expect(session.status).toBe('unlocked');
    expect(session.notice).toBeNull();
  });

  it('reports an export the lock stopped after the next unlock, without its error text', async () => {
    jest.spyOn(backupService, 'createBackup').mockImplementation(async () => {
      session.lock();
      throw new Error('/var/mobile/Caches/backup-staging/plain-1: No such file');
    });
    const view = await renderUnlocked();

    await runExport(view);

    expect(share).not.toHaveBeenCalled();
    expect(session.notice).toEqual({ message: STOPPED });
    expect(view.queryByText(/No such file/)).toBeNull();
  });

  it("removes the picker's copy when the restore sheet is closed", async () => {
    const view = await renderUnlocked();

    await openRestore(view);
    expect(discardPicked).not.toHaveBeenCalled();
    await fireEvent.press(view.getByLabelText('Close'));

    expect(discardPicked).toHaveBeenCalledWith(PICKED);
  });

  it("removes the picker's copy after a restore", async () => {
    jest.spyOn(backupService, 'restoreBackup').mockResolvedValue(19);
    const view = await renderUnlocked();

    await openRestore(view);
    await fireEvent.changeText(view.getByLabelText('Backup passphrase'), 'correct horse battery');
    await pressAndSettle(view.getByText('Restore'), 50);

    expect(discardPicked).toHaveBeenCalledWith(PICKED);
    expect(view.getByText('Vault restored: 19 entries')).toBeOnTheScreen();
  });

  it('lets a restore the lock interrupted finish and reports it after the next unlock', async () => {
    jest.spyOn(backupService, 'restoreBackup').mockImplementation(async () => {
      session.lock();
      return 19;
    });
    const view = await renderUnlocked();

    await openRestore(view);
    await fireEvent.changeText(view.getByLabelText('Backup passphrase'), 'correct horse battery');
    await pressAndSettle(view.getByText('Restore'), 50);

    expect(view.getByText('locked')).toBeOnTheScreen();
    expect(view.queryByText('Vault restored: 19 entries')).toBeNull();
    expect(session.notice).toEqual({ message: 'Vault restored: 19 entries', tone: 'success' });
    expect(discardPicked).toHaveBeenCalledWith(PICKED);
  });
});
