import { fireEvent, render } from '@testing-library/react-native';
import { I18nManager, Platform } from 'react-native';

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

  describe('right to left', () => {
    afterEach(() => jest.restoreAllMocks());

    function renderSwitch(os: 'ios' | 'android') {
      jest.replaceProperty(Platform, 'OS', os);
      jest.replaceProperty(I18nManager, 'isRTL', true);
      return render(<Switch value accessibilityLabel="Face ID" testID="switch" />);
    }

    it.each(['android', 'ios'] as const)(
      'mirrors the %s switch once, so "on" sits at the left',
      async (os) => {
        const view = await renderSwitch(os);
        expect(view.getByTestId('switch')).toHaveStyle({
          transform: [{ scaleX: -1 }],
        });
      },
    );
  });

  it('keeps the thumb as drawn left to right', async () => {
    const view = await render(<Switch value accessibilityLabel="Face ID" />);
    expect(view.getByRole('switch', { name: 'Face ID' })).not.toHaveStyle({
      transform: [{ scaleX: -1 }],
    });
  });
});
