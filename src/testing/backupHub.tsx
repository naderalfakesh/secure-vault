import { act, fireEvent, waitFor } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { setAppState } from '@/testing/appState';
import { renderUnlockedScreen } from '@/testing/renderUnlocked';
import type { Session } from '@/testing/session';
import vault from '@modules/expo-vault';

import SettingsScreen from '../../app/(tabs)/settings';
import BackupScreen from '../../app/settings/backup';
import type { SecuritySettings } from '../features/session/settings';
import { backupService } from '../services/BackupService';

export type AutoLockSeconds = SecuritySettings['autoLockSeconds'];

export const share = Sharing.shareAsync as jest.Mock;
export const pick = DocumentPicker.getDocumentAsync as jest.Mock;

// Called from inside mocked work, which already runs in the press's act scope.
export const moveTo = setAppState;

export const STOPPED =
  'The backup was cancelled before it could be shared. Nothing left the vault.';
export const PICKED = 'file:///mock/cache/DocumentPicker/839E8D63.svbackup';
// Where the service keeps the picked backup, out of the purgeable cache (M2).
export const KEPT = 'file:///mock/document/restore-source/picked.svbackup';

/** The picker answers with a fresh copy of the file in its cache folder, as on a device. */
export function pickReturns(name: string) {
  pick.mockImplementation(async () => {
    const copy = new File(PICKED);
    copy.create({ intermediates: true, overwrite: true });
    copy.write('ciphertext');
    return { canceled: false, assets: [{ uri: PICKED, name }] };
  });
}

export let session: Session;

export async function renderUnlocked(
  autoLockSeconds: AutoLockSeconds = 0,
  screen: 'backup' | 'settings' = 'backup',
) {
  const view = await renderUnlockedScreen(
    screen === 'backup' ? <BackupScreen /> : <SettingsScreen />,
    {
      onSession: (value) => {
        session = value;
      },
    },
  );
  await act(async () => {
    await session.updateSettings({ autoLockSeconds });
  });
  return view;
}

// The real service writes and removes the container; only the native export is stubbed.
export const CONTAINER = expect.stringMatching(
  /\/backup\/SecureVault%20backup%20\d{4}-\d{2}-\d{2}\.svbackup$/,
);
export const nativeExport = (during: () => void = () => {}) =>
  jest.spyOn(vault, 'exportBackup').mockImplementation(async () => {
    during();
    return { entries: 19, bytes: 471948836 };
  });

// A native call that stays open until the test settles it, as a large backup does.
export function pending<T>() {
  let settle!: (value: T) => void;
  let fail!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  return { promise, settle, fail };
}

export const rowLabelled = (view: Awaited<ReturnType<typeof renderUnlocked>>, title: string) =>
  view.getByLabelText(new RegExp(`^${title}`));

// Presses inside one act that also covers the work the press starts: the
// pause before the share sheet and any trip away.
export const pressAndSettle = (element: Parameters<typeof fireEvent.press>[0], ms: number) =>
  act(async () => {
    void fireEvent.press(element);
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

export async function runExport(view: Awaited<ReturnType<typeof renderUnlocked>>) {
  await fireEvent.press(view.getByText('Create a backup'));
  await fireEvent.changeText(view.getByLabelText('Passphrase'), 'correct horse battery');
  await fireEvent.changeText(view.getByLabelText('Repeat passphrase'), 'correct horse battery');
  await pressAndSettle(view.getByText('Create backup'), 1200);
}

export async function startRestore(view: Awaited<ReturnType<typeof renderUnlocked>>) {
  await openRestore(view);
  await fireEvent.changeText(view.getByLabelText('Backup passphrase'), 'correct horse battery');
  await pressAndSettle(view.getByRole('button', { name: 'Restore and replace vault' }), 50);
}

export async function lockAndUnlock() {
  await act(async () => {
    session.lock();
  });
  await act(async () => {
    await session.unlockWithPin('123456');
  });
}

export async function openRestore(view: Awaited<ReturnType<typeof renderUnlocked>>) {
  pickReturns('backup.svbackup');
  jest
    .spyOn(backupService, 'inspectBackup')
    .mockResolvedValue({ version: 1, app: 'SecureVault', created: '2026-10-16', entries: 19 });
  await fireEvent.press(view.getByText('Restore from a backup…'));
  await waitFor(() => expect(view.getByText(/19 entries/)).toBeOnTheScreen());
}
