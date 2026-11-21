import { act, fireEvent, waitFor } from '@testing-library/react-native';

import { documentDatabase } from '@/data/database';
import { settle } from '@/testing/async';
import {
  pick,
  KEPT,
  pickReturns,
  renderUnlocked,
  pressAndSettle,
  startRestore,
} from '@/testing/backupHub';
import { at } from '@/testing/lists';
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

describe('Backup hub restore refusals that leave the vault unchanged', () => {
  beforeEach(async () => {
    vaultMock.reset();
    // The reset forgets the index key and file name the open connection was made with.
    await documentDatabase.close();
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
      await fireEvent.press(at(close, -1));
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

  beforeEach(async () => {
    vaultMock.reset();
    // The reset forgets the index key and file name the open connection was made with.
    await documentDatabase.close();
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
      await fireEvent.press(at(choose, -1));
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
    await settle(1100);
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
      await fireEvent.press(at(choose, -1));
    });
    expect(pick).toHaveBeenCalledTimes(1);
    await settle(1100);
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
