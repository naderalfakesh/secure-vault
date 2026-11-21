import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';

import { documentDatabase } from '@/data/database';
import { resetAppState } from '@/testing/appState';
import { settle } from '@/testing/async';
import {
  share,
  session,
  renderUnlocked,
  nativeExport,
  pending,
  pressAndSettle,
} from '@/testing/backupHub';
import { secureStoreMock } from '@/testing/secureStore';
import { vaultMock } from '@/testing/vault';
import vault from '@modules/expo-vault';

jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), navigate: jest.fn() },
  Stack: { Screen: () => null },
}));

describe('Settings "Delete everything"', () => {
  beforeEach(async () => {
    vaultMock.reset();
    // The reset forgets the index key and file name the open connection was made with.
    await documentDatabase.close();
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
describe('Backup hub create flow', () => {
  beforeEach(async () => {
    vaultMock.reset();
    // The reset forgets the index key and file name the open connection was made with.
    await documentDatabase.close();
    secureStoreMock.__reset();
    resetAppState();
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
      vaultMock.emitProgress({
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
    await settle(600);
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
