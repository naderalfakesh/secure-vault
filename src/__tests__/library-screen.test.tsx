import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { AccessibilityInfo, Text } from 'react-native';

import { documentDatabase } from '@/data/database';
import { settle } from '@/testing/async';
import { renderUnlockedScreen } from '@/testing/renderUnlocked';
import { secureStoreMock } from '@/testing/secureStore';
import type { Session } from '@/testing/session';
import { vaultMock } from '@/testing/vault';
import vault from '@modules/expo-vault';

import LibraryScreen from '../../app/(tabs)/index';
import { useTabBarHidden } from '../features/navigation/tabBarVisibility';
import { documentService } from '../services/DocumentService';
import { DocumentCategory } from '../types';
import { isolate } from '../utils/bidi';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

let session: Session;

const CLOSED =
  'The document index could not be found, so it stays closed. Nothing was changed. Try again.';

function TabBarProbe() {
  return <Text testID="tab-bar">{useTabBarHidden() ? 'hidden' : 'shown'}</Text>;
}

async function renderLibrary() {
  const view = await renderUnlockedScreen(<LibraryScreen />, {
    onSession: (value) => {
      session = value;
    },
    beside: <TabBarProbe />,
  });
  return view;
}

async function add(title: string, category: DocumentCategory, ocrText?: string) {
  return documentService.addDocument(
    { uri: `/tmp/${title}.jpg`, name: `${title}.jpg`, type: 'image/jpeg', size: 2048 },
    { title, category, ocrText },
  );
}

