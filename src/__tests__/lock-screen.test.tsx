import { render, waitFor } from '@testing-library/react-native';

import LockScreen from '../../app/index';
import vault from '../../modules/expo-vault';
import { SessionProvider } from '../features/session/SessionProvider';

const vaultMock = vault as unknown as { reset(): void };

describe('LockScreen', () => {
  beforeEach(() => vaultMock.reset());

  it('offers setup when no vault exists and never shows the device warning on trusted hardware', async () => {
    const view = await render(
      <SessionProvider>
        <LockScreen />
      </SessionProvider>,
    );

    expect(await view.findByRole('button', { name: 'Set up SecureVault' })).toBeOnTheScreen();
    expect(view.queryByText(/rooted or modified/)).toBeNull();
  });

  it('prompts to unlock when a vault exists', async () => {
    await vault.createVault();
    const view = await render(
      <SessionProvider>
        <LockScreen />
      </SessionProvider>,
    );

    await waitFor(() => expect(view.getByRole('button', { name: 'Unlock' })).toBeOnTheScreen());
  });
});
