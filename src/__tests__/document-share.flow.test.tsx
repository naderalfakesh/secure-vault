import { act, fireEvent, waitFor } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';

import { documentDatabase } from '@/data/database';
import { documentService } from '@/services/DocumentService';
import { resetAppState } from '@/testing/appState';
import { settle } from '@/testing/async';
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

/** The warning sheet's own close, then the system share sheet. */
const SHEET_CLOSE_MS = 450;

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

/** Viewer Share → warning sheet → Share, then the sheet closes before the system sheet opens. */
async function confirmShare(view: Awaited<ReturnType<typeof renderUnlocked>>) {
  await pressAndSettle(view.getByRole('button', { name: 'Share a copy' }));
  await pressAndSettle(view.getByRole('button', { name: 'Share' }), SHEET_CLOSE_MS + 150);
}

describe('Document sharing flow', () => {
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
    const view = await renderUnlockedScreen(<DocumentDetailScreen />, {
      onSession: (value) => {
        session = value;
      },
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

  it('leaves the size out of the file card when it is not known, never "0 B"', async () => {
    const view = await renderUnlocked(0);

    await pressAndSettle(view.getByRole('button', { name: 'Share a copy' }));

    expect(view.getByLabelText('⁨Passport⁩, 1 page · Image')).toBeOnTheScreen();
    expect(view.queryByText(/0 B/)).toBeNull();
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
});
