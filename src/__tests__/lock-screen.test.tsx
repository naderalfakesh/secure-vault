import { render } from '@testing-library/react-native';

import VaultLockedScreen from '../../app/index';

describe('VaultLockedScreen', () => {
  it('offers unlock and vault creation without blocking on device checks', async () => {
    const view = await render(<VaultLockedScreen />);

    expect(await view.findByText('Unlock Vault')).toBeOnTheScreen();
    expect(view.getByText('Create New Vault')).toBeOnTheScreen();
    expect(view.queryByText(/rooted or modified/)).toBeNull();
  });
});
