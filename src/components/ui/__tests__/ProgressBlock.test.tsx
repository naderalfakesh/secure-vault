import { render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { ProgressBlock } from '../ProgressBlock';

describe('ProgressBlock', () => {
  it('exposes a progress bar with its value and a polite live region', async () => {
    const view = await render(
      <ProgressBlock label="Checking 18 of 48" detail="Step 1 of 2" progress={18 / 48} />,
    );
    const bar = view.getByRole('progressbar', { name: 'Checking 18 of 48' });

    expect(bar).toHaveAccessibilityValue({ min: 0, max: 100, now: 38 });
    expect(bar).toHaveProp('accessibilityLiveRegion', 'polite');
    expect(view.getByTestId('progress-fill')).toHaveStyle({ width: '38%' });
    expect(view.getByText('Step 1 of 2')).toBeOnTheScreen();
  });

  it('speaks the line on iOS when it appears, then no more than every few seconds', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    announce.mockClear();
    const view = await render(<ProgressBlock label="Checking 1 of 48" progress={1 / 48} />);
    await view.rerender(<ProgressBlock label="Checking 2 of 48" progress={2 / 48} />);

    expect(announce.mock.calls).toEqual([['Checking 1 of 48']]);
    expect(announce).toHaveBeenCalledWith('Checking 1 of 48');
    announce.mockRestore();
  });

  it('clamps out-of-range progress', async () => {
    const view = await render(<ProgressBlock label="Restoring 1 of 1" progress={4} />);

    expect(view.getByTestId('progress-fill')).toHaveStyle({ width: '100%' });
  });
});
