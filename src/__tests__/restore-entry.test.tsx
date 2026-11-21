import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { at } from '@/testing/lists';
import { renderUnlockedScreen } from '@/testing/renderUnlocked';
import { secureStoreMock } from '@/testing/secureStore';
import { vaultMock } from '@/testing/vault';

import SettingsScreen from '../../app/(tabs)/settings';
import BackupScreen from '../../app/settings/backup';

jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
}));

const ROOT = join(__dirname, '..', '..');
// A restore entry names itself first: "Restore from a backup…".
const RESTORE_ENTRY = /^Restore/i;

async function renderUnlocked(screen: 'settings' | 'backup') {
  const view = await renderUnlockedScreen(
    screen === 'settings' ? <SettingsScreen /> : <BackupScreen />,
  );
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

const screenFiles = () =>
  filesBelow(join(ROOT, 'src', 'screens'))
    .filter((path) => /\.tsx?$/.test(path) && !path.includes('__tests__'))
    .map((path) => relative(ROOT, path));

/** Exactly one user-reachable restore entry, and no way in from outside. */
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
    expect(at(entries, 0).props.accessibilityLabel).toMatch(/^Restore from a backup…/);
  });

  it('is the only route that reads or restores a backup', () => {
    // Routes only bind a URL to a screen: the hub's route is the one that
    // binds the Backup screen, whose files live in src/screens/backup.
    const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
    const hubRoute = join('app', 'settings', 'backup.tsx');
    const hubFiles = screenFiles().filter((path) =>
      path.startsWith(join('src', 'screens', 'backup') + sep),
    );
    const outsideHub = (path: string) => !hubFiles.includes(path);
    expect(routeFiles().filter((path) => /@\/screens\/backup\b/.test(read(path)))).toEqual([
      hubRoute,
    ]);
    const callers = [...routeFiles(), ...screenFiles()].filter((path) =>
      /restoreBackup|inspectBackup|cancelRestore/.test(read(path)),
    );
    expect(callers.length).toBeGreaterThan(0);
    expect(callers.filter(outsideHub)).toEqual([]);
    // Nor does any other route or screen mount the restore sheet.
    const mounts = [...routeFiles(), ...screenFiles()].filter((path) =>
      /RestoreSheet/.test(read(path)),
    );
    expect(mounts.length).toBeGreaterThan(0);
    expect(mounts.filter(outsideHub)).toEqual([]);
    // The hub takes no parameters, so no URL can hand it a file or start a restore.
    for (const path of [hubRoute, ...hubFiles]) {
      expect(read(path)).not.toMatch(/useLocalSearchParams|useGlobalSearchParams|Linking/);
    }
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
