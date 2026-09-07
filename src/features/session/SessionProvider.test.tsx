import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { hashPasscode } from '../auth/passcode';
import * as SecureStore from 'expo-secure-store';
import vault from '../../../modules/expo-vault';
import { SessionProvider, useSession } from './SessionProvider';

const secureStoreMock = SecureStore as unknown as { __reset(): void };
const vaultMock = vault as unknown as {
  reset(): void;
  unlockWithBiometrics: () => Promise<boolean>;
};

function Probe() {
  const session = useSession();
  return (
    <>
      <Text testID="status">{session.status}</Text>
      <Text testID="error">{session.error ?? ''}</Text>
      <Text testID="failures">{String(session.lockout.failures)}</Text>
      <Text testID="autolock">{String(session.settings.autoLockSeconds)}</Text>
      <Text onPress={() => void session.setUp('123456')}>run setup</Text>
      <Text onPress={() => void session.unlock()}>run unlock</Text>
      <Text onPress={() => void session.unlockWithPin('123456')}>run pin ok</Text>
      <Text onPress={() => void session.unlockWithPin('000000')}>run pin bad</Text>
      <Text onPress={() => void session.updateSettings({ autoLockSeconds: 900 })}>
        run settings
      </Text>
      <Text onPress={session.lock}>run lock</Text>
    </>
  );
}

function renderProbe() {
  return render(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
  );
}

describe('SessionProvider', () => {
  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
  });

  it('starts in setup when no vault exists, unlocks after PIN setup, and locks on demand', async () => {
    const view = await renderProbe();

    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
    await fireEvent.press(view.getByText('run setup'));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unlocked'));

    await fireEvent.press(view.getByText('run lock'));
    expect(view.getByTestId('status')).toHaveTextContent('locked');
  });

  it('unlocks with the right PIN and counts failures for the wrong one', async () => {
    const setup = await renderProbe();
    await waitFor(() => expect(setup.getByTestId('status')).toHaveTextContent('setup'));
    await fireEvent.press(setup.getByText('run setup'));
    await waitFor(() => expect(setup.getByTestId('status')).toHaveTextContent('unlocked'));
    await fireEvent.press(setup.getByText('run lock'));

    await fireEvent.press(setup.getByText('run pin bad'));
    await waitFor(() => expect(setup.getByTestId('failures')).toHaveTextContent('1'));
    expect(setup.getByTestId('status')).toHaveTextContent('locked');

    await fireEvent.press(setup.getByText('run pin ok'));
    await waitFor(() => expect(setup.getByTestId('status')).toHaveTextContent('unlocked'));
    expect(setup.getByTestId('failures')).toHaveTextContent('0');
  });

  it('persists settings across unlocks', async () => {
    const view = await renderProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
    await fireEvent.press(view.getByText('run setup'));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unlocked'));

    await fireEvent.press(view.getByText('run settings'));
    await waitFor(() => expect(view.getByTestId('autolock')).toHaveTextContent('900'));

    await fireEvent.press(view.getByText('run lock'));
    await fireEvent.press(view.getByText('run unlock'));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unlocked'));
    expect(view.getByTestId('autolock')).toHaveTextContent('900');
  });

  it('keeps an existing key when adding a PIN to a vault without one', async () => {
    await vault.createVault();
    await vault.put('file_legacy', 'ciphertext');
    const createVault = jest.spyOn(vault, 'createVault');

    const view = await renderProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
    await fireEvent.press(view.getByText('run setup'));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unlocked'));

    expect(createVault).not.toHaveBeenCalled();
    expect(await vault.get('file_legacy')).toBe('ciphertext');
    createVault.mockRestore();
  });

  it('starts locked when a vault exists and surfaces biometric failures', async () => {
    await vault.createVault();
    await SecureStore.setItemAsync('securevault.pin', hashPasscode('123456', { iterations: 64 }));
    const original = vaultMock.unlockWithBiometrics;
    vaultMock.unlockWithBiometrics = async () => {
      throw new Error('Biometric authentication failed.');
    };

    const view = await renderProbe();
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('locked'));
    await act(async () => {
      await fireEvent.press(view.getByText('run unlock'));
    });
    expect(view.getByTestId('status')).toHaveTextContent('locked');
    expect(view.getByTestId('error')).toHaveTextContent('Biometric authentication failed.');

    vaultMock.unlockWithBiometrics = original;
  });
});
