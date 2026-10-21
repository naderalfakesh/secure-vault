import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { useEffect } from 'react';
import { Text } from 'react-native';

import vault from '../../modules/expo-vault';
import { hashPasscode } from '../features/auth/passcode';
import { useSession } from '../features/session/SessionProvider';

const secureStoreMock = SecureStore as unknown as { __reset(): void };
const vaultMock = vault as unknown as { reset(): void; unlockWithBiometrics(): Promise<boolean> };

let session: ReturnType<typeof useSession>;

function Home() {
  const value = useSession();
  useEffect(() => {
    session = value;
  });
  return <Text>Vault home</Text>;
}

const stub = (label: string) =>
  function Stub() {
    return <Text>{label}</Text>;
  };

// The real root layout, lock screen and tab layout, with light stand-ins for
// the document and settings screens so the test only exercises the lock gate.
const routes = {
  appDir: 'app',
  overrides: {
    '(tabs)/index': Home,
    '(tabs)/settings': stub('Settings screen'),
    'documents/[id]': stub('Document detail'),
    'documents/add': stub('Add document'),
    'settings/change-pin': stub('Change PIN'),
    'settings/auto-lock': stub('Auto-lock page'),
    'setup/index': stub('Welcome'),
    'setup/pin': stub('Choose a PIN'),
  },
};

describe('lock navigation', () => {
  let errors: string[];
  let consoleError: jest.SpyInstance;

  beforeEach(async () => {
    vaultMock.reset();
    secureStoreMock.__reset();
    await vault.createVault();
    await SecureStore.setItemAsync('securevault.pin', hashPasscode('123456', { iterations: 64 }));
    errors = [];
    consoleError = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(String(args[0]));
      // An update loop never settles; fail fast instead of spinning the worker.
      if (errors.length > 20) throw new Error(`console.error flood: ${errors[0]}`);
    });
  });

  afterEach(() => {
    consoleError.mockRestore();
    jest.restoreAllMocks();
  });

  async function openUnlockedVault() {
    // The lock screen prompts for biometrics on mount; the mock approves it.
    await renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('Vault home');
    // From now on the prompt is declined, so the lock screen has to stay up.
    jest.spyOn(vaultMock, 'unlockWithBiometrics').mockResolvedValue(false);
  }

  it('shows the lock screen when an open vault locks', async () => {
    await openUnlockedVault();

    await act(async () => session.lock());

    await screen.findByText(/enter your PIN/);
    expect(screen.queryByText('Vault home')).toBeNull();
    expect(errors.filter((message) => message.includes('Maximum update depth'))).toEqual([]);
  });

  it('opens on the lock screen at cold start', async () => {
    jest.spyOn(vaultMock, 'unlockWithBiometrics').mockResolvedValue(false);
    await renderRouter(routes, { initialUrl: '/' });

    await screen.findByText(/enter your PIN/);
    expect(screen.queryByText('Vault home')).toBeNull();
  });

  it('opens on setup at cold start without a vault', async () => {
    vaultMock.reset();
    secureStoreMock.__reset();
    await renderRouter(routes, { initialUrl: '/' });

    await screen.findByText('Welcome');
    expect(screen.queryByText(/enter your PIN/)).toBeNull();
  });

  it('shows setup after Delete everything from an open vault', async () => {
    await openUnlockedVault();

    await act(async () => session.eraseVault());

    await screen.findByText('Welcome');
    expect(screen.queryByText('Vault home')).toBeNull();
    expect(errors.filter((message) => message.includes('Maximum update depth'))).toEqual([]);
  });

  it('shows the lock screen when the vault locks under an open modal', async () => {
    await openUnlockedVault();
    await act(async () => router.push('/documents/add'));
    await screen.findByText('Add document');

    await act(async () => session.lock());

    await screen.findByText(/enter your PIN/);
    await waitFor(() => expect(screen.queryByText('Add document')).toBeNull());
    expect(errors.filter((message) => message.includes('Maximum update depth'))).toEqual([]);
  });

  it('shows the Library tab bar with Settings and the Scan button', async () => {
    await openUnlockedVault();

    expect(screen.getByRole('tab', { name: 'Library' })).toBeSelected();
    await act(async () => fireEvent.press(screen.getByRole('tab', { name: 'Settings' })));
    await screen.findByText('Settings screen');
    expect(screen.getByRole('tab', { name: 'Settings' })).toBeSelected();

    await act(async () =>
      fireEvent.press(screen.getByRole('button', { name: 'Scan or import a document' })),
    );
    await screen.findByText('Add document');
  });

  it('never opens the Auto-lock page past the lock gate', async () => {
    jest.spyOn(vaultMock, 'unlockWithBiometrics').mockResolvedValue(false);
    await renderRouter(routes, { initialUrl: '/settings/auto-lock' });

    await screen.findByText(/enter your PIN/);
    expect(screen.queryByText('Auto-lock page')).toBeNull();
  });
});
