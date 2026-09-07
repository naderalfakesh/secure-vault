import { render, waitFor } from '@testing-library/react-native';

import LockScreen from '../../app/index';
import { hashPasscode } from '../features/auth/passcode';
import * as SecureStore from 'expo-secure-store';
import vault from '../../modules/expo-vault';
import { SessionProvider } from '../features/session/SessionProvider';

const secureStoreMock = SecureStore as unknown as { __reset(): void };
const vaultMock = vault as unknown as { reset(): void };

describe('LockScreen', () => {
  beforeEach(() => {
    vaultMock.reset();
    secureStoreMock.__reset();
  });

  it('offers the keypad and biometrics for an existing vault without the device warning', async () => {
    await vault.createVault();
    await SecureStore.setItemAsync('securevault.pin', hashPasscode('123456', { iterations: 64 }));
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
