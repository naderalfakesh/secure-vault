import { render } from '@testing-library/react-native';

import { lightColors } from '@/theme/colors';

import { PrivacyCover } from '../PrivacyCover';

describe('PrivacyCover', () => {
  it('is a solid, non-interactive cover hidden from assistive tech', async () => {
    const view = await render(<PrivacyCover />);
    const cover = view.getByTestId('privacy-cover', { includeHiddenElements: true });

    expect(cover).toHaveStyle({ backgroundColor: lightColors.background });
    expect(cover).toHaveProp('pointerEvents', 'none');
    expect(view.queryByText('SecureVault')).toBeNull();
    expect(view.getByText('SecureVault', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});
