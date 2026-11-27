import { act, fireEvent, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import { secureStoreMock } from '@/testing/secureStore';
import {
  failPinReads,
  keyReadFailure,
  PIN_ENTRY,
  renderUnavailableProbe,
  seedLockedVault,
} from '@/testing/sessionUnavailable';
import { vaultMock } from '@/testing/vault';
import vault from '@modules/expo-vault';

describe('SessionProvider setup re-check', () => {
  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stops setup and shows unavailable when the key read fails right before it', async () => {
    const view = await renderUnavailableProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
    jest.spyOn(vault, 'hasVault').mockRejectedValue(keyReadFailure());
    const createVault = jest.spyOn(vault, 'createVault');

    await fireEvent.press(view.getByText('run setup'));

    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unavailable'));
    expect(createVault).not.toHaveBeenCalled();
    expect(await SecureStore.getItemAsync(PIN_ENTRY)).toBeNull();
  });

  it('stops setup when the PIN record read fails right before it', async () => {
    const view = await renderUnavailableProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
    const reads = failPinReads();
    const createVault = jest.spyOn(vault, 'createVault');

    await fireEvent.press(view.getByText('run setup'));

    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unavailable'));
    expect(createVault).not.toHaveBeenCalled();
    reads.mockRestore();
  });

  it('keeps a key that appeared after launch instead of creating a new one', async () => {
    const view = await renderUnavailableProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
    await vault.createVault();
    await vault.put('file_legacy', 'ciphertext');
    const createVault = jest.spyOn(vault, 'createVault');

    await fireEvent.press(view.getByText('run setup'));

    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unlocked'));
    expect(createVault).not.toHaveBeenCalled();
    expect(await vault.get('file_legacy')).toBe('ciphertext');
  });

  it('goes to the lock screen instead of replacing the PIN of a vault that has one', async () => {
    const view = await renderUnavailableProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
    await seedLockedVault();
    const record = await SecureStore.getItemAsync(PIN_ENTRY);
    const createVault = jest.spyOn(vault, 'createVault');

    await fireEvent.press(view.getByText('run setup'));

    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('locked'));
    expect(createVault).not.toHaveBeenCalled();
    expect(await SecureStore.getItemAsync(PIN_ENTRY)).toBe(record);
  });

  it('replaces a PIN that an erase could not remove once the vault is empty', async () => {
    await seedLockedVault();
    const view = await renderUnavailableProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('locked'));
    await fireEvent.press(view.getByText('run pin ok'));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unlocked'));
    const old = await SecureStore.getItemAsync(PIN_ENTRY);
    for (const key of await vault.getAllKeys()) await vault.delete(key);
    const remove = SecureStore.deleteItemAsync;
    jest
      .spyOn(SecureStore, 'deleteItemAsync')
      .mockImplementation((key) =>
        key === PIN_ENTRY ? Promise.reject(new Error('errSecInteractionNotAllowed')) : remove(key),
      );
    await act(async () => {
      await fireEvent.press(view.getByText('run erase'));
    });
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));

    await fireEvent.press(view.getByText('run setup'));

    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unlocked'));
    expect(await SecureStore.getItemAsync(PIN_ENTRY)).not.toBe(old);
  });

  it('holds setup on its last step until the onboarding finishes', async () => {
    const view = await renderUnavailableProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));

    await fireEvent.press(view.getByText('run held setup'));
    await waitFor(() => expect(view.getByTestId('held')).toHaveTextContent('true'));
    expect(view.getByTestId('status')).toHaveTextContent('setup');
    expect(await SecureStore.getItemAsync(PIN_ENTRY)).not.toBeNull();

    await fireEvent.press(view.getByText('run finish'));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unlocked'));
    expect(view.getByTestId('held')).toHaveTextContent('false');
  });

  it('relaunches to the lock screen when a held setup is killed before it finishes', async () => {
    const first = await renderUnavailableProbe();
    await waitFor(() => expect(first.getByTestId('status')).toHaveTextContent('setup'));
    await fireEvent.press(first.getByText('run held setup'));
    await waitFor(() => expect(first.getByTestId('held')).toHaveTextContent('true'));

    // A kill: the provider goes away without finishSetup; the stores remain.
    await first.unmount();
    const relaunch = await renderUnavailableProbe();

    await waitFor(() => expect(relaunch.getByTestId('status')).toHaveTextContent('locked'));
    expect(relaunch.getByTestId('held')).toHaveTextContent('false');
  });

  it('ignores a finish when no setup is being held', async () => {
    const view = await renderUnavailableProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));

    await fireEvent.press(view.getByText('run finish'));
    await act(async () => {});

    expect(view.getByTestId('status')).toHaveTextContent('setup');
  });
});
