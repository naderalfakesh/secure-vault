import { fireEvent, render } from '@testing-library/react-native';

import { lightColors } from '@/theme/colors';

import { Chip } from '../Chip';

describe('Chip', () => {
  it('announces the count with the label and reflects selection', async () => {
    const view = await render(<Chip label="Medical" count={3} selected onPress={jest.fn()} />);
    const chip = view.getByRole('button', { name: 'Medical, 3' });

    expect(chip).toBeSelected();
    expect(chip).toHaveStyle({ backgroundColor: lightColors.primary });
  });

  it('is a muted, unselected filter by default', async () => {
    const onPress = jest.fn();
    const view = await render(<Chip label="Legal" onPress={onPress} />);
    const chip = view.getByRole('button', { name: 'Legal' });

    expect(chip).not.toBeSelected();
    expect(chip).toHaveStyle({ backgroundColor: lightColors.surfaceMuted });
    await fireEvent.press(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('draws the brass status, success, and outlined tag chips without a button role', async () => {
    const view = await render(
      <>
        <Chip label="Expires in 82 days" icon="clock" variant="status" />
        <Chip label="Searchable" variant="success" />
        <Chip label="travel" variant="tag" />
      </>,
    );

    expect(view.queryByRole('button')).toBeNull();
    expect(view.getByText('Expires in 82 days')).toHaveStyle({ color: lightColors.accent });
    expect(view.getByText('Searchable')).toHaveStyle({ color: lightColors.success });
    expect(view.getByLabelText('# travel')).toBeOnTheScreen();
  });

  it('offers a named remove control', async () => {
    const onRemove = jest.fn();
    const view = await render(<Chip label="1234" variant="tag" onRemove={onRemove} />);

    await fireEvent.press(view.getByRole('button', { name: 'Remove 1234' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('exposes remove as an accessibility action on a pressable chip', async () => {
    const onRemove = jest.fn();
    const view = await render(<Chip label="Medical" onPress={jest.fn()} onRemove={onRemove} />);

    await fireEvent(view.getByRole('button', { name: 'Medical' }), 'accessibilityAction', {
      nativeEvent: { actionName: 'remove' },
    });
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('blocks presses when disabled', async () => {
    const onPress = jest.fn();
    const view = await render(<Chip label="Legal" disabled onPress={onPress} />);
    const chip = view.getByRole('button', { name: 'Legal' });

    expect(chip).toBeDisabled();
    await fireEvent.press(chip);
    expect(onPress).not.toHaveBeenCalled();
  });
});
