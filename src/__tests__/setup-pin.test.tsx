import { act, render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import { documentDatabase } from '@/data/database';
import { secureStoreMock } from '@/testing/secureStore';
import { useSessionValue, type Session } from '@/testing/session';
import { vaultMock } from '@/testing/vault';
import vault from '@modules/expo-vault';

import SetupPinScreen from '../../app/setup/pin';
import { SessionProvider } from '../features/session/SessionProvider';
import { documentService } from '../services/DocumentService';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

const KEPT = 'Your documents stay where they are. The PIN is a second way in.';
const EMPTY = 'Your vault is empty. The PIN is your fallback when biometrics are unavailable.';

let session: Session;

function Gate() {
  const value = useSessionValue();
  useEffect(() => {
    session = value;
  });
  return value.status === 'setup' ? <SetupPinScreen /> : null;
}

const renderSetup = () =>
  render(
    <SessionProvider>
      <Gate />
    </SessionProvider>,
  );

describe('PIN setup copy', () => {
  beforeEach(async () => {
    vaultMock.reset();
    secureStoreMock.__reset();
    await documentDatabase.close();
    documentDatabase.allow();
  });

  it('says the documents stay when a vault with entries gets a PIN', async () => {
    await vault.createVault();
    await vault.put('file_legacy', 'ciphertext');

    const view = await renderSetup();

    await waitFor(() => expect(view.getByText(KEPT)).toBeOnTheScreen());
    expect(view.getByText('Add a PIN to your vault')).toBeOnTheScreen();
  });

  it('does not promise documents after "Delete everything" emptied the vault', async () => {
    await vault.createVault();
    await vault.put('file_old', 'ciphertext');
    const view = await renderSetup();
    await waitFor(() => expect(view.getByText(KEPT)).toBeOnTheScreen());
    await act(async () => {
      await session.setUp('123456');
    });

    await act(async () => {
      await documentService.eraseEverything();
      await session.eraseVault();
    });

    await waitFor(() => expect(view.getByText(EMPTY)).toBeOnTheScreen());
    expect(view.queryByText(KEPT)).toBeNull();
    expect(view.getByText('Choose a 6-digit PIN')).toBeOnTheScreen();
  });

  it('keeps the standard copy when the vault listing fails at launch', async () => {
    await vault.createVault();
    await vault.put('file_legacy', 'ciphertext');
    const listing = jest.spyOn(vault, 'getAllKeys').mockRejectedValue(new Error('listing failed'));

    const view = await renderSetup();

    await waitFor(() => expect(view.getByText(KEPT)).toBeOnTheScreen());
    expect(view.queryByText(EMPTY)).toBeNull();
    expect(session.vaultEmpty).toBe(false);
    listing.mockRestore();
  });

  it('does not promise documents after a relaunch into setup with an emptied vault', async () => {
    await vault.createVault();

    const view = await renderSetup();

    await waitFor(() => expect(view.getByText(EMPTY)).toBeOnTheScreen());
    expect(view.queryByText(KEPT)).toBeNull();
  });
});
