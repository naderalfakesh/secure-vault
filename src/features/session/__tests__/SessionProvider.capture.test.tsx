import { act, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { moveAppStateTo, resetAppState } from '@/testing/appState';
import { secureStoreMock } from '@/testing/secureStore';
import { unlocked, session } from '@/testing/sessionProvider';
import { vaultMock } from '@/testing/vault';

import { sharePause, type SessionCapture } from '../SessionProvider';

describe('SessionProvider session capture', () => {
  const moveTo = moveAppStateTo;

  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
    resetAppState();
  });

  it('confirms the same unlocked session in the foreground', async () => {
    await unlocked();
    const capture = session.captureSession();
    expect(capture.current()).toBe(true);
    await expect(capture.confirm()).resolves.toBe(true);
  });

  it('never confirms a session that ended, even after the next unlock', async () => {
    await unlocked();
    const capture = session.captureSession();
    await act(async () => {
      session.lock();
    });
    expect(capture.current()).toBe(false);
    await expect(capture.confirm()).resolves.toBe(false);

    await act(async () => {
      await session.unlock();
    });
    expect(session.status).toBe('unlocked');
    expect(capture.current()).toBe(false);
    await expect(capture.confirm()).resolves.toBe(false);
  });

  it('ends the key session when the vault locks, by hand or by auto-lock', async () => {
    await unlocked(0);
    const before = vaultMock.keySessionsEnded();
    await act(async () => {
      session.lock();
    });
    expect(vaultMock.keySessionsEnded()).toBe(before + 1);

    await act(async () => {
      await session.unlock();
    });
    // Unlocking keeps the session that the unlock just authenticated.
    expect(vaultMock.keySessionsEnded()).toBe(before + 1);

    await moveTo('background');
    await moveTo('active');
    await waitFor(() => expect(session.status).toBe('locked'));
    expect(vaultMock.keySessionsEnded()).toBe(before + 2);
  });

  it('waits out a trip to the background and fails when auto-lock locks on return', async () => {
    await unlocked(0);
    const capture = session.captureSession();
    await moveTo('background');
    let outcome: boolean | null = null;
    void capture.confirm().then((value) => {
      outcome = value;
    });
    await act(async () => {});
    expect(outcome).toBeNull();

    await moveTo('active');
    await waitFor(() => expect(outcome).toBe(false));
    expect(session.status).toBe('locked');
  });

  it('waits out a trip to the background and confirms when auto-lock allows the time away', async () => {
    await unlocked(300);
    const capture: SessionCapture = session.captureSession();
    await moveTo('inactive');
    let outcome: boolean | null = null;
    void capture.confirm().then((value) => {
      outcome = value;
    });
    await act(async () => {});
    expect(outcome).toBeNull();

    await moveTo('active');
    await waitFor(() => expect(outcome).toBe(true));
    expect(session.status).toBe('unlocked');
  });
  it('clears only the share-interrupted mark it was given', async () => {
    await unlocked();
    await act(async () => session.markShareInterrupted('doc-1'));
    const older = session.shareInterrupted!;
    await act(async () => session.markShareInterrupted('doc-1'));

    await act(async () => session.clearShareInterrupted(older));
    expect(session.shareInterrupted).toEqual({ documentId: 'doc-1' });

    await act(async () => session.clearShareInterrupted(session.shareInterrupted!));
    expect(session.shareInterrupted).toBeNull();
  });

  it('keeps a share-interrupted mark across the lock until it is cleared or the vault is erased', async () => {
    await unlocked();
    expect(session.shareInterrupted).toBeNull();
    await act(async () => {
      session.markShareInterrupted('doc-1');
      session.lock();
    });
    expect(session.shareInterrupted).toEqual({ documentId: 'doc-1' });
    await act(async () => {
      await session.unlock();
    });
    expect(session.shareInterrupted).toEqual({ documentId: 'doc-1' });

    await act(async () => {
      session.clearShareInterrupted();
    });
    expect(session.shareInterrupted).toBeNull();

    await act(async () => {
      session.markShareInterrupted('doc-2');
    });
    await act(async () => {
      await session.eraseVault();
    });
    expect(session.shareInterrupted).toBeNull();
  });

  it('ends a share pause on return only on Android, and bounds it on both', () => {
    const os = Platform.OS;
    try {
      Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
      expect(sharePause()).toEqual({ maxAwayMs: 120_000, endsOnReturn: true });
      Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
      expect(sharePause()).toEqual({ maxAwayMs: 120_000, endsOnReturn: false });
    } finally {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    }
  });

  it('holds a notice until the vault is unlocked and forgets it when the vault is erased', async () => {
    await unlocked();
    await act(async () => {
      session.postNotice({ message: 'Done' });
    });
    expect(session.notice).toEqual({ message: 'Done' });
    await act(async () => {
      session.dismissNotice();
    });
    expect(session.notice).toBeNull();

    await act(async () => {
      session.postNotice({ message: 'Again' });
    });
    await act(async () => {
      await session.eraseVault();
    });
    expect(session.notice).toBeNull();
  });

  it('retries a refused PIN record delete once during an erase', async () => {
    await unlocked();
    const remove = SecureStore.deleteItemAsync;
    let refusals = 1;
    const deleteItem = jest.spyOn(SecureStore, 'deleteItemAsync').mockImplementation((key) => {
      if (key === 'securevault.pin' && refusals > 0) {
        refusals -= 1;
        return Promise.reject(new Error('errSecInteractionNotAllowed'));
      }
      return remove(key);
    });

    let cleared: boolean | undefined;
    await act(async () => {
      cleared = await session.eraseVault();
    });

    expect(cleared).toBe(true);
    expect(deleteItem.mock.calls.filter(([key]) => key === 'securevault.pin')).toHaveLength(2);
    expect(await SecureStore.getItemAsync('securevault.pin')).toBeNull();
    expect(session.status).toBe('setup');
    deleteItem.mockRestore();
  });

  it('still erases but says so when the PIN record cannot be deleted twice', async () => {
    await unlocked();
    const remove = SecureStore.deleteItemAsync;
    const deleteItem = jest
      .spyOn(SecureStore, 'deleteItemAsync')
      .mockImplementation((key) =>
        key === 'securevault.pin'
          ? Promise.reject(new Error('errSecInteractionNotAllowed'))
          : remove(key),
      );

    let cleared: boolean | undefined;
    await act(async () => {
      cleared = await session.eraseVault();
    });

    expect(cleared).toBe(false);
    expect(session.status).toBe('setup');
    deleteItem.mockRestore();
  });
});
