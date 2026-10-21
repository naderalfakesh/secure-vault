import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { Text } from 'react-native';

import SettingsScreen from '../../app/(tabs)/settings';
import BackupScreen from '../../app/settings/backup';
import vault from '../../modules/expo-vault';
import { ToastProvider } from '../components/ui';
import { SessionProvider, useSession } from '../features/session/SessionProvider';

jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
}));

const ROOT = join(__dirname, '..', '..');
const secureStoreMock = SecureStore as unknown as { __reset(): void };
const vaultMock = vault as unknown as { reset(): void };
// A restore entry names itself first: "Restore from a backup…".
const RESTORE_ENTRY = /^Restore/i;

let session: ReturnType<typeof useSession>;

function Gate({ screen }: { screen: 'settings' | 'backup' }) {
  const value = useSession();
  useEffect(() => {
    session = value;
  });
  if (value.status !== 'unlocked') return <Text>{value.status}</Text>;
  return screen === 'settings' ? <SettingsScreen /> : <BackupScreen />;
}

async function renderUnlocked(screen: 'settings' | 'backup') {
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
  return view;
}

function filesBelow(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesBelow(path) : [path];
  });
}

const routeFiles = () =>
  filesBelow(join(ROOT, 'app'))
    .filter((path) => /\.tsx?$/.test(path))
    .map((path) => relative(ROOT, path));

/** G11 (handover §0.3): exactly one user-reachable restore entry, and no way in from outside. */
describe('the one restore entry', () => {
  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
    (router.push as jest.Mock).mockClear();
  });

  afterEach(() => jest.restoreAllMocks());

  it('is nowhere in Settings, which leads to the Backup hub instead', async () => {
    const settings = await renderUnlocked('settings');
    const settingsButtons = settings.getAllByRole('button');
    expect(
      settingsButtons.filter((button) => RESTORE_ENTRY.test(button.props.accessibilityLabel ?? '')),
    ).toHaveLength(0);
    await fireEvent.press(settings.getByRole('button', { name: /^Backup/ }));
    expect(router.push).toHaveBeenCalledWith('/settings/backup');
  });

  it('is exactly one row in the Backup hub', async () => {
    const hub = await renderUnlocked('backup');
    const entries = hub
      .getAllByRole('button')
      .filter((button) => RESTORE_ENTRY.test(button.props.accessibilityLabel ?? ''));
    expect(entries).toHaveLength(1);
    expect(entries[0].props.accessibilityLabel).toMatch(/^Restore from a backup…/);
  });

  it('is the only route that reads or restores a backup', () => {
    const callers = routeFiles().filter((path) =>
      /restoreBackup|inspectBackup|cancelRestore/.test(readFileSync(join(ROOT, path), 'utf8')),
    );
    expect(callers).toEqual([join('app', 'settings', 'backup.tsx')]);
    // The hub takes no parameters, so no URL can hand it a file or start a restore.
    const hub = readFileSync(join(ROOT, 'app', 'settings', 'backup.tsx'), 'utf8');
    expect(hub).not.toMatch(/useLocalSearchParams|useGlobalSearchParams|Linking/);
    expect(routeFiles().filter((path) => /restore/i.test(path))).toEqual([]);
    expect(routeFiles().filter((path) => /\+native-intent/.test(path))).toEqual([]);
  });

  it('has no deep link, intent filter or document type for backup files', () => {
    const config = readFileSync(join(ROOT, 'app.json'), 'utf8');
    expect(config).not.toMatch(
      /intentFilters|CFBundleDocumentTypes|UTImportedTypeDeclarations|LSSupportsOpeningDocumentsInPlace|associatedDomains|svbackup/,
    );
    for (const plugin of filesBelow(join(ROOT, 'plugins')).filter((path) => path.endsWith('.js'))) {
      expect(readFileSync(plugin, 'utf8')).not.toMatch(
        /intent-filter|CFBundleDocumentTypes|UTImportedTypeDeclarations|svbackup/,
      );
    }
  });
});
