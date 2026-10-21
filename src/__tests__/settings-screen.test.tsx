import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { Text } from 'react-native';

import SettingsScreen from '../../app/(tabs)/settings';
import AutoLockScreen from '../../app/settings/auto-lock';
import vault from '../../modules/expo-vault';
import { ToastProvider } from '../components/ui';
import { SessionProvider, useSession } from '../features/session/SessionProvider';

jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
}));

const secureStoreMock = SecureStore as unknown as { __reset(): void };
const vaultMock = vault as unknown as { reset(): void };

let session: ReturnType<typeof useSession>;

function Gate({ screen }: { screen: 'settings' | 'auto-lock' }) {
  const value = useSession();
  useEffect(() => {
    session = value;
  });
  if (value.status !== 'unlocked') return <Text>{value.status}</Text>;
  return screen === 'settings' ? <SettingsScreen /> : <AutoLockScreen />;
}

async function renderUnlocked(screen: 'settings' | 'auto-lock') {
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

describe('Settings', () => {
  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
    (router.push as jest.Mock).mockClear();
  });

  it('groups the security rows and keeps exactly one restore entry', async () => {
    const view = await renderUnlocked('settings');

    expect(view.getByRole('switch', { name: /^Privacy cover/ })).toBeChecked();
    expect(view.queryByText('Privacy screen')).toBeNull();
    expect(view.queryByText(/Test authentication/)).toBeNull();
    expect(view.queryByText(/Secure Enclave|secure hardware/i)).toBeNull();
    expect(view.getAllByLabelText(/^Restore from backup/)).toHaveLength(1);
    expect(view.getByRole('button', { name: 'Lock now' })).toBeOnTheScreen();
    expect(view.getByText('Detail suggestions')).toBeOnTheScreen();
  });

  it('opens the Auto-lock page from its row, which shows the current choice', async () => {
    const view = await renderUnlocked('settings');

    await fireEvent.press(view.getByRole('button', { name: /^Auto-lock, 1 minute/ }));

    expect(router.push).toHaveBeenCalledWith('/settings/auto-lock');
  });

  it('explains Delete everything in a sheet before the native alert', async () => {
    const view = await renderUnlocked('settings');

    await fireEvent.press(view.getByText('Delete everything'));

    await waitFor(() =>
      expect(
        view.getByText(
          'All documents and the vault index are erased from this phone. This can’t be undone. Backups you saved elsewhere aren’t affected.',
        ),
      ).toBeOnTheScreen(),
    );
    expect(view.queryByText('Create a backup first')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Cancel' }));
    expect(session.status).toBe('unlocked');
  });
});

describe('Auto-lock page', () => {
  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
  });

  it('saves the choice and warns plainly when Never is picked', async () => {
    const view = await renderUnlocked('auto-lock');

    expect(view.getByRole('radio', { name: 'After 1 minute' })).toBeChecked();
    expect(
      view.getByText(
        'Counted from when you leave SecureVault. The privacy cover hides the vault straight away either way.',
      ),
    ).toBeOnTheScreen();
    expect(view.queryByText(/Anyone holding your unlocked phone/)).toBeNull();

    await act(async () => {
      await fireEvent.press(view.getByRole('radio', { name: 'Never' }));
    });

    expect(session.settings.autoLockSeconds).toBe(-1);
    expect(view.getByRole('radio', { name: 'Never' })).toBeChecked();
    expect(
      view.getByLabelText('Anyone holding your unlocked phone can open the vault.'),
    ).toBeOnTheScreen();
  });
});
