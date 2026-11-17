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

  it('draws the 80 pt sealed folio mark in the app theme', async () => {
    const view = await render(<PrivacyCover />);
    const mark = view.getByTestId('mark', { includeHiddenElements: true });
    expect(mark).toHaveStyle({ width: 80, height: 80 });
    expect(view.getByTestId('mark-light', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});
