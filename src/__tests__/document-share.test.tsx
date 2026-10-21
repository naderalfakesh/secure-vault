import { useEffect } from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import { AppState, type AppStateStatus, Platform, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { closeDocumentStore } from '@/data/database';

import DocumentDetailScreen from '../../app/documents/[id]';
import vault from '../../modules/expo-vault';
import { ToastProvider } from '../components/ui';
import * as SessionModule from '../features/session/SessionProvider';
import {
  AUTO_LOCK_RETURN_GRACE_MS,
  SessionProvider,
  useSession,
} from '../features/session/SessionProvider';
import { documentService } from '../services/DocumentService';
import { DocumentCategory } from '../types';

jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-router', () => {
  const params: { id?: string } = {};
  return {
    __params: params,
    router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true },
    useLocalSearchParams: () => params,
    // The viewer draws its own chrome; the stack header stays hidden.
    Stack: { Screen: () => null },
  };
});

const share = Sharing.shareAsync as jest.Mock;
const routeParams = (jest.requireMock('expo-router') as { __params: { id?: string } }).__params;
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

function Gate() {
  const value = useSession();
  useEffect(() => {
    session = value;
  });
  return value.status === 'unlocked' ? <DocumentDetailScreen /> : <Text>{value.status}</Text>;
}

async function renderUnlocked() {
  const document = await documentService.addDocument(
    { uri: '/tmp/passport.jpg', name: 'passport.jpg', type: 'image/jpeg', size: 2048 },
    { title: 'Passport', category: DocumentCategory.ID },
  );
  routeParams.id = document.id;
  const view = await render(
    <GestureHandlerRootView>
      <SessionProvider>
        <ToastProvider>
          <Gate />
        </ToastProvider>
      </SessionProvider>
    </GestureHandlerRootView>,
  );
  await waitFor(() => expect(view.getByText('setup')).toBeOnTheScreen());
  await act(async () => {
    await session.setUp('123456');
  });
  await waitFor(() => expect(view.getByRole('button', { name: 'Share a copy' })).toBeEnabled());
  return view;
}

