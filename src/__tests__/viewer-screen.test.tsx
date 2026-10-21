import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { AppState, type AppStateStatus, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { closeDocumentStore } from '@/data/database';

import DocumentViewerScreen from '../../app/documents/[id]';
import vault from '../../modules/expo-vault';
import { ToastProvider } from '../components/ui';
import { SessionProvider, useSession } from '../features/session/SessionProvider';
import { documentService } from '../services/DocumentService';
import { DocumentCategory } from '../types';

jest.mock('expo-router', () => {
  const params: { id?: string } = {};
  return {
    __params: params,
    router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true },
    useLocalSearchParams: () => params,
    Stack: { Screen: () => null },
  };
});

const routeParams = (jest.requireMock('expo-router') as { __params: { id?: string } }).__params;
const secureStoreMock = SecureStore as unknown as { __reset(): void };
const vaultMock = vault as unknown as { reset(): void };
const appState = AppState as unknown as {
  currentState: AppStateStatus;
  addEventListener: jest.Mock;
};
const listeners = new Set<(state: AppStateStatus) => void>();

let session: ReturnType<typeof useSession>;

function Gate() {
  const value = useSession();
  useEffect(() => {
    session = value;
  });
  return value.status === 'unlocked' ? <DocumentViewerScreen /> : <Text>{value.status}</Text>;
}

async function renderViewer(id: string) {
  routeParams.id = id;
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
    await session.updateSettings({ autoLockSeconds: -1 });
  });
  return view;
}

async function addPassport(ocrText?: string) {
  const document = await documentService.addDocument(
    { uri: '/tmp/passport.jpg', name: 'passport.jpg', type: 'image/jpeg', size: 2048 },
    { title: 'Passport', category: DocumentCategory.ID, ocrText },
  );
  await documentService.setFields(document.id, [
    { key: 'number', value: 'X12344821', kind: 'text' },
    { key: 'expires', value: '2099-01-03', kind: 'date' },
  ]);
  return document;
}

