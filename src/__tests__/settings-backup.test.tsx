import { useEffect } from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import { Alert, AppState, type AppStateStatus, Text } from 'react-native';

import SettingsScreen from '../../app/(tabs)/settings';
import vault from '../../modules/expo-vault';
import { ToastProvider } from '../components/ui';
import { SessionProvider, useSession } from '../features/session/SessionProvider';
import type { SecuritySettings } from '../features/session/settings';
import { backupService } from '../services/BackupService';

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

// The real service writes and removes the container; only the native export is stubbed.
const CONTAINER = expect.stringMatching(
  /\/backup\/SecureVault%20backup%20\d{4}-\d{2}-\d{2}\.svbackup$/,
);
const nativeExport = (during: () => void = () => {}) =>
  jest.spyOn(vault, 'exportBackup').mockImplementation(async () => {
    during();
    return { entries: 19, bytes: 471948836 };
  });

// A native call that stays open until the test settles it, as a large backup does.
function pending<T>() {
  let settle!: (value: T) => void;
  let fail!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  return { promise, settle, fail };
}

const rowLabelled = (view: Awaited<ReturnType<typeof renderUnlocked>>, title: string) =>
  view.getByLabelText(new RegExp(`^${title}`));

const settleFor = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

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

async function startRestore(view: Awaited<ReturnType<typeof renderUnlocked>>) {
  await openRestore(view);
  await fireEvent.changeText(view.getByLabelText('Backup passphrase'), 'correct horse battery');
  await pressAndSettle(view.getByText('Restore'), 50);
}