const pressAndSettle = (element: Parameters<typeof fireEvent.press>[0], ms = 50) =>
  act(async () => {
    void fireEvent.press(element);
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

const settle = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

/** The warning sheet's own close, then the system share sheet (handover §6 J5). */
const SHEET_CLOSE_MS = 450;

const LEAD = 'SecureVault locked while you were sharing.';

/** Viewer Share → warning sheet → Share, then the sheet closes before the system sheet opens. */
async function confirmShare(view: Awaited<ReturnType<typeof renderUnlocked>>) {
  await pressAndSettle(view.getByRole('button', { name: 'Share a copy' }));
  await pressAndSettle(view.getByRole('button', { name: 'Share' }), SHEET_CLOSE_MS + 150);
}

describe('Document sharing and the lock gate', () => {
  beforeEach(async () => {
    vaultMock.reset();
    secureStoreMock.__reset();
    await closeDocumentStore();
    appState.currentState = 'active';
    listeners.clear();
    appState.addEventListener.mockImplementation((_event, listener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    });
    share.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows a plain sentence, not the native text, when the device key prompt was cancelled', async () => {
    jest.spyOn(vault, 'getFile').mockRejectedValue(
      Object.assign(new Error('Failed to decrypt file: User not authenticated'), {
        code: 'KEY_LOCKED',
      }),
    );
    const document = await documentService.addDocument(
      { uri: '/tmp/passport.jpg', name: 'passport.jpg', type: 'image/jpeg', size: 2048 },
      { title: 'Passport', category: DocumentCategory.ID },
    );
    routeParams.id = document.id;
    const view = await render(
      <SessionProvider>
        <ToastProvider>
          <Gate />
        </ToastProvider>
      </SessionProvider>,
    );
    await waitFor(() => expect(view.getByText('setup')).toBeOnTheScreen());
    await act(async () => {
      await session.setUp('123456');
    });

    await waitFor(() =>
      expect(
        view.getByText(
          'The device key was not unlocked, so your documents stay closed. Try again.',
        ),
      ).toBeOnTheScreen(),
    );
    expect(view.queryByText(/not authenticated/)).toBeNull();
  });

  it('shares the decrypted copy while the vault stays unlocked, then removes it', async () => {
    const discard = jest.fn();
    jest.spyOn(documentService, 'prepareShareFile').mockResolvedValue({
      uri: 'file:///mock/cache/share/Passport.jpg',
      discard,
      expireAfter: jest.fn(),
    });
    const view = await renderUnlocked();

    await confirmShare(view);

    expect(share).toHaveBeenCalledWith('file:///mock/cache/share/Passport.jpg', expect.anything());
    expect(discard).toHaveBeenCalledTimes(1);
  });

  it('warns before sharing and creates nothing when the warning is cancelled', async () => {
    const prepare = jest.spyOn(documentService, 'prepareShareFile');
    const view = await renderUnlocked();

    await pressAndSettle(view.getByRole('button', { name: 'Share a copy' }));

    expect(view.getByText('Share a decrypted copy?')).toBeOnTheScreen();
    expect(
      view.getByText(
        'Whoever gets this file can open it without your PIN. SecureVault removes its temporary copy when sharing ends, but it can’t control copies the other app keeps.',
      ),
    ).toBeOnTheScreen();
    // The file card names the one document being shared.
    expect(view.getByLabelText('⁨Passport⁩, 1 page · Image · 2.0 KB')).toBeOnTheScreen();
    expect(prepare).not.toHaveBeenCalled();

    await pressAndSettle(view.getByRole('button', { name: 'Cancel' }), SHEET_CLOSE_MS);

    expect(view.queryByText('Share a decrypted copy?')).toBeNull();
    expect(prepare).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
  });

  it('asks for Face ID from the warning when Confirm before sharing is on', async () => {
    const discard = jest.fn();
    jest.spyOn(documentService, 'prepareShareFile').mockResolvedValue({
      uri: 'file:///mock/cache/share/Passport.jpg',
      discard,
      expireAfter: jest.fn(),
    });
    const view = await renderUnlocked();
    await act(async () => {
      await session.updateSettings({ biometricsForShare: true });
    });
    const stepUp = jest.spyOn(vault, 'unlockWithBiometrics').mockResolvedValueOnce(false);

    await pressAndSettle(view.getByRole('button', { name: 'Share a copy' }));
    await pressAndSettle(view.getByRole('button', { name: 'Confirm with Face ID' }));

    // Declined: nothing is made and the warning stays for another try.
    expect(stepUp).toHaveBeenCalledTimes(1);
    expect(share).not.toHaveBeenCalled();
    expect(view.getByText('Share a decrypted copy?')).toBeOnTheScreen();

    await pressAndSettle(
      view.getByRole('button', { name: 'Confirm with Face ID' }),
      SHEET_CLOSE_MS + 150,
    );

    expect(share).toHaveBeenCalledTimes(1);
    expect(discard).toHaveBeenCalledTimes(1);
  });

  it('shows the preparing step for a slow copy, and Cancel removes the copy it made', async () => {
    const discard = jest.fn();
    let finish!: () => void;
    jest.spyOn(documentService, 'prepareShareFile').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () =>
            resolve({
              uri: 'file:///mock/cache/share/Passport.jpg',
              discard,
              expireAfter: jest.fn(),
            });
        }),
    );
    const view = await renderUnlocked();

    await pressAndSettle(view.getByRole('button', { name: 'Share a copy' }));
    await pressAndSettle(view.getByRole('button', { name: 'Share' }), 100);
    expect(view.queryByText('Preparing a copy')).toBeNull();
    await settle(400);

    expect(view.getByText('Preparing a copy')).toBeOnTheScreen();
    await pressAndSettle(view.getByRole('button', { name: 'Cancel' }), SHEET_CLOSE_MS);
    expect(view.queryByText('Preparing a copy')).toBeNull();

    await act(async () => finish());
    await settle(SHEET_CLOSE_MS + 100);

    expect(discard).toHaveBeenCalledTimes(1);
    expect(share).not.toHaveBeenCalled();
  });

  it('never shares a cancelled copy that arrives after the next share started', async () => {
    const first = jest.fn();
    const second = jest.fn();
    let finishFirst!: () => void;
    jest
      .spyOn(documentService, 'prepareShareFile')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirst = () =>
              resolve({
                uri: 'file:///mock/cache/share/a/Passport.jpg',
                discard: first,
                expireAfter: jest.fn(),
              });
          }),
      )
      .mockResolvedValueOnce({
        uri: 'file:///mock/cache/share/b/Passport.jpg',
        discard: second,
        expireAfter: jest.fn(),
      });
    share.mockImplementation(() => new Promise(() => {}));
    try {
      const view = await renderUnlocked();
      await pressAndSettle(view.getByRole('button', { name: 'Share a copy' }));
      await pressAndSettle(view.getByRole('button', { name: 'Share' }), 500);
      await pressAndSettle(view.getByRole('button', { name: 'Cancel' }), SHEET_CLOSE_MS);

      await confirmShare(view);
      await act(async () => finishFirst());
      await settle(SHEET_CLOSE_MS + 100);

      expect(first).toHaveBeenCalledTimes(1);
      expect(share).toHaveBeenCalledTimes(1);
      expect(share).toHaveBeenCalledWith(
        'file:///mock/cache/share/b/Passport.jpg',
        expect.anything(),
      );
    } finally {
      share.mockImplementation(async () => {});
    }
  });

  it('says why after the unlock when the vault locked while the share sheet was open', async () => {
    const discard = jest.fn();
    jest.spyOn(documentService, 'prepareShareFile').mockResolvedValue({
      uri: 'file:///mock/cache/share/Passport.jpg',
      discard,
      expireAfter: jest.fn(),
    });
    share.mockImplementation(() => new Promise(() => {}));
    try {
      const view = await renderUnlocked();
      await confirmShare(view);
      expect(share).toHaveBeenCalledTimes(1);

      await act(async () => session.lock());

      expect(view.getByText('locked')).toBeOnTheScreen();
      expect(discard).toHaveBeenCalledTimes(1);
      expect(session.shareInterrupted).toEqual({ documentId: routeParams.id });
      // Never a toast over the lock screen: the banner waits for the viewer.
      expect(session.notice).toBeNull();

      await act(async () => {
        await session.unlock();
      });

      await waitFor(() => expect(view.getByText(LEAD)).toBeOnTheScreen());
      expect(
        view.getByText(/The temporary copy was removed\. Share again if you still need to\./),
      ).toBeOnTheScreen();

      await pressAndSettle(view.getByRole('button', { name: 'Dismiss' }));
      expect(view.queryByText(LEAD)).toBeNull();
      expect(session.shareInterrupted).toBeNull();
    } finally {
      share.mockImplementation(async () => {});
    }
  });

  it('arms the native copy expiry for the Android chooser, bounded by auto-lock', async () => {
    const os = Platform.OS;
    const expireAfter = jest.fn();
    jest.spyOn(documentService, 'prepareShareFile').mockResolvedValue({
      uri: 'file:///mock/cache/share/a/Passport.jpeg',
      discard: jest.fn(),
      expireAfter,
    });
    try {
      Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
      const view = await renderUnlocked();
      await act(async () => {
        await session.updateSettings({ autoLockSeconds: 900 });
      });
      await confirmShare(view);
      expect(expireAfter).toHaveBeenLastCalledWith(900_000);

      await act(async () => {
        await session.updateSettings({ autoLockSeconds: 0 });
      });
      await confirmShare(view);
      expect(expireAfter).toHaveBeenLastCalledWith(120_000);

      expireAfter.mockClear();
      await act(async () => {
        await session.updateSettings({ autoLockSeconds: -1 });
      });
      await confirmShare(view);
      expect(expireAfter).not.toHaveBeenCalled();

      // iOS suspends the app instead; the lock dismisses the sheet there.
      Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
      await act(async () => {
        await session.updateSettings({ autoLockSeconds: 0 });
      });
      await confirmShare(view);
      expect(expireAfter).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    }
  });

  it('ends the auto-lock pause with the session when the dismissed sheet never settles', async () => {
    jest.spyOn(documentService, 'prepareShareFile').mockResolvedValue({
      uri: 'file:///mock/cache/share/a/Passport.jpeg',
      discard: jest.fn(),
      expireAfter: jest.fn(),
    });
    // UIKit may never call the completion handler after a programmatic dismiss.
    share.mockImplementation(() => new Promise(() => {}));
    try {
      const view = await renderUnlocked();
      await confirmShare(view);
      await act(async () => session.lock());
      await act(async () => {
        await session.unlock();
      });
      await act(async () => {
        await session.updateSettings({ autoLockSeconds: 0 });
      });

      const now = Date.now();
      const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
      await moveTo('background');
      clock.mockReturnValue(now + 90_000);
      await moveTo('active');

      expect(view.getByText('locked')).toBeOnTheScreen();
    } finally {
      share.mockImplementation(async () => {});
    }
  });

  it('forgets a banner that was seen once its viewer closes', async () => {
    const view = await renderUnlocked();
    await act(async () => session.markShareInterrupted(routeParams.id!));
    await waitFor(() => expect(view.getByText(LEAD)).toBeOnTheScreen());

    // Back to the Library (here: the lock takes the viewer away).
    await act(async () => session.lock());

    expect(session.shareInterrupted).toBeNull();
  });

  it('keeps the mark of a newer share cut short while an older banner was showing', async () => {
    jest.spyOn(documentService, 'prepareShareFile').mockResolvedValue({
      uri: 'file:///mock/cache/share/a/Passport.jpeg',
      discard: jest.fn(),
      expireAfter: jest.fn(),
    });
    share.mockImplementation(() => new Promise(() => {}));
    try {
      const view = await renderUnlocked();
      await act(async () => session.markShareInterrupted(routeParams.id!));
      await waitFor(() => expect(view.getByText(LEAD)).toBeOnTheScreen());
      const older = session.shareInterrupted;

      await confirmShare(view);
      await act(async () => session.lock());

      expect(session.shareInterrupted).toEqual({ documentId: routeParams.id });
      expect(session.shareInterrupted).not.toBe(older);
    } finally {
      share.mockImplementation(async () => {});
    }
  });

  it('opens the warning again from the banner’s Share again', async () => {
    const view = await renderUnlocked();
    await act(async () => session.markShareInterrupted(routeParams.id!));
    await waitFor(() => expect(view.getByText(LEAD)).toBeOnTheScreen());

    await pressAndSettle(view.getByRole('button', { name: 'Share again' }));

    expect(view.queryByText(LEAD)).toBeNull();
    expect(session.shareInterrupted).toBeNull();
    expect(view.getByText('Share a decrypted copy?')).toBeOnTheScreen();
  });

  it('shows the banner only on the viewer of the document whose share was cut short', async () => {
    const view = await renderUnlocked();

    await act(async () => session.markShareInterrupted('another-document'));

    expect(view.queryByText(LEAD)).toBeNull();
  });

  it('removes a copy prepared after the vault locked and never opens the share sheet', async () => {
    const discard = jest.fn();
    jest.spyOn(documentService, 'prepareShareFile').mockImplementation(async () => {
      session.lock();
      return { uri: 'file:///mock/cache/share/Passport.jpg', discard, expireAfter: jest.fn() };
    });
    const clearCache = jest.spyOn(documentService, 'clearCache');
    const view = await renderUnlocked();

    await confirmShare(view);

    expect(view.getByText('locked')).toBeOnTheScreen();
    expect(share).not.toHaveBeenCalled();
    expect(discard).toHaveBeenCalledTimes(1);
    // The lock sweep may have run before the copy existed, so it runs again.
    expect(clearCache).toHaveBeenCalled();
    expect(session.shareInterrupted).toEqual({ documentId: routeParams.id });
    expect(session.notice).toBeNull();
  });

  it('locks after the return when Android blocked the chooser, and drops the copy', async () => {
    // The Android pause: the chooser is its own activity, so it ends on return.
    jest
      .spyOn(SessionModule, 'sharePause')
      .mockReturnValue({ maxAwayMs: 120_000, endsOnReturn: true });
    try {
      const discard = jest.fn();
      jest.spyOn(documentService, 'prepareShareFile').mockResolvedValue({
        uri: 'file:///mock/cache/share/Passport.jpg',
        discard,
        expireAfter: jest.fn(),
      });
      // "Background activity launch blocked": the share never settles.
      share.mockImplementation(() => new Promise(() => {}));
      const view = await renderUnlocked();
      await act(async () => {
        await session.updateSettings({ autoLockSeconds: 0 });
      });

      await confirmShare(view);
      await moveTo('background');
      await moveTo('active');
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, AUTO_LOCK_RETURN_GRACE_MS + 100));
      });

      expect(view.getByText('locked')).toBeOnTheScreen();
      expect(discard).toHaveBeenCalledTimes(1);
      expect(session.shareInterrupted).toEqual({ documentId: routeParams.id });
      expect(session.notice).toBeNull();
    } finally {
      share.mockImplementation(async () => {});
    }
  });
});
