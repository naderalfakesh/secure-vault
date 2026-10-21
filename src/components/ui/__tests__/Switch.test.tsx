import { fireEvent, render } from '@testing-library/react-native';

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
});
