import { fireEvent, render } from '@testing-library/react-native';
import { I18nManager } from 'react-native';

import { lightColors } from '@/theme/colors';

import { Switch } from '../Switch';

describe('Switch', () => {
  it('is a named switch that reports its state', async () => {
    const onValueChange = jest.fn();
    const view = await render(
      <Switch value accessibilityLabel="Face ID" onValueChange={onValueChange} />,
    );
    const control = view.getByRole('switch', { name: 'Face ID' });

    expect(control).toBeChecked();
    expect(control.props.onTintColor ?? control.props.trackColor?.true).toBe(lightColors.success);
    await fireEvent(control, 'valueChange', false);
    expect(onValueChange).toHaveBeenCalledWith(false);
  });

  it('reports the disabled state', async () => {
    const view = await render(<Switch value={false} accessibilityLabel="Face ID" disabled />);

    expect(view.getByRole('switch', { name: 'Face ID' })).toBeDisabled();
  });

  it('mirrors the thumb in a right-to-left layout', async () => {
    const rtl = jest.replaceProperty(I18nManager, 'isRTL', true);
    const view = await render(<Switch value accessibilityLabel="Face ID" />);
    expect(view.getByRole('switch', { name: 'Face ID' })).toHaveStyle({
      transform: [{ scaleX: -1 }],
    });
    rtl.restore();
  });

  it('keeps the thumb as drawn left to right', async () => {
    const view = await render(<Switch value accessibilityLabel="Face ID" />);
    expect(view.getByRole('switch', { name: 'Face ID' })).not.toHaveStyle({
      transform: [{ scaleX: -1 }],
    });
  });
});
