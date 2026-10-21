import { render, waitFor } from '@testing-library/react-native';

import { closeDocumentStore } from '@/data/database';

import HomeScreen from '../../app/(tabs)/index';
import vault from '../../modules/expo-vault';
import { documentService } from '../services/DocumentService';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

const vaultMock = vault as unknown as { reset(): void };
const CLOSED =
  'The document index could not be found, so it stays closed. Nothing was changed. Try again.';

describe('Home screen', () => {
  beforeEach(async () => {
    vaultMock.reset();
    await closeDocumentStore();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('invites the first scan in an empty vault', async () => {
    const view = await render(<HomeScreen />);

    await waitFor(() => expect(view.getByText('Scan your first document')).toBeOnTheScreen());
  });

  it('shows the same error state as the Documents tab while the index stays closed', async () => {
    jest
      .spyOn(documentService, 'initialize')
      .mockRejectedValue(Object.assign(new Error(CLOSED), { code: 'DATABASE_NAME_UNREADABLE' }));

    const view = await render(<HomeScreen />);

    await waitFor(() => expect(view.getByText('Could not open the vault')).toBeOnTheScreen());
    expect(view.getByText(CLOSED)).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
    expect(view.queryByText('Scan your first document')).toBeNull();
    expect(view.queryByText(/0 documents/)).toBeNull();
  });
});