async function lockAndUnlock() {
  await act(async () => {
    session.lock();
  });
  await act(async () => {
    await session.unlockWithPin('123456');
  });
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
    nativeExport();
    const view = await renderUnlocked();

    await runExport(view);

    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith(CONTAINER, expect.anything());
    expect(discard).toHaveBeenCalledWith(CONTAINER);
    expect(backupService.activity()).toBeNull();
    expect(session.notice).toBeNull();
  });

  it('deletes a backup that finished after the vault locked and never opens the share sheet', async () => {
    nativeExport(() => session.lock());
    const view = await renderUnlocked();

    await runExport(view);

    expect(view.getByText('locked')).toBeOnTheScreen();
    expect(share).not.toHaveBeenCalled();
    expect(discard).toHaveBeenCalledWith(CONTAINER);
    // The outcome waits for the next unlock and names nothing about the vault.
    expect(session.notice).toEqual({ message: STOPPED });
  });

  it('does not share when auto-lock locks on the return from a trip away before the sheet', async () => {
    nativeExport(() => {
      moveTo('background');
      // Back in the foreground after the pause before the share sheet.
      setTimeout(() => moveTo('active'), 700);
    });
    const view = await renderUnlocked(0);

    await runExport(view);

    expect(view.getByText('locked')).toBeOnTheScreen();
    expect(share).not.toHaveBeenCalled();
    expect(discard).toHaveBeenCalledWith(CONTAINER);
    expect(session.notice).toEqual({ message: STOPPED });
  });

  it('still shares after a trip away that auto-lock allows', async () => {
    let sharedWhileAway = false;
    share.mockImplementationOnce(async () => {
      sharedWhileAway = appState.currentState !== 'active';
    });
    nativeExport(() => {
      moveTo('background');
      setTimeout(() => moveTo('active'), 700);
    });
    const view = await renderUnlocked(300);

    await runExport(view);

    expect(share).toHaveBeenCalledTimes(1);
    expect(sharedWhileAway).toBe(false);
    expect(session.status).toBe('unlocked');
    expect(session.notice).toBeNull();
  });

  it('reports an export the lock stopped after the next unlock, without its error text', async () => {
    jest.spyOn(vault, 'exportBackup').mockImplementation(async () => {
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
  it('reports a restore that failed behind the lock as a plain sentence after the next unlock', async () => {
    jest.spyOn(backupService, 'restoreBackup').mockImplementation(async () => {
      session.lock();
      throw new Error('/var/mobile/Caches/backup/restore/database: EIO');
    });
    const view = await renderUnlocked();

    await startRestore(view);

    expect(session.notice).toEqual({
      message: 'The restore did not finish. Try it again.',
      tone: 'danger',
    });
    expect(discardPicked).toHaveBeenCalledWith(PICKED);
  });

  describe('work that outlives the screen', () => {
    it('keeps Restore, Export and erase disabled after unlock until a restore from before the lock ends', async () => {
      const importing = pending<{ entries: number; extras: { key: string; path: string }[] }>();
      let extras = '';
      jest.spyOn(vault, 'importBackup').mockImplementation((_source, _passphrase, extraDir) => {
        extras = extraDir;
        return importing.promise;
      });
      const view = await renderUnlocked();

      await startRestore(view);
      await lockAndUnlock();

      // The screen is new, but the restore it started before the lock is not over.
      expect(view.getByText('A restore started earlier is still running')).toBeOnTheScreen();
      for (const title of ['Restore from backup', 'Export vault', 'Delete everything']) {
        expect(rowLabelled(view, title)).toBeDisabled();
      }
      await fireEvent.press(rowLabelled(view, 'Restore from backup'));
      expect(pick).toHaveBeenCalledTimes(1);

      // The service refuses on its own too, before touching the first restore's extras.
      await expect(
        backupService.restoreBackup(PICKED, 'correct horse battery'),
      ).rejects.toMatchObject({ code: 'BACKUP_BUSY' });
      await expect(backupService.createBackup('correct horse battery')).rejects.toMatchObject({
        code: 'BACKUP_BUSY',
      });
      expect(vault.importBackup).toHaveBeenCalledTimes(1);
      expect(extras).not.toBe('');

      await act(async () => {
        importing.settle({
          entries: 19,
          extras: [{ key: 'database', path: `${extras}/database` }],
        });
      });
      await settleFor(50);

      expect(backupService.activity()).toBeNull();
      for (const title of ['Restore from backup', 'Export vault', 'Delete everything']) {
        expect(rowLabelled(view, title)).toBeEnabled();
      }
      expect(view.queryByText('A restore started earlier is still running')).toBeNull();
      expect(session.notice).toEqual({ message: 'Vault restored: 19 entries', tone: 'success' });
      expect(discardPicked).toHaveBeenCalledWith(PICKED);
    });

    it('keeps the backup rows disabled after unlock until an export from before the lock ends, then drops it unshared', async () => {
      const exporting = pending<{ entries: number; bytes: number }>();
      jest.spyOn(vault, 'exportBackup').mockReturnValue(exporting.promise);
      const view = await renderUnlocked();

      await fireEvent.press(view.getByText('Export vault'));
      await fireEvent.changeText(view.getByLabelText('Backup passphrase'), 'correct horse battery');
      await fireEvent.changeText(
        view.getByLabelText('Repeat the backup passphrase'),
        'correct horse battery',
      );
      await pressAndSettle(view.getByText('Create backup'), 50);
      await lockAndUnlock();

      expect(view.getByText('An export started earlier is still finishing')).toBeOnTheScreen();
      for (const title of ['Restore from backup', 'Export vault', 'Delete everything']) {
        expect(rowLabelled(view, title)).toBeDisabled();
      }
      await expect(
        backupService.restoreBackup(PICKED, 'correct horse battery'),
      ).rejects.toMatchObject({ code: 'BACKUP_BUSY' });

      await act(async () => {
        exporting.settle({ entries: 19, bytes: 1024 });
      });
      await settleFor(50);

      expect(share).not.toHaveBeenCalled();
      expect(discard).toHaveBeenCalledWith(CONTAINER);
      expect(session.notice).toEqual({ message: STOPPED });
      expect(backupService.activity()).toBeNull();
      expect(rowLabelled(view, 'Export vault')).toBeEnabled();
    });

    it('lets a restore end in failure behind the lock and then frees the rows', async () => {
      const importing = pending<never>();
      jest.spyOn(vault, 'importBackup').mockReturnValue(importing.promise);
      const view = await renderUnlocked();

      await startRestore(view);
      await lockAndUnlock();
      expect(rowLabelled(view, 'Restore from backup')).toBeDisabled();

      await act(async () => {
        importing.fail(Object.assign(new Error('bad'), { code: 'BACKUP_PASSPHRASE' }));
      });
      await settleFor(50);

      expect(rowLabelled(view, 'Restore from backup')).toBeEnabled();
      expect(session.notice).toEqual({
        message: 'That passphrase does not match this backup.',
        tone: 'danger',
      });
    });
  });
});

describe('Settings "Delete everything"', () => {
  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function eraseFromSettings() {
    const view = await renderUnlocked();
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const destructive = buttons?.find((button) => button.style === 'destructive');
      void destructive?.onPress?.();
    });
    await act(async () => {
      await fireEvent.press(view.getByText('Delete everything'));
    });
    await waitFor(() => expect(view.getByText('setup')).toBeOnTheScreen());
    return view;
  }

  it('reports the erase', async () => {
    const view = await eraseFromSettings();

    await waitFor(() => expect(view.getByText('Vault emptied')).toBeOnTheScreen());
  });

  it('still reports the erase and asks for setup when the old PIN cannot be removed', async () => {
    const remove = SecureStore.deleteItemAsync;
    jest
      .spyOn(SecureStore, 'deleteItemAsync')
      .mockImplementation((key) =>
        key === 'securevault.pin' ? Promise.reject(new Error('refused')) : remove(key),
      );

    const view = await eraseFromSettings();

    await waitFor(() =>
      expect(
        view.getByText(
          'Vault emptied, but the old PIN could not be removed. Set up the vault again now with a new PIN.',
        ),
      ).toBeOnTheScreen(),
    );
  });
});

