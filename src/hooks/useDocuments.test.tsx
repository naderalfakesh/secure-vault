import { act, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { allowDocumentStore, closeDocumentStore } from '@/data/database';
import { openTestDatabase } from '@/data/testing/betterSqlite';

import vault from '../../modules/expo-vault';
import { documentService } from '../services/DocumentService';
import { useDocuments } from './useDocuments';

jest.mock('@/data/testing/betterSqlite', () => {
  const actual = jest.requireActual('@/data/testing/betterSqlite');
  return { openTestDatabase: jest.fn(actual.openTestDatabase) };
});

const vaultMock = vault as unknown as { reset(): void };
const opens = openTestDatabase as jest.Mock;
const picked = { uri: '/tmp/passport.jpg', name: 'passport.jpg', type: 'image/jpeg', size: 2048 };

function Home() {
  const { documents, error, loading } = useDocuments();
  return (
    <>
      <Text testID="count">{loading ? 'loading' : String(documents.length)}</Text>
      <Text testID="error">{error ?? ''}</Text>
    </>
  );
}

describe('useDocuments', () => {
  beforeEach(async () => {
    vaultMock.reset();
    await closeDocumentStore();
    allowDocumentStore();
  });

  it('empties the list after "Delete everything" without opening the index again', async () => {
    await documentService.addDocument(picked, { title: 'Passport' });
    const view = await render(<Home />);
    await waitFor(() => expect(view.getByTestId('count')).toHaveTextContent('1'));
    opens.mockClear();

    await act(async () => {
      await documentService.eraseEverything();
    });

    await waitFor(() => expect(view.getByTestId('count')).toHaveTextContent('0'));
    expect(view.getByTestId('error')).toHaveTextContent('');
    expect(opens).not.toHaveBeenCalled();
    await expect(documentService.initialize()).rejects.toMatchObject({ code: 'VAULT_EMPTIED' });
  });
});
