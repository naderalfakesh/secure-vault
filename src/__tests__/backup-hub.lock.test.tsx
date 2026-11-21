import { act, fireEvent, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import { documentDatabase } from '@/data/database';
import { appState, resetAppState } from '@/testing/appState';
import { settle } from '@/testing/async';
import { createBackup, plantRestoredIndex } from '@/testing/backup';
import {
  share,
  pick,
  moveTo,
  STOPPED,
  PICKED,
  KEPT,
  session,
  renderUnlocked,
  CONTAINER,
  nativeExport,
  pending,
  rowLabelled,
  pressAndSettle,
  runExport,
  startRestore,
  lockAndUnlock,
  openRestore,
} from '@/testing/backupHub';
import { secureStoreMock } from '@/testing/secureStore';
import { vaultMock } from '@/testing/vault';
import vault from '@modules/expo-vault';

import { backupService } from '../services/BackupService';

jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), navigate: jest.fn() },
  Stack: { Screen: () => null },
}));

describe('Backup hub and the lock gate', () => {
  let discard: jest.SpyInstance;
  let discardPicked: jest.SpyInstance;

  beforeEach(async () => {
    vaultMock.reset();
    // The reset forgets the index key and file name the open connection was made with.
    await documentDatabase.close();
    secureStoreMock.__reset();
    resetAppState();
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
    await settle(50);

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

      await plantRestoredIndex(extras);
      await act(async () => {
        importing.settle({
          entries: 19,
          extras: [{ key: 'database', path: `${extras}/database` }],
        });
      });
      await settle(50);

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
      await settle(50);

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
      await settle(50);

      expect(rowLabelled(view, 'Restore from a backup…')).toBeEnabled();
      expect(session.notice).toEqual({
        message: 'That passphrase does not match this backup. Nothing was changed.',
        tone: 'danger',
      });
    });
  });
});
