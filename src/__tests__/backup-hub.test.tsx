import { useEffect } from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { Alert, AppState, type AppStateStatus, Text } from 'react-native';

import SettingsScreen from '../../app/(tabs)/settings';
import BackupScreen from '../../app/settings/backup';
import vault, { type BackupProgress } from '../../modules/expo-vault';
import { ToastProvider } from '../components/ui';
import { SessionProvider, useSession } from '../features/session/SessionProvider';
import type { SecuritySettings } from '../features/session/settings';
import { backupService } from '../services/BackupService';
import { createBackup } from '@/testing/backup';

type AutoLockSeconds = SecuritySettings['autoLockSeconds'];
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), navigate: jest.fn() },
  Stack: { Screen: () => null },
}));

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
// Where the service keeps the picked backup, out of the purgeable cache (M2).
const KEPT = 'file:///mock/document/restore-source/picked.svbackup';

/** The picker answers with a fresh copy of the file in its cache folder, as on a device. */
function pickReturns(name: string) {
  pick.mockImplementation(async () => {
    const copy = new File(PICKED);
    copy.create({ intermediates: true, overwrite: true });
    copy.write('ciphertext');
    return { canceled: false, assets: [{ uri: PICKED, name }] };
  });
}

let session: ReturnType<typeof useSession>;

// The lock gate as the root layout applies it: no settings screen while locked.
function Gate({ screen }: { screen: 'backup' | 'settings' }) {
  const value = useSession();
  useEffect(() => {
    session = value;
  });
  if (value.status !== 'unlocked') return <Text>{value.status}</Text>;
  return screen === 'backup' ? <BackupScreen /> : <SettingsScreen />;
}