describe('Settings restore refusals that leave the vault unchanged', () => {
  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
    pick.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    [
      'BACKUP_UNSUPPORTED',
      "This backup uses settings this version of the app doesn't support. Nothing was changed.",
    ],
    [
      'BACKUP_RESOURCE',
      "This device doesn't have enough memory to restore this backup. Nothing was changed.",
    ],
    [
      'BACKUP_NO_SPACE',
      "This device doesn't have enough free space to restore this backup. Nothing was changed. Free up some space and try again.",
    ],
    [
      'BACKUP_INVALID',
      'This file is not a SecureVault backup, or it is damaged. Nothing was changed.',
    ],
  ])(
    'shows %s in the restore sheet as a plain sentence and keeps Restore available',
    async (code, sentence) => {
      jest
        .spyOn(vault, 'importBackup')
        .mockRejectedValueOnce(
          Object.assign(new Error('/var/mobile/Containers/Data/x: native text'), { code }),
        );
      const view = await renderUnlocked();

      await startRestore(view);

      expect(view.getByText(sentence)).toBeOnTheScreen();
      expect(view.queryByText(/native text/)).toBeNull();
      expect(view.getByText('Restore')).toBeOnTheScreen();
      expect(backupService.activity()).toBeNull();
    },
  );

  it('shows a header the app does not support as a toast and opens no sheet', async () => {
    pick.mockResolvedValue({ canceled: false, assets: [{ uri: PICKED, name: 'backup.svbackup' }] });
    jest
      .spyOn(vault, 'inspectBackup')
      .mockRejectedValueOnce(
        Object.assign(new Error('600001 iterations'), { code: 'BACKUP_UNSUPPORTED' }),
      );
    const discardPicked = jest.spyOn(backupService, 'discardPickedFile');
    const view = await renderUnlocked();

    await act(async () => {
      await fireEvent.press(view.getByText('Restore from backup'));
    });

    await waitFor(() =>
      expect(
        view.getByText(
          "This backup uses settings this version of the app doesn't support. Nothing was changed.",
        ),
      ).toBeOnTheScreen(),
    );
    expect(view.queryByLabelText('Backup passphrase')).toBeNull();
    expect(discardPicked).toHaveBeenCalledWith(PICKED);
  });
});
