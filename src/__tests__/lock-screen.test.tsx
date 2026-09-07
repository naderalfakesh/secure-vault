import { render, waitFor } from '@testing-library/react-native';

import LockScreen from '../../app/index';
import vault from '../../modules/expo-vault';
import { SessionProvider } from '../features/session/SessionProvider';

const vaultMock = vault as unknown as { reset(): void };

describe('LockScreen', () => {
  beforeEach(() => vaultMock.reset());

  it('offers the keypad and biometrics for an existing vault without the device warning', async () => {
    await vault.createVault();
    const view = await render(
      <SessionProvider>
        <LockScreen />
      </SessionProvider>,
    );

    await waitFor(() => expect(view.getByText(/Use Face ID or enter your PIN/)).toBeOnTheScreen());
    expect(view.getByRole('button', { name: 'Use biometrics' })).toBeOnTheScreen();
    expect(view.getByRole('button', { name: '5' })).toBeOnTheScreen();
    expect(view.queryByText(/rooted or modified/)).toBeNull();
  });
});
