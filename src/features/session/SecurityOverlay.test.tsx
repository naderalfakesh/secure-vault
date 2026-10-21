import { act, render, waitFor, within } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import vault from '../../../modules/expo-vault';
import { SecurityOverlay } from './SecurityOverlay';
import { SessionProvider, useSession } from './SessionProvider';

// The native overlay window, as a plain view the test can look inside.
jest.mock('react-native-screens', () => {
  const { View } = jest.requireActual('react-native');
  return {
    ...jest.requireActual('react-native-screens'),
    FullWindowOverlay: ({ children }: { children: React.ReactNode }) => (
      <View testID="full-window-overlay">{children}</View>
    ),
  };
});

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

  it('draws the cover in a full-window overlay on iOS, above native modals', async () => {
    const view = await renderUnlocked();

    await moveTo('inactive');

    const overlay = view.getByTestId('full-window-overlay', { includeHiddenElements: true });
    expect(
      within(overlay).getByTestId('privacy-cover', { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it('keeps the cover up briefly after a return to a vault that locked while away', async () => {
    jest.useFakeTimers();
    try {
      const view = await renderUnlocked();
      await moveTo('background');
      await act(async () => session.lock());
      expect(cover(view)).toBeOnTheScreen();

      await moveTo('active');
      // A sheet that was open is still being dismissed under it.
      expect(cover(view)).toBeOnTheScreen();

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      expect(cover(view)).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
