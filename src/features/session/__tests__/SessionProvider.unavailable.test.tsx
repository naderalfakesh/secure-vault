import { act, fireEvent, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AppState, type AppStateStatus } from 'react-native';

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

describe('SessionProvider vault unavailable', () => {
  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('never sends a vault whose key cannot be read to setup', async () => {
    await seedLockedVault();
    jest.spyOn(vault, 'hasVault').mockRejectedValue(keyReadFailure());
    const createVault = jest.spyOn(vault, 'createVault');

    const view = await renderUnavailableProbe();

    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unavailable'));
    expect(createVault).not.toHaveBeenCalled();
  });

  it('is unavailable when the key read fails on a fresh install too', async () => {
    jest.spyOn(vault, 'hasVault').mockRejectedValue(keyReadFailure());

    const view = await renderUnavailableProbe();

    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unavailable'));
  });

  it('is unavailable when the PIN record cannot be read next to a key', async () => {
    await seedLockedVault();
    failPinReads();

    const view = await renderUnavailableProbe();

    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unavailable'));
  });

  it('is unavailable when the PIN record cannot be read without a key', async () => {
    failPinReads();

    const view = await renderUnavailableProbe();

    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unavailable'));
  });

  it('opens the lock screen once a transient key failure clears and the user tries again', async () => {
    await seedLockedVault();
    const hasVault = jest.spyOn(vault, 'hasVault').mockRejectedValueOnce(keyReadFailure());

    const view = await renderUnavailableProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unavailable'));

    await fireEvent.press(view.getByText('run retry'));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('locked'));
    expect(hasVault).toHaveBeenCalledTimes(2);
  });

  it('stays unavailable while the read keeps failing, and writes nothing', async () => {
    await seedLockedVault();
    const reads = failPinReads();
    const save = jest.spyOn(SecureStore, 'setItemAsync');
    const createVault = jest.spyOn(vault, 'createVault');
    const put = jest.spyOn(vault, 'put');

    const view = await renderUnavailableProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unavailable'));
    await act(async () => {
      await fireEvent.press(view.getByText('run retry'));
    });

    expect(view.getByTestId('status')).toHaveTextContent('unavailable');
    expect(save).not.toHaveBeenCalledWith(PIN_ENTRY, expect.anything(), expect.anything());
    expect(createVault).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    reads.mockRestore();
  });

  it('tries again once by itself when the app returns to the foreground', async () => {
    await seedLockedVault();
    let onChange: (state: AppStateStatus) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      onChange = listener as (state: AppStateStatus) => void;
      return { remove: () => {} } as ReturnType<typeof AppState.addEventListener>;
    });
    const hasVault = jest.spyOn(vault, 'hasVault').mockRejectedValueOnce(keyReadFailure());

    const view = await renderUnavailableProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unavailable'));

    await act(async () => onChange('background'));
    expect(hasVault).toHaveBeenCalledTimes(1);
    await act(async () => onChange('active'));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('locked'));
    expect(hasVault).toHaveBeenCalledTimes(2);
  });

  it('does not count an unreadable PIN record as a wrong PIN', async () => {
    await seedLockedVault();
    const view = await renderUnavailableProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('locked'));

    const reads = failPinReads();
    await act(async () => {
      await fireEvent.press(view.getByText('run pin ok'));
    });
    await waitFor(() => expect(view.getByTestId('error')).toHaveTextContent(/could not be read/));
    expect(view.getByTestId('failures')).toHaveTextContent('0');
    expect(view.getByTestId('status')).toHaveTextContent('locked');
    reads.mockRestore();
  });
});