describe('Library', () => {
  beforeEach(async () => {
    vaultMock.reset();
    secureStoreMock.__reset();
    // Tests seed documents before setup: the device key that encrypts them comes first,
    // or the launch finds entries without a key and offers only Delete everything.
    await vault.createVault();
    await documentDatabase.close();
    (router.push as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows only the empty state in an empty vault', async () => {
    const view = await renderLibrary();

    await waitFor(() => expect(view.getByText('Your vault is empty')).toBeOnTheScreen());
    expect(view.queryByLabelText('Search documents')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Scan a document' }));
    expect(router.push).toHaveBeenCalledWith('/documents/add');
    expect(view.getByRole('button', { name: 'Import from Files or Photos' })).toBeOnTheScreen();
  });

  it('shows the load error, not an empty vault, while the index stays closed', async () => {
    jest
      .spyOn(documentService, 'initialize')
      .mockRejectedValue(Object.assign(new Error(CLOSED), { code: 'DATABASE_NAME_UNREADABLE' }));

    const view = await renderLibrary();

    await waitFor(() => expect(view.getByText('Couldn’t load your documents')).toBeOnTheScreen());
    expect(
      view.getByText(
        'Your documents weren’t changed. Try again. If this keeps happening, close and reopen SecureVault.',
      ),
    ).toBeOnTheScreen();
    expect(view.getByText(CLOSED)).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
    expect(view.queryByText('Your vault is empty')).toBeNull();
    expect(view.queryByText(/encrypted on this device/)).toBeNull();
  });

  it('treats an index closed by Delete everything as an empty vault', async () => {
    jest
      .spyOn(documentService, 'initialize')
      .mockRejectedValue(Object.assign(new Error('emptied'), { code: 'VAULT_EMPTIED' }));

    const view = await renderLibrary();

    await waitFor(() => expect(view.getByText('Your vault is empty')).toBeOnTheScreen());
    expect(view.queryByText('Couldn’t load your documents')).toBeNull();
  });

  it('lists the five most recent and only the collections that hold documents', async () => {
    for (let index = 1; index <= 6; index += 1) {
      await add(`Receipt ${index}`, DocumentCategory.RECEIPTS);
    }
    await add('Lease agreement', DocumentCategory.LEGAL);

    const view = await renderLibrary();

    await waitFor(() =>
      expect(view.getByText('7 documents, encrypted on this device')).toBeOnTheScreen(),
    );
    expect(view.getAllByTestId(/^document-row-/)).toHaveLength(5);
    expect(view.getByTestId('collection-receipts')).toBeOnTheScreen();
    expect(view.getByTestId('collection-legal')).toBeOnTheScreen();
    expect(view.queryByTestId('collection-medical')).toBeNull();

    await fireEvent.press(view.getByTestId('collection-legal'));
    expect(view.getByText('1 document in Legal')).toBeOnTheScreen();
    expect(view.getAllByTestId(/^document-row-/)).toHaveLength(1);
  });

  it('searches the text read from the pages and explains an empty result', async () => {
    await add('Lease agreement', DocumentCategory.LEGAL, 'The lease term begins on 1 March 2026');
    await add('Passport', DocumentCategory.ID);
    const view = await renderLibrary();
    await waitFor(() => expect(view.getByLabelText('Search documents')).toBeOnTheScreen());

    await fireEvent.changeText(view.getByLabelText('Search documents'), 'march');
    await settle(250);
    expect(view.getByText('1 result')).toBeOnTheScreen();
    expect(view.getByTestId('snippet-match')).toHaveTextContent('March');

    await fireEvent.press(view.getByRole('button', { name: 'ID & Personal' }));
    // The query is the reader's own text, isolated so its direction can't reorder the sentence.
    expect(
      view.getByText(`No matches for “${isolate('march')}” in ID & Personal`),
    ).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Search all collections' }));
    expect(view.getByText('1 result')).toBeOnTheScreen();
  });

  it('highlights every word the index matched, with diacritics folded', async () => {
    await add('Visa', DocumentCategory.ID, 'Entrée permise jusqu’au 3 janvier 2027');
    const view = await renderLibrary();
    await waitFor(() => expect(view.getByLabelText('Search documents')).toBeOnTheScreen());

    await fireEvent.changeText(view.getByLabelText('Search documents'), 'entree janv');
    await settle(250);

    expect(view.getByText('1 result')).toBeOnTheScreen();
    expect(view.getAllByTestId('snippet-match').map((part) => part.props.children)).toEqual([
      'Entrée',
      'janvier',
    ]);
  });

  it('shows no snippet line when only the title matched', async () => {
    await add('March rent receipt', DocumentCategory.RECEIPTS, 'Paid in full');
    const view = await renderLibrary();
    await waitFor(() => expect(view.getByLabelText('Search documents')).toBeOnTheScreen());

    await fireEvent.changeText(view.getByLabelText('Search documents'), 'march');
    await settle(250);

    expect(view.getByText('1 result')).toBeOnTheScreen();
    expect(view.queryByTestId('snippet-match')).toBeNull();
  });

  it('sorts by expiry date from the index, undated documents last', async () => {
    const lease = await add('Lease agreement', DocumentCategory.LEGAL);
    const passport = await add('Passport', DocumentCategory.ID);
    const visa = await add('Visa', DocumentCategory.ID);
    await documentService.setFields(passport.id, [
      { key: 'expires', value: '2031-01-03', kind: 'date' },
    ]);
    await documentService.setFields(visa.id, [
      { key: 'expires', value: '2030-06-01', kind: 'date' },
    ]);
    const list = jest.spyOn(documentService, 'listDocuments');
    const view = await renderLibrary();
    await waitFor(() => expect(view.getByRole('button', { name: 'See all' })).toBeOnTheScreen());

    await fireEvent.press(view.getByRole('button', { name: 'See all' }));
    await fireEvent.press(view.getByRole('button', { name: /^Sort and filter/ }));
    await fireEvent.press(view.getByRole('radio', { name: 'Expiry date, soonest' }));
    await settle(250);

    expect(list).toHaveBeenCalledWith('expiry');
    expect(view.getAllByTestId(/^document-row-/).map((row) => row.props.testID)).toEqual([
      `document-row-${visa.id}`,
      `document-row-${passport.id}`,
      `document-row-${lease.id}`,
    ]);
    list.mockRestore();
  });

  it('moves selected documents to another collection and hides the tab bar meanwhile', async () => {
    const lease = await add('Lease agreement', DocumentCategory.OTHER);
    await add('Passport', DocumentCategory.ID);
    const view = await renderLibrary();
    await waitFor(() => expect(view.getByRole('button', { name: 'Select' })).toBeOnTheScreen());

    await fireEvent.press(view.getByRole('button', { name: 'Select' }));
    expect(view.getByTestId('tab-bar')).toHaveTextContent('hidden');
    await fireEvent.press(view.getByTestId(`document-row-${lease.id}`));
    expect(view.getByText('1 selected')).toBeOnTheScreen();
    // Share is single-document only, so it is absent here.
    expect(view.queryByRole('button', { name: /Share/ })).toBeNull();

    await fireEvent.press(view.getByRole('button', { name: 'Move to…' }));
    await act(async () => {
      await fireEvent.press(view.getByRole('button', { name: 'Legal' }));
    });

    await waitFor(() => expect(view.getByText('Moved 1 document to Legal')).toBeOnTheScreen());
    expect((await documentService.getDocument(lease.id))?.category).toBe(DocumentCategory.LEGAL);
    expect(view.getByTestId('tab-bar')).toHaveTextContent('shown');
  });

  it('shows a plain disabled Delete, with no count, while nothing is selected', async () => {
    await add('Lease agreement', DocumentCategory.LEGAL);
    const view = await renderLibrary();
    await waitFor(() => expect(view.getByRole('button', { name: 'Select' })).toBeOnTheScreen());

    await fireEvent.press(view.getByRole('button', { name: 'Select' }));

    expect(view.queryByText('Delete 0')).toBeNull();
    expect(view.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  it('deletes several documents at once and brings them all back with Undo', async () => {
    const lease = await add('Lease agreement', DocumentCategory.LEGAL);
    const passport = await add('Passport', DocumentCategory.ID);
    await add('Receipt', DocumentCategory.RECEIPTS);
    const view = await renderLibrary();
    await waitFor(() => expect(view.getByRole('button', { name: 'Select' })).toBeOnTheScreen());

    await fireEvent(view.getByTestId(`document-row-${lease.id}`), 'longPress');
    await fireEvent.press(view.getByTestId(`document-row-${passport.id}`));
    expect(view.getByText('2 selected')).toBeOnTheScreen();
    await act(async () => {
      await fireEvent.press(view.getByRole('button', { name: 'Delete 2 documents' }));
    });

    await waitFor(() => expect(view.getByText('2 documents deleted')).toBeOnTheScreen());
    expect(await documentService.getDocument(lease.id)).toBeNull();
    expect(view.getByTestId('toast-countdown', { includeHiddenElements: true })).toBeTruthy();

    await act(async () => {
      await fireEvent.press(view.getByRole('button', { name: 'Undo' }));
    });
    await waitFor(() => expect(view.getByText('2 documents are back')).toBeOnTheScreen());
    expect((await documentService.getDocument(lease.id))?.title).toBe('Lease agreement');
    expect((await documentService.getDocument(passport.id))?.title).toBe('Passport');
  });

  it('stops deleting when the vault locks and reports it after the next unlock', async () => {
    const docs = [];
    for (let index = 1; index <= 4; index += 1) {
      docs.push(await add(`Receipt ${index}`, DocumentCategory.RECEIPTS));
    }
    const view = await renderLibrary();
    await waitFor(() => expect(view.getByRole('button', { name: 'Select' })).toBeOnTheScreen());
    await fireEvent.press(view.getByRole('button', { name: 'Select' }));
    await fireEvent.press(view.getByRole('button', { name: 'Select all' }));
    const realDelete = documentService.deleteDocumentWithUndo.bind(documentService);
    const remove = jest
      .spyOn(documentService, 'deleteDocumentWithUndo')
      .mockImplementation(async (id) => {
        const result = await realDelete(id);
        // The vault locks (auto-lock: Immediately) while the first one is deleted.
        if (remove.mock.calls.length === 1) session.lock();
        return result;
      });
    const clearCache = jest.spyOn(documentService, 'clearCache');

    await act(async () => {
      await fireEvent.press(view.getByRole('button', { name: 'Delete 4 documents' }));
    });

    expect(view.getByText('locked')).toBeOnTheScreen();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(clearCache).toHaveBeenCalled();
    expect(view.queryByText(/documents deleted|deleted$/)).toBeNull();
    expect(view.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(session.notice?.message).toBe(
      'The vault locked while deleting. 1 document was deleted and can’t be brought back. The others are still in your vault.',
    );
  });

  it('keeps a document listed and says so when its encrypted file cannot be removed', async () => {
    const lease = await add('Lease agreement', DocumentCategory.LEGAL);
    const view = await renderLibrary();
    await waitFor(() => expect(view.getByRole('button', { name: 'Select' })).toBeOnTheScreen());
    const real = vault.deleteFile.bind(vault);
    jest.spyOn(vault, 'deleteFile').mockImplementation(async (key) => {
      if (key === lease.fileKey) throw new Error('disk busy');
      return real(key);
    });

    await fireEvent(view.getByTestId(`document-row-${lease.id}`), 'longPress');
    await act(async () => {
      await fireEvent.press(view.getByRole('button', { name: 'Delete 1 document' }));
    });

    await waitFor(() =>
      expect(
        view.getByText(/^Couldn’t delete .*Lease agreement.*\. It’s still in your vault\.$/),
      ).toBeOnTheScreen(),
    );
    expect(await documentService.getDocument(lease.id)).not.toBeNull();
    expect(view.getByTestId(`document-row-${lease.id}`)).toBeOnTheScreen();
    expect(view.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('announces the selection count on iOS too', async () => {
    const lease = await add('Lease agreement', DocumentCategory.LEGAL);
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const view = await renderLibrary();
    await waitFor(() => expect(view.getByRole('button', { name: 'Select' })).toBeOnTheScreen());

    await fireEvent.press(view.getByRole('button', { name: 'Select' }));
    await fireEvent.press(view.getByTestId(`document-row-${lease.id}`));

    expect(announce).toHaveBeenCalledWith('1 selected');
  });
});
