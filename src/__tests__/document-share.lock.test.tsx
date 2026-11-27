import { act, fireEvent, waitFor } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { documentDatabase } from '@/data/database';
import * as SessionModule from '@/features/session/SessionProvider';
import { AUTO_LOCK_RETURN_GRACE_MS } from '@/features/session/SessionProvider';
import { documentService } from '@/services/DocumentService';
import { moveAppStateTo, resetAppState } from '@/testing/appState';
import { renderUnlockedScreen } from '@/testing/renderUnlocked';
import { secureStoreMock } from '@/testing/secureStore';
import type { Session } from '@/testing/session';
import { vaultMock } from '@/testing/vault';
import { DocumentCategory } from '@/types';
import vault from '@modules/expo-vault';

import DocumentDetailScreen from '../../app/documents/[id]';

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
const moveTo = moveAppStateTo;

/** The warning sheet's own close, then the system share sheet. */
const SHEET_CLOSE_MS = 450;
const LEAD = 'SecureVault locked while you were sharing.';

let session: Session;

async function renderUnlocked(size = 2048) {
  const document = await documentService.addDocument(
    { uri: '/tmp/passport.jpg', name: 'passport.jpg', type: 'image/jpeg', size },
    { title: 'Passport', category: DocumentCategory.ID },
  );
  routeParams.id = document.id;
  const view = await renderUnlockedScreen(<DocumentDetailScreen />, {
    onSession: (value) => {
      session = value;
    },
    gestureRoot: true,
  });
  await waitFor(() => expect(view.getByRole('button', { name: 'Share a copy' })).toBeEnabled());
  return view;
}

const pressAndSettle = (element: Parameters<typeof fireEvent.press>[0], ms = 50) =>
  act(async () => {
    void fireEvent.press(element);
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

async function confirmShare(view: Awaited<ReturnType<typeof renderUnlocked>>) {
  await pressAndSettle(view.getByRole('button', { name: 'Share a copy' }));
  await pressAndSettle(view.getByRole('button', { name: 'Share' }), SHEET_CLOSE_MS + 150);
}

describe('Document sharing and the lock gate', () => {
  beforeEach(async () => {
    vaultMock.reset();
    secureStoreMock.__reset();
    await vault.createVault();
    await documentDatabase.close();
    resetAppState();
    share.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