async function renderUnlocked(
  autoLockSeconds: AutoLockSeconds = 0,
  screen: 'backup' | 'settings' = 'backup',
) {
  const view = await render(
    <SessionProvider>
      <ToastProvider>
        <Gate screen={screen} />
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
  await fireEvent.press(view.getByText('Create a backup'));
  await fireEvent.changeText(view.getByLabelText('Passphrase'), 'correct horse battery');
  await fireEvent.changeText(view.getByLabelText('Repeat passphrase'), 'correct horse battery');
  await pressAndSettle(view.getByText('Create backup'), 1200);
}

async function startRestore(view: Awaited<ReturnType<typeof renderUnlocked>>) {
  await openRestore(view);
  await fireEvent.changeText(view.getByLabelText('Backup passphrase'), 'correct horse battery');
  await pressAndSettle(view.getByRole('button', { name: 'Restore and replace vault' }), 50);
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
  pickReturns('backup.svbackup');
  jest
    .spyOn(backupService, 'inspectBackup')
    .mockResolvedValue({ version: 1, app: 'SecureVault', created: '2026-10-16', entries: 19 });
  await fireEvent.press(view.getByText('Restore from a backup…'));
  await waitFor(() => expect(view.getByText(/19 entries/)).toBeOnTheScreen());
}

describe('Backup hub and the lock gate', () => {
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

  it('offers one way out of the create sheet: Cancel, with no close button', async () => {
    const view = await renderUnlocked();

    await fireEvent.press(view.getByText('Create a backup'));

    expect(view.getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();
    expect(view.queryByRole('button', { name: 'Close' })).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(view.queryByLabelText('Repeat passphrase')).toBeNull());
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

  it('shows when the last backup was made on this phone once one has been shared', async () => {
    nativeExport();
    const view = await renderUnlocked();
    expect(view.queryByText(/Last created on this phone/)).toBeNull();

    await runExport(view);

    expect(view.getByText(/^Last created on this phone: \w+/)).toBeOnTheScreen();
    expect(await SecureStore.getItemAsync('securevault.lastBackup')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('records no backup date when the vault locked before the share', async () => {
    nativeExport(() => session.lock());
    const view = await renderUnlocked();

    await runExport(view);

    expect(await SecureStore.getItemAsync('securevault.lastBackup')).toBeNull();
    expect(view.getByText('locked')).toBeOnTheScreen();
  });

  it('frees the export and removes the backup when the vault locks under a share that never settles', async () => {
    nativeExport();
    share.mockImplementation(() => new Promise(() => {}));
    const view = await renderUnlocked();

    await runExport(view);
    expect(share).toHaveBeenCalledTimes(1);
    expect(backupService.activity()).toBe('export');

    await act(async () => {
      session.lock();
    });
    await settleFor(50);

    expect(view.getByText('locked')).toBeOnTheScreen();
    expect(discard).toHaveBeenCalledWith(CONTAINER);
    expect(backupService.activity()).toBeNull();
    expect(session.notice).toEqual({
      message: 'SecureVault locked while you were sharing. The temporary copy was removed.',
    });
    share.mockImplementation(async () => {});
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

    expect(discardPicked).toHaveBeenCalledWith(KEPT);
  });

  it("removes the picker's copy after a restore", async () => {
    jest.spyOn(backupService, 'restoreBackup').mockResolvedValue(19);
    const view = await renderUnlocked();

    await openRestore(view);
    await fireEvent.changeText(view.getByLabelText('Backup passphrase'), 'correct horse battery');
    await pressAndSettle(view.getByRole('button', { name: 'Restore and replace vault' }), 50);

    expect(discardPicked).toHaveBeenCalledWith(KEPT);
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
    await pressAndSettle(view.getByRole('button', { name: 'Restore and replace vault' }), 50);

    expect(view.getByText('locked')).toBeOnTheScreen();
    expect(view.queryByText('Vault restored: 19 entries')).toBeNull();
    expect(session.notice).toEqual({ message: 'Vault restored: 19 entries', tone: 'success' });
    expect(discardPicked).toHaveBeenCalledWith(KEPT);
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
    expect(discardPicked).toHaveBeenCalledWith(KEPT);
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
      for (const title of ['Restore from a backup…', 'Create a backup']) {
        expect(rowLabelled(view, title)).toBeDisabled();
      }
      await fireEvent.press(rowLabelled(view, 'Restore from a backup…'));
      expect(pick).toHaveBeenCalledTimes(1);

      // The service refuses on its own too, before touching the first restore's extras.
      await expect(
        backupService.restoreBackup(PICKED, 'correct horse battery'),
      ).rejects.toMatchObject({ code: 'BACKUP_BUSY' });
      await expect(createBackup('correct horse battery')).rejects.toMatchObject({
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
      for (const title of ['Restore from a backup…', 'Create a backup']) {
        expect(rowLabelled(view, title)).toBeEnabled();
      }
      expect(view.queryByText('A restore started earlier is still running')).toBeNull();
      expect(session.notice).toEqual({ message: 'Vault restored: 19 entries', tone: 'success' });
      expect(discardPicked).toHaveBeenCalledWith(KEPT);
    });

    it('keeps the backup rows disabled after unlock until an export from before the lock ends, then drops it unshared', async () => {
      const exporting = pending<{ entries: number; bytes: number }>();
      jest.spyOn(vault, 'exportBackup').mockReturnValue(exporting.promise);
      const view = await renderUnlocked();

      await fireEvent.press(view.getByText('Create a backup'));
      await fireEvent.changeText(view.getByLabelText('Passphrase'), 'correct horse battery');
      await fireEvent.changeText(view.getByLabelText('Repeat passphrase'), 'correct horse battery');
      await pressAndSettle(view.getByText('Create backup'), 50);
      await lockAndUnlock();

      expect(view.getByText('An export started earlier is still finishing')).toBeOnTheScreen();
      for (const title of ['Restore from a backup…', 'Create a backup']) {
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
      expect(rowLabelled(view, 'Create a backup')).toBeEnabled();
    });

    it('lets a restore end in failure behind the lock and then frees the rows', async () => {
      const importing = pending<never>();
      jest.spyOn(vault, 'importBackup').mockReturnValue(importing.promise);
      const view = await renderUnlocked();

      await startRestore(view);
      await lockAndUnlock();
      expect(rowLabelled(view, 'Restore from a backup…')).toBeDisabled();

      await act(async () => {
        importing.fail(Object.assign(new Error('bad'), { code: 'BACKUP_PASSPHRASE' }));
      });
      await settleFor(50);

      expect(rowLabelled(view, 'Restore from a backup…')).toBeEnabled();
      expect(session.notice).toEqual({
        message: 'That passphrase does not match this backup. Nothing was changed.',
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
    const view = await renderUnlocked(0, 'settings');
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const destructive = buttons?.find((button) => button.style === 'destructive');
      void destructive?.onPress?.();
    });
    await fireEvent.press(view.getByText('Delete everything'));
    // The sheet explains first; its button opens the native destructive alert.
    expect(view.getByText(/and the vault index are erased from this phone/)).toBeOnTheScreen();
    await act(async () => {
      await fireEvent.press(view.getByRole('button', { name: 'Delete everything' }));
    });
    await waitFor(() => expect(view.getByText('setup')).toBeOnTheScreen());
    return view;
  }

  it('offers to create a backup first, which leads to the Backup hub and erases nothing', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const view = await renderUnlocked(0, 'settings');

    await fireEvent.press(view.getByText('Delete everything'));
    await fireEvent.press(view.getByRole('link', { name: 'Create a backup first' }));

    expect(router.push).toHaveBeenCalledWith('/settings/backup');
    expect(alert).not.toHaveBeenCalled();
    expect(view.queryByText(/and the vault index are erased from this phone/)).toBeNull();
    expect(session.status).toBe('unlocked');
  });

  it('reports the erase and forgets when the last backup was made', async () => {
    await SecureStore.setItemAsync('securevault.lastBackup', '2026-10-12T09:30:00.000Z');
    const view = await eraseFromSettings();

    await waitFor(() => expect(view.getByText('Vault emptied')).toBeOnTheScreen());
    expect(await SecureStore.getItemAsync('securevault.lastBackup')).toBeNull();
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

describe('Backup hub restore refusals that leave the vault unchanged', () => {
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
      'Close',
    ],
    [
      'BACKUP_RESOURCE',
      "This device doesn't have enough free space or memory to restore this backup. Nothing was changed.",
      'Close',
    ],
    [
      'BACKUP_NO_SPACE',
      "This device doesn't have enough free space to restore this backup. Nothing was changed. Free up some space and try again.",
      'Close',
    ],
    [
      'BACKUP_INVALID',
      'This file is not a SecureVault backup, or it is damaged. Nothing was changed.',
      'Choose another file',
    ],
  ])(
    'shows %s in the restore sheet as a plain sentence with its one button',
    async (code, sentence, button) => {
      jest
        .spyOn(vault, 'importBackup')
        .mockRejectedValueOnce(
          Object.assign(new Error('/var/mobile/Containers/Data/x: native text'), { code }),
        );
      const view = await renderUnlocked();

      await startRestore(view);

      expect(view.getByText(sentence)).toBeOnTheScreen();
      expect(view.queryByText(/native text/)).toBeNull();
      expect(view.getAllByRole('button', { name: button }).length).toBeGreaterThan(0);
      expect(view.queryByRole('button', { name: 'Restore and replace vault' })).toBeNull();
      expect(backupService.activity()).toBeNull();
    },
  );

  it('shows a header the app does not support inline in the restore sheet', async () => {
    pickReturns('backup.svbackup');
    jest
      .spyOn(vault, 'inspectBackup')
      .mockRejectedValueOnce(
        Object.assign(new Error('600001 iterations'), { code: 'BACKUP_UNSUPPORTED' }),
      );
    const discardPicked = jest.spyOn(backupService, 'discardPickedFile');
    const view = await renderUnlocked();

    await act(async () => {
      await fireEvent.press(view.getByText('Restore from a backup…'));
    });

    await waitFor(() =>
      expect(
        view.getByText(
          "This backup uses settings this version of the app doesn't support. Nothing was changed.",
        ),
      ).toBeOnTheScreen(),
    );
    // In the sheet, with its one button, not in a toast; no passphrase is asked for.
    expect(view.getByText('Restore from backup')).toBeOnTheScreen();
    const close = view.getAllByRole('button', { name: 'Close' });
    expect(close.length).toBeGreaterThan(0);
    expect(view.queryByLabelText('Backup passphrase')).toBeNull();
    expect(view.queryByRole('button', { name: 'Restore and replace vault' })).toBeNull();
    expect(discardPicked).toHaveBeenCalledWith(KEPT);
    await act(async () => {
      await fireEvent.press(close[close.length - 1]);
    });
    await waitFor(() => expect(view.queryByText('Restore from backup')).toBeNull());
  });
});

describe('Backup hub picker after "Choose another file"', () => {
  const BUSY = Object.assign(
    new Error(
      "Calling the 'getDocumentAsync' function has failed → Caused by: Different document picking in progress. Await other document picking first",
    ),
    { code: 'ERR_PICKING_IN_PROGRESS' },
  );

  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
    pick.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("opens the picker again only once the restore sheet's modal has gone", async () => {
    jest
      .spyOn(vault, 'importBackup')
      .mockRejectedValueOnce(Object.assign(new Error('damaged'), { code: 'BACKUP_INVALID' }));
    const view = await renderUnlocked();
    await startRestore(view);
    expect(pick).toHaveBeenCalledTimes(1);

    // The modal's dismissal callback, as iOS calls it once the sheet is gone.
    const dismissed = view.getByTestId('restore-sheet').props.onDismiss as () => void;
    const choose = view.getAllByRole('button', { name: 'Choose another file' });
    await act(async () => {
      await fireEvent.press(choose[choose.length - 1]);
    });
    // The sheet is closing: no picker on top of a view controller being dismissed.
    expect(pick).toHaveBeenCalledTimes(1);

    // iOS reports the modal gone; the picker opens then, once.
    await act(async () => {
      dismissed();
    });
    await waitFor(() => expect(view.getByText(/19 entries/)).toBeOnTheScreen());
    expect(pick).toHaveBeenCalledTimes(2);
    // The fallback that covers a missing dismissal does not pick a second time.
    await settleFor(1100);
    expect(pick).toHaveBeenCalledTimes(2);
  });

  it('still opens the picker when the dismissal is never reported', async () => {
    jest
      .spyOn(vault, 'importBackup')
      .mockRejectedValueOnce(Object.assign(new Error('damaged'), { code: 'BACKUP_INVALID' }));
    const view = await renderUnlocked();
    await startRestore(view);

    const choose = view.getAllByRole('button', { name: 'Choose another file' });
    await act(async () => {
      await fireEvent.press(choose[choose.length - 1]);
    });
    expect(pick).toHaveBeenCalledTimes(1);
    await settleFor(1100);
    expect(pick).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(view.getByText(/19 entries/)).toBeOnTheScreen());
  });

  it('retries once when a pick is still in progress and never shows the module text', async () => {
    jest
      .spyOn(backupService, 'inspectBackup')
      .mockResolvedValue({ version: 1, app: 'SecureVault', created: '2026-10-16', entries: 19 });
    pickReturns('backup.svbackup');
    pick.mockRejectedValueOnce(BUSY);
    const view = await renderUnlocked();

    await pressAndSettle(view.getByText('Restore from a backup…'), 800);

    await waitFor(() => expect(view.getByText(/19 entries/)).toBeOnTheScreen());
    expect(pick).toHaveBeenCalledTimes(2);
    expect(view.queryByText(/getDocumentAsync|in progress/)).toBeNull();
  });

  it('says a plain sentence when the picker still cannot open, and the next tap works', async () => {
    jest
      .spyOn(backupService, 'inspectBackup')
      .mockResolvedValue({ version: 1, app: 'SecureVault', created: '2026-10-16', entries: 19 });
    pick.mockRejectedValue(BUSY);
    const view = await renderUnlocked();

    await pressAndSettle(view.getByText('Restore from a backup…'), 800);

    await waitFor(() =>
      expect(
        view.getByText('The file picker couldn’t open. Try again in a moment.'),
      ).toBeOnTheScreen(),
    );
    expect(pick).toHaveBeenCalledTimes(2);
    expect(view.queryByText(/getDocumentAsync|in progress/)).toBeNull();

    pickReturns('backup.svbackup');
    await act(async () => {
      await fireEvent.press(view.getByText('Restore from a backup…'));
    });
    await waitFor(() => expect(view.getByText(/19 entries/)).toBeOnTheScreen());
  });
});

describe('Backup hub restore phases and outcomes', () => {
  const emitProgress = (event: BackupProgress) =>
    (vault as unknown as { emitProgress(event: BackupProgress): void }).emitProgress(event);

  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
    pick.mockReset();
    (router.navigate as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens on the inspect step: file, warning, explainer and a destructive restore button', async () => {
    const view = await renderUnlocked();

    await openRestore(view);

    expect(view.getByText(/^19 entries · made .*2026$/)).toBeOnTheScreen();
    expect(
      view.getByText(
        'Everything currently in this vault will be replaced by this backup, including documents added after it was made.',
      ),
    ).toBeOnTheScreen();
    expect(
      view.getByText(
        'SecureVault checks the whole file first. Nothing changes until every entry has been checked.',
      ),
    ).toBeOnTheScreen();
    const restore = view.getByRole('button', { name: 'Restore and replace vault' });
    expect(restore).toBeDisabled();
    await fireEvent.changeText(view.getByLabelText('Backup passphrase'), 'x');
    expect(restore).toBeEnabled();
  });

  it('keeps the passphrase and Restore after a wrong passphrase, with no counter', async () => {
    jest
      .spyOn(vault, 'importBackup')
      .mockRejectedValue(Object.assign(new Error('native'), { code: 'BACKUP_PASSPHRASE' }));
    const view = await renderUnlocked();

    await startRestore(view);
    await pressAndSettle(view.getByRole('button', { name: 'Restore and replace vault' }), 50);

    expect(
      view.getAllByText('That passphrase does not match this backup. Nothing was changed.'),
    ).toHaveLength(1);
    expect(view.getByLabelText('Backup passphrase').props.value).toBe('correct horse battery');
    expect(view.getByRole('button', { name: 'Restore and replace vault' })).toBeEnabled();
    expect(view.queryByText(/attempt/i)).toBeNull();
  });

  it('shows no count before the first entry is done', async () => {
    const importing = pending<never>();
    jest.spyOn(vault, 'importBackup').mockImplementation(() => {
      emitProgress({ phase: 'verify', done: 0, total: 1 });
      return importing.promise;
    });
    const view = await renderUnlocked();

    await startRestore(view);

    expect(view.getByText('Checking…')).toBeOnTheScreen();
    expect(view.queryByText(/Checking 0 of/)).toBeNull();

    await act(async () => {
      importing.fail(Object.assign(new Error('cancelled'), { code: 'BACKUP_CANCELLED' }));
    });
    await settleFor(20);
    expect(backupService.activity()).toBeNull();
  });

  it('starts the native restore only once Checking is on screen (F1)', async () => {
    const importing = pending<never>();
    let checkingShownAtStart: boolean | null = null;
    const view = await renderUnlocked();
    jest.spyOn(vault, 'importBackup').mockImplementation(() => {
      checkingShownAtStart = view.queryByText('Checking…') !== null;
      return importing.promise;
    });
    await openRestore(view);
    await fireEvent.changeText(view.getByLabelText('Backup passphrase'), 'correct horse battery');

    // The press's own act ends once its render is committed; the frame after it starts the module.
    await fireEvent.press(view.getByRole('button', { name: 'Restore and replace vault' }));
    await settleFor(50);

    expect(checkingShownAtStart).toBe(true);
    await act(async () => {
      importing.fail(Object.assign(new Error('cancelled'), { code: 'BACKUP_CANCELLED' }));
    });
    await settleFor(20);
  });

  it('honours a Cancel pressed before the native restore started, with nothing changed', async () => {
    const importBackup = jest.spyOn(vault, 'importBackup');
    const view = await renderUnlocked();
    await openRestore(view);
    await fireEvent.changeText(view.getByLabelText('Backup passphrase'), 'correct horse battery');

    await act(async () => {
      void fireEvent.press(view.getByRole('button', { name: 'Restore and replace vault' }));
      // Checking is drawn, and Cancel pressed, before the next frame lets the module start.
      await Promise.resolve();
    });
    await fireEvent.press(view.getByRole('button', { name: 'Cancel' }));
    await settleFor(50);

    expect(importBackup).not.toHaveBeenCalled();
    expect(view.getByText('Restore cancelled. Nothing was changed.')).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Restore and replace vault' })).toBeEnabled();
    expect(backupService.activity()).toBeNull();
  });

  it('shows Checking with Cancel, and a cancel leaves the vault as it was', async () => {
    const importing = pending<never>();
    let cancelled = false;
    jest.spyOn(vault, 'importBackup').mockImplementation(() => {
      emitProgress({ phase: 'verify', done: 3, total: 20 });
      return importing.promise;
    });
    jest.spyOn(vault, 'cancelRestore').mockImplementation(() => {
      cancelled = true;
      return true;
    });
    const view = await renderUnlocked();

    await startRestore(view);

    // The check entry is entry 1 of the module's 20; the sheet counts the 19 documents' entries.
    expect(view.getByText('Checking 2 of 19')).toBeOnTheScreen();
    expect(view.getByText('Step 1 of 2')).toBeOnTheScreen();
    expect(view.getByText('Nothing has been changed yet.')).toBeOnTheScreen();
    // Not dismissable while it runs.
    expect(view.queryByRole('button', { name: 'Close' })).toBeNull();

    await act(async () => {
      await fireEvent.press(view.getByRole('button', { name: 'Cancel' }));
    });
    expect(cancelled).toBe(true);
    expect(view.getByText('Cancelling…')).toBeOnTheScreen();

    await act(async () => {
      importing.fail(Object.assign(new Error('cancelled'), { code: 'BACKUP_CANCELLED' }));
    });
    await settleFor(20);

    expect(view.getByText('Restore cancelled. Nothing was changed.')).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Restore and replace vault' })).toBeEnabled();
    expect(backupService.activity()).toBeNull();
  });

  it('stops showing Cancelling and reports the restore when the module refuses the cancel', async () => {
    const importing = pending<{ entries: number; extras: { key: string; path: string }[] }>();
    let extras = '';
    jest.spyOn(vault, 'importBackup').mockImplementation((_source, _passphrase, extraDir) => {
      extras = extraDir;
      emitProgress({ phase: 'verify', done: 3, total: 20 });
      return importing.promise;
    });
    // Accepted on the press; refused on the re-ask, which comes after the cancel point.
    jest.spyOn(vault, 'cancelRestore').mockReturnValueOnce(true).mockReturnValue(false);
    const view = await renderUnlocked();

    await startRestore(view);
    await act(async () => {
      await fireEvent.press(view.getByRole('button', { name: 'Cancel' }));
    });
    expect(view.getByText('Cancelling…')).toBeOnTheScreen();

    await act(async () => {
      emitProgress({ phase: 'verify', done: 20, total: 20 });
    });
    expect(view.queryByText('Cancelling…')).toBeNull();

    await act(async () => {
      emitProgress({ phase: 'import', done: 1, total: 20 });
      importing.settle({ entries: 19, extras: [{ key: 'database', path: `${extras}/database` }] });
    });
    await settleFor(50);

    expect(view.queryByText('Restore cancelled. Nothing was changed.')).toBeNull();
    expect(view.getByText('Vault restored: 19 entries')).toBeOnTheScreen();
  });

  it('swaps Cancel for "This can\'t be stopped" at the first Restoring event', async () => {
    const importing = pending<never>();
    jest.spyOn(vault, 'importBackup').mockImplementation(() => {
      emitProgress({ phase: 'verify', done: 20, total: 20 });
      return importing.promise;
    });
    const view = await renderUnlocked();

    await startRestore(view);
    expect(view.getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();

    await act(async () => {
      emitProgress({ phase: 'import', done: 2, total: 20 });
    });

    expect(view.getByText('Restoring 1 of 19')).toBeOnTheScreen();
    expect(view.getByText('Step 2 of 2')).toBeOnTheScreen();
    expect(view.getByTestId('restore-cant-stop').props.accessibilityLabel).toBe(
      'This can’t be stopped. The previous vault has been removed. Keep SecureVault open until this finishes.',
    );
    expect(view.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(view.queryByText('Nothing has been changed yet.')).toBeNull();
    expect(backupService.cancelRestore()).toBe(false);

    await act(async () => {
      importing.fail(Object.assign(new Error('User not authenticated'), { code: 'KEY_LOCKED' }));
    });
    await settleFor(20);

    expect(view.getByText('The restore didn’t finish')).toBeOnTheScreen();
    expect(
      view.getByText(
        'The restore stopped after the previous vault was removed. Restore the backup again.',
      ),
    ).toBeOnTheScreen();
    // Entry 1 is the check entry; the restore stopped on the second of the 19 entries.
    expect(view.getByText('Stopped at entry 2 of 19')).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Restore again' })).toBeOnTheScreen();
    expect(view.queryByText(/Nothing was changed/)).toBeNull();
  });

  it.each([
    ['KEY_LOCKED', 'The device key was not unlocked, so nothing was changed. Try again.'],
    ['KEY_INVALIDATED', /can no longer be used\..* Nothing was changed\.$/],
  ])(
    'reports a %s from the key probe after Checking as unchanged, not partial',
    async (code, sentence) => {
      jest.spyOn(vault, 'importBackup').mockImplementationOnce(async () => {
        // The module probes the key after the checking pass, before any Restoring event.
        emitProgress({ phase: 'verify', done: 20, total: 20 });
        throw Object.assign(new Error('User not authenticated'), { code });
      });
      const view = await renderUnlocked();

      await startRestore(view);

      expect(view.getByText(sentence)).toBeOnTheScreen();
      expect(view.queryByText('The restore didn’t finish')).toBeNull();
      expect(view.getByRole('button', { name: 'Restore and replace vault' })).toBeEnabled();
    },
  );

  it('offers Restore again when the index could not be opened', async () => {
    jest.spyOn(vault, 'importBackup').mockImplementationOnce(async (_s, _p, extraDir) => {
      emitProgress({ phase: 'import', done: 20, total: 20 });
      return { entries: 19, extras: [{ key: 'database', path: `${extraDir}/database` }] };
    });
    jest
      .spyOn(backupService as unknown as { replaceVault: () => Promise<number> }, 'replaceVault')
      .mockImplementationOnce(async () => {
        emitProgress({ phase: 'import', done: 20, total: 20 });
        throw Object.assign(new Error('file is not a database'), { code: 'BACKUP_INDEX' });
      });
    const view = await renderUnlocked();

    await startRestore(view);

    expect(
      view.getByText(
        'Your documents were restored but the index could not be opened. Restore the backup again.',
      ),
    ).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Restore again' })).toBeOnTheScreen();
  });

  it('closes the sheet on success and goes to the reloaded Library', async () => {
    jest.spyOn(backupService, 'restoreBackup').mockResolvedValue(19);
    const view = await renderUnlocked();

    await startRestore(view);

    expect(view.getByText('Vault restored: 19 entries')).toBeOnTheScreen();
    expect(view.queryByLabelText('Backup passphrase')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith('/');
    expect(session.status).toBe('unlocked');
  });

  it('shows a picked file that is not a backup as a danger toast and opens no sheet', async () => {
    pickReturns('photo.jpg');
    const view = await renderUnlocked();

    await act(async () => {
      await fireEvent.press(view.getByText('Restore from a backup…'));
    });

    await waitFor(() =>
      expect(view.getByText('That file isn’t a SecureVault backup.')).toBeOnTheScreen(),
    );
    expect(view.queryByLabelText('Backup passphrase')).toBeNull();
  });

  it('does nothing when the picker is cancelled', async () => {
    pick.mockResolvedValue({ canceled: true, assets: null });
    const view = await renderUnlocked();

    await act(async () => {
      await fireEvent.press(view.getByText('Restore from a backup…'));
    });

    expect(view.queryByLabelText('Backup passphrase')).toBeNull();
    expect(view.queryByRole('alert')).toBeNull();
  });
});

describe('Backup hub create flow', () => {
  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
    share.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function openCreate() {
    const view = await renderUnlocked();
    await fireEvent.press(view.getByText('Create a backup'));
    return view;
  }

  it('explains the passphrase and enables Create only for a valid, repeated passphrase', async () => {
    const view = await openCreate();

    expect(
      view.getByText(
        'Choose a passphrase. You’ll need it to restore, and SecureVault can’t recover it for you.',
      ),
    ).toBeOnTheScreen();
    expect(
      view.getByText(
        'A few unrelated words are easier to remember than a short, complex password.',
      ),
    ).toBeOnTheScreen();
    expect(
      view.getByText('Type it exactly the same way when you restore, on any phone.'),
    ).toBeOnTheScreen();
    const create = view.getByRole('button', { name: 'Create backup' });
    expect(create).toBeDisabled();
    expect(view.getByLabelText('At least 8 characters, not met')).toBeOnTheScreen();
    expect(view.getByLabelText('Not the same character repeated, not met')).toBeOnTheScreen();

    await fireEvent.changeText(view.getByLabelText('Passphrase'), 'aaaaaaaa');
    expect(view.getByLabelText('At least 8 characters, met')).toBeOnTheScreen();
    expect(view.getByLabelText('Not the same character repeated, not met')).toBeOnTheScreen();
    await fireEvent.changeText(view.getByLabelText('Repeat passphrase'), 'aaaaaaaa');
    expect(create).toBeDisabled();

    await fireEvent.changeText(view.getByLabelText('Passphrase'), 'correct horse battery');
    expect(create).toBeDisabled();
    expect(view.getByText('The passphrases don’t match yet.')).toBeOnTheScreen();
    await fireEvent.changeText(view.getByLabelText('Repeat passphrase'), 'correct horse battery');
    expect(view.getByLabelText('Passphrases match')).toBeOnTheScreen();
    expect(create).toBeEnabled();
  });

  it('shows strength as a soft hint and never blocks a weak passphrase that meets the rules', async () => {
    const view = await openCreate();

    await fireEvent.changeText(view.getByLabelText('Passphrase'), 'abcdefgh');
    await fireEvent.changeText(view.getByLabelText('Repeat passphrase'), 'abcdefgh');

    expect(view.getByLabelText('Passphrase strength: Weak')).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Create backup' })).toBeEnabled();
  });

  it('accepts a passphrase in any script', async () => {
    const view = await openCreate();
    const arabic = 'قمر فوق جبل الشيخ ٢٠٢٦';

    await fireEvent.changeText(view.getByLabelText('Passphrase'), arabic);
    await fireEvent.changeText(view.getByLabelText('Repeat passphrase'), arabic);

    expect(view.getByRole('button', { name: 'Create backup' })).toBeEnabled();
  });

  it('shows a busy sheet that cannot be dismissed while encrypting', async () => {
    const exporting = pending<{ entries: number; bytes: number }>();
    jest.spyOn(vault, 'exportBackup').mockImplementation(() => {
      (vault as unknown as { emitProgress(event: BackupProgress): void }).emitProgress({
        phase: 'export',
        done: 12,
        total: 48,
      });
      return exporting.promise;
    });
    const view = await openCreate();
    await fireEvent.changeText(view.getByLabelText('Passphrase'), 'correct horse battery');
    await fireEvent.changeText(view.getByLabelText('Repeat passphrase'), 'correct horse battery');

    await pressAndSettle(view.getByRole('button', { name: 'Create backup' }), 20);

    expect(view.getByText('Creating backup')).toBeOnTheScreen();
    expect(view.getByText('Encrypting 12 of 48')).toBeOnTheScreen();
    expect(view.getByText('25%')).toBeOnTheScreen();
    expect(
      view.getByText(
        'Keep SecureVault open until this finishes. Your vault isn’t changed by creating a backup.',
      ),
    ).toBeOnTheScreen();
    expect(view.queryByRole('button', { name: 'Close' })).toBeNull();

    await act(async () => {
      exporting.settle({ entries: 19, bytes: 1024 });
    });
    await settleFor(600);
    expect(share).toHaveBeenCalledTimes(1);
  });

  it('reports a failed backup in the same sheet with Try again and Close', async () => {
    jest
      .spyOn(vault, 'exportBackup')
      .mockRejectedValueOnce(
        Object.assign(new Error('/var/mobile/x: ENOSPC'), { code: 'BACKUP_EXPORT_FAILED' }),
      );
    const view = await openCreate();
    await fireEvent.changeText(view.getByLabelText('Passphrase'), 'correct horse battery');
    await fireEvent.changeText(view.getByLabelText('Repeat passphrase'), 'correct horse battery');

    await pressAndSettle(view.getByRole('button', { name: 'Create backup' }), 20);

    expect(
      view.getByText(
        'The backup couldn’t be created. There may not be enough free space. Your vault wasn’t changed.',
      ),
    ).toBeOnTheScreen();
    expect(view.queryByText(/ENOSPC/)).toBeNull();
    expect(share).not.toHaveBeenCalled();

    nativeExport();
    await pressAndSettle(view.getByRole('button', { name: 'Try again' }), 1200);
    expect(share).toHaveBeenCalledTimes(1);
  });
});
