import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { Linking, Text } from 'react-native';

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

  afterEach(() => jest.restoreAllMocks());

  it('groups the security rows and leads to backups through one Backup row', async () => {
    const view = await renderUnlocked('settings');

    expect(view.getByRole('switch', { name: /^Privacy cover/ })).toBeChecked();
    expect(view.queryByText('Privacy screen')).toBeNull();
    expect(view.queryByText(/Test authentication/)).toBeNull();
    expect(view.queryByText(/Secure Enclave|secure hardware/i)).toBeNull();
    expect(view.queryByLabelText(/Restore/)).toBeNull();
    expect(view.getByRole('button', { name: /^Backup/ })).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Lock now' })).toBeOnTheScreen();
    expect(view.getByText('Detail suggestions')).toBeOnTheScreen();
  });

  it('turns biometric unlock off and on from the Face ID switch', async () => {
    const view = await renderUnlocked('settings');

    const row = await view.findByRole('switch', { name: /^Face ID/ });
    expect(row).toBeChecked();
    expect(view.getByText('Unlock without typing your PIN')).toBeOnTheScreen();
    await act(async () =>
      fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } }),
    );

    await waitFor(() => expect(session.settings.biometricUnlock).toBe(false));
    const stored = JSON.parse((await SecureStore.getItemAsync('securevault.settings')) ?? '{}');
    expect(stored.biometricUnlock).toBe(false);
  });

  it('disables the Face ID row with the reason when Face ID is not set up', async () => {
    jest.spyOn(LocalAuthentication, 'isEnrolledAsync').mockResolvedValue(false);
    const view = await renderUnlocked('settings');

    expect(
      await view.findByText(
        'Face ID isn’t set up on this phone. Set it up in the Settings app, then come back.',
      ),
    ).toBeOnTheScreen();
    expect(view.getByRole('switch', { name: /^Face ID/ })).toBeDisabled();
    expect(view.queryByRole('button', { name: 'Open Settings' })).toBeNull();
  });

  it('offers the Settings app when SecureVault was refused Face ID', async () => {
    jest.spyOn(LocalAuthentication, 'isEnrolledAsync').mockResolvedValue(false);
    jest.spyOn(LocalAuthentication, 'hasHardwareAsync').mockResolvedValue(false);
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    const view = await renderUnlocked('settings');

    expect(
      await view.findByText(
        'SecureVault isn’t allowed to use Face ID. You can allow it in Settings.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Open Settings' }));
    expect(openSettings).toHaveBeenCalled();
  });

  it('opens How your data is protected from About', async () => {
    const view = await renderUnlocked('settings');

    await fireEvent.press(view.getByRole('button', { name: /^How your data is protected/ }));

    expect(router.push).toHaveBeenCalledWith('/settings/protection');
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
