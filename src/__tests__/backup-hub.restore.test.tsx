import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { documentDatabase } from '@/data/database';
import { settle } from '@/testing/async';
import { plantRestoredIndex } from '@/testing/backup';
import {
  pick,
  pickReturns,
  session,
  renderUnlocked,
  pending,
  pressAndSettle,
  startRestore,
  openRestore,
} from '@/testing/backupHub';
import { secureStoreMock } from '@/testing/secureStore';
import { vaultMock } from '@/testing/vault';
import vault, { type BackupProgress } from '@modules/expo-vault';

import { backupService } from '../services/BackupService';

jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), navigate: jest.fn() },
  Stack: { Screen: () => null },
}));

describe('Backup hub restore phases and outcomes', () => {
  const emitProgress = (event: BackupProgress) => vaultMock.emitProgress(event);

  beforeEach(async () => {
    vaultMock.reset();
    // The reset forgets the index key and file name the open connection was made with.
    await documentDatabase.close();
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
    await settle(20);
    expect(backupService.activity()).toBeNull();
  });

  it('starts the native restore only once Checking is on screen', async () => {
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
    await settle(50);

    expect(checkingShownAtStart).toBe(true);
    await act(async () => {
      importing.fail(Object.assign(new Error('cancelled'), { code: 'BACKUP_CANCELLED' }));
    });
    await settle(20);
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
    await settle(50);

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
    await settle(20);

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

    await plantRestoredIndex(extras);
    await act(async () => {
      emitProgress({ phase: 'import', done: 1, total: 20 });
      importing.settle({ entries: 19, extras: [{ key: 'database', path: `${extras}/database` }] });
    });
    await settle(50);

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
    await settle(20);

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
