import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import vault from '../../../modules/expo-vault';
import { SessionProvider, useSession } from './SessionProvider';

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
      <Text onPress={() => void session.setUp()}>run setup</Text>
      <Text onPress={() => void session.unlock()}>run unlock</Text>
      <Text onPress={session.lock}>run lock</Text>
    </>
  );
}

describe('SessionProvider', () => {
  beforeEach(() => {
    vaultMock.reset();
  });

  it('starts in setup when no vault exists and unlocks after setup', async () => {
    const view = await render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('setup'));
    await fireEvent.press(view.getByText('run setup'));
    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('unlocked'));

    await fireEvent.press(view.getByText('run lock'));
    expect(view.getByTestId('status')).toHaveTextContent('locked');
  });

  it('starts locked when a vault exists and surfaces unlock failures', async () => {
    await vault.createVault();
    const original = vaultMock.unlockWithBiometrics;
    vaultMock.unlockWithBiometrics = async () => {
      throw new Error('Biometric authentication failed.');
    };

    const view = await render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    await waitFor(() => expect(view.getByTestId('status')).toHaveTextContent('locked'));
    await act(async () => {
      await fireEvent.press(view.getByText('run unlock'));
    });
    expect(view.getByTestId('status')).toHaveTextContent('locked');
    expect(view.getByTestId('error')).toHaveTextContent('Biometric authentication failed.');

    vaultMock.unlockWithBiometrics = original;
  });
});
