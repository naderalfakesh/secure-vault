import { fireEvent, render } from '@testing-library/react-native';

import { lightColors } from '@/theme/colors';

import { IconButton } from '../IconButton';

describe('IconButton', () => {
  it('is a named 44 pt button on a muted circle', async () => {
    const onPress = jest.fn();
    const view = await render(
      <IconButton icon="share" accessibilityLabel="Share" onPress={onPress} />,
    );
    const button = view.getByRole('button', { name: 'Share' });

    expect(button).toHaveStyle({
      width: 44,
      height: 44,
      backgroundColor: lightColors.surfaceMuted,
    });
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('reports and enforces the disabled state', async () => {
    const onPress = jest.fn();
    const view = await render(
      <IconButton icon="trash" accessibilityLabel="Delete" disabled onPress={onPress} />,
    );
    const button = view.getByRole('button', { name: 'Delete' });

    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('draws the glass variant for the viewer stage', async () => {
    const view = await render(<IconButton icon="more" accessibilityLabel="More" variant="glass" />);

    expect(view.getByRole('button', { name: 'More' })).toHaveStyle({
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderColor: 'rgba(255,255,255,0.12)',
    });
  });
});