describe('Document viewer', () => {
  beforeEach(async () => {
    vaultMock.reset();
    secureStoreMock.__reset();
    await closeDocumentStore();
    listeners.clear();
    appState.currentState = 'active';
    appState.addEventListener.mockImplementation((_event, listener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    });
    (router.back as jest.Mock).mockClear();
  });

  afterEach(() => jest.restoreAllMocks());

  it('says plainly when the document is no longer in the vault', async () => {
    const view = await renderViewer('gone');

    await waitFor(() =>
      expect(view.getByText('This document is no longer in the vault.')).toBeOnTheScreen(),
    );
    expect(view.getByText('A restore may have replaced it.')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Go to Library' }));
    expect(router.back).toHaveBeenCalled();
  });

  it('calls an unreadable document damaged, not missing', async () => {
    const document = await addPassport();
    jest.spyOn(documentService, 'getDocumentPages').mockRejectedValue(new Error('bad tag'));

    const view = await renderViewer(document.id);

    await waitFor(() =>
      expect(view.getByText('This document couldn’t be opened.')).toBeOnTheScreen(),
    );
    expect(view.getByText('It may be damaged.')).toBeOnTheScreen();
    expect(view.queryByText(/bad tag/)).toBeNull();
  });

  it('shows the title, the page line and glass controls on the stage', async () => {
    const document = await addPassport('Passport text');
    const view = await renderViewer(document.id);

    await waitFor(() => expect(view.getByText('Page 1 of 1')).toBeOnTheScreen());
    expect(view.getByRole('button', { name: 'Back to Library' })).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'More actions' })).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Share a copy' })).toBeEnabled();
  });

  it('masks the number in the details until Show, and again when the app leaves', async () => {
    const document = await addPassport('Passport text');
    const view = await renderViewer(document.id);
    await waitFor(() => expect(view.getByRole('button', { name: 'Details' })).toBeOnTheScreen());

    await fireEvent.press(view.getByRole('button', { name: 'Details' }));
    expect(view.getByText('•••• 4821')).toBeOnTheScreen();
    expect(view.getByText(/^Expires .*2099$/)).toBeOnTheScreen();
    expect(view.getByText(/Encrypted on this device$/)).toBeOnTheScreen();

    await fireEvent.press(view.getByRole('button', { name: 'Show document number' }));
    expect(view.getByText('X12344821')).toBeOnTheScreen();

    await act(async () => {
      for (const listener of [...listeners]) listener('background');
    });
    expect(view.queryByText('X12344821')).toBeNull();
    expect(view.getByText('•••• 4821')).toBeOnTheScreen();
  });

  it('offers Read again when no text was found', async () => {
    const document = await addPassport();
    const view = await renderViewer(document.id);
    await waitFor(() => expect(view.getByRole('button', { name: 'Details' })).toBeOnTheScreen());

    await fireEvent.press(view.getByRole('button', { name: 'Details' }));

    expect(
      view.getByLabelText(
        'No readable text was found, so this document isn’t searchable by its contents yet.',
      ),
    ).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Read again' })).toBeOnTheScreen();
    expect(view.queryByText('Text read from the pages')).toBeNull();
  });

  it('asks for a title inline instead of saving an empty one', async () => {
    const document = await addPassport('Passport text');
    const update = jest.spyOn(documentService, 'updateDocument');
    const view = await renderViewer(document.id);
    await waitFor(() => expect(view.getByRole('button', { name: 'Details' })).toBeOnTheScreen());

    await fireEvent.press(view.getByRole('button', { name: 'Details' }));
    await fireEvent.press(view.getByRole('button', { name: 'Edit' }));
    await fireEvent.changeText(view.getByLabelText('Title'), '   ');
    await fireEvent.press(view.getByRole('button', { name: 'Save' }));

    expect(view.getByText('Give the document a title.')).toBeOnTheScreen();
    expect(update).not.toHaveBeenCalled();

    await fireEvent.changeText(view.getByLabelText('Title'), 'Old passport');
    await act(async () => {
      await fireEvent.press(view.getByRole('button', { name: 'Save' }));
    });
    await waitFor(() => expect(view.getByText('Details updated')).toBeOnTheScreen());
    expect((await documentService.getDocument(document.id))?.title).toBe('Old passport');
  });

  it('deletes from the details without a confirmation and offers Undo', async () => {
    const document = await addPassport('Passport text');
    const view = await renderViewer(document.id);
    await waitFor(() => expect(view.getByRole('button', { name: 'Details' })).toBeOnTheScreen());

    await fireEvent.press(view.getByRole('button', { name: 'Details' }));
    await act(async () => {
      await fireEvent.press(view.getByRole('button', { name: 'Delete' }));
    });

    await waitFor(() => expect(view.getByText(/Passport.* deleted$/)).toBeOnTheScreen());
    expect(router.back).toHaveBeenCalled();
    expect(await documentService.getDocument(document.id)).toBeNull();
    await act(async () => {
      await fireEvent.press(view.getByRole('button', { name: 'Undo' }));
    });
    await waitFor(() => expect(view.getByText(/Passport.* is back$/)).toBeOnTheScreen());
    expect(await documentService.getDocument(document.id)).not.toBeNull();
  });

  it('keeps the document and says so when the delete fails', async () => {
    const document = await addPassport('Passport text');
    jest.spyOn(documentService, 'deleteDocumentWithUndo').mockRejectedValue(new Error('io'));
    const view = await renderViewer(document.id);
    await waitFor(() => expect(view.getByRole('button', { name: 'Details' })).toBeOnTheScreen());

    await fireEvent.press(view.getByRole('button', { name: 'Details' }));
    await act(async () => {
      await fireEvent.press(view.getByRole('button', { name: 'Delete' }));
    });

    await waitFor(() =>
      expect(
        view.getByText(/^Couldn’t delete .*Passport.*\. It’s still in your vault\.$/),
      ).toBeOnTheScreen(),
    );
    expect(router.back).not.toHaveBeenCalled();
  });

  it('reports a delete that the lock interrupted after the next unlock, without Undo', async () => {
    const document = await addPassport('Passport text');
    const realDelete = documentService.deleteDocumentWithUndo.bind(documentService);
    jest.spyOn(documentService, 'deleteDocumentWithUndo').mockImplementation(async (id) => {
      const result = await realDelete(id);
      session.lock();
      return result;
    });
    const clearCache = jest.spyOn(documentService, 'clearCache');
    const view = await renderViewer(document.id);
    await waitFor(() => expect(view.getByRole('button', { name: 'Details' })).toBeOnTheScreen());

    await fireEvent.press(view.getByRole('button', { name: 'Details' }));
    await act(async () => {
      await fireEvent.press(view.getByRole('button', { name: 'Delete' }));
    });

    expect(view.getByText('locked')).toBeOnTheScreen();
    expect(clearCache).toHaveBeenCalled();
    expect(view.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(session.notice?.message).toBe(
      'The vault locked while deleting. 1 document was deleted and can’t be brought back.',
    );
  });
});
