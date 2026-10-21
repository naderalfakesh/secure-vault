import { render } from '@testing-library/react-native';

import { lightColors } from '@/theme/colors';

import { iconPaths } from '../iconPaths';
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

  it('draws the SVG mark on the indigo squircle', async () => {
    const view = await render(<PrivacyCover />);
    const mark = view.getByTestId('mark', { includeHiddenElements: true });
    expect(mark).toHaveStyle({ width: 80, backgroundColor: lightColors.primary });
    expect(JSON.stringify(view.toJSON())).toContain(iconPaths.mark);
  });
});
