import { act, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import vault from '../../../modules/expo-vault';
import { SecurityOverlay } from './SecurityOverlay';
import { SessionProvider, useSession } from './SessionProvider';

jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: jest.fn(async () => {}),
  allowScreenCaptureAsync: jest.fn(async () => {}),
}));

const secureStoreMock = SecureStore as unknown as { __reset(): void };
const vaultMock = vault as unknown as { reset(): void };
const appState = AppState as unknown as {
  currentState: AppStateStatus;
  addEventListener: jest.Mock;
};
const listeners = new Set<(state: AppStateStatus) => void>();
const moveTo = (state: AppStateStatus) =>
  act(async () => {
    appState.currentState = state;
    for (const listener of [...listeners]) listener(state);
  });

let session: ReturnType<typeof useSession>;

function Capture() {
  const value = useSession();
  useEffect(() => {
    session = value;
  });
  return null;
}

async function renderUnlocked() {
  const view = await render(
    <SessionProvider>
      <Capture />
      <SecurityOverlay />
    </SessionProvider>,
  );
  await waitFor(() => expect(session.status).toBe('setup'));
  await act(async () => {
    await session.setUp('123456');
    // Leaving the app must not lock it during the test.
    await session.updateSettings({ autoLockSeconds: -1 });
  });
  return view;
}

const cover = (view: Awaited<ReturnType<typeof renderUnlocked>>) =>
  view.queryByTestId('privacy-cover', { includeHiddenElements: true });

describe('Privacy cover', () => {
  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
    listeners.clear();
    appState.currentState = 'active';
    appState.addEventListener.mockImplementation((_event, listener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    });
  });

  it('covers the vault while the app is inactive and lifts on return', async () => {
    const view = await renderUnlocked();
    expect(cover(view)).toBeNull();

    await moveTo('inactive');
    expect(cover(view)).toBeOnTheScreen();

    await moveTo('active');
    expect(cover(view)).toBeNull();
  });

  it('stays off when the Privacy cover setting is off', async () => {
    const view = await renderUnlocked();
    await act(async () => session.updateSettings({ privacyScreen: false }));

    await moveTo('inactive');
    expect(cover(view)).toBeNull();
  });
});
