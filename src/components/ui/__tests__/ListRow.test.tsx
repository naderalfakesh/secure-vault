import { fireEvent, render } from '@testing-library/react-native';

import { lightColors } from '@/theme/colors';

import { Group } from '../Group';
import { ListRow } from '../ListRow';

describe('ListRow', () => {
  it('is not a button when it has no press handler', async () => {
    const view = await render(<ListRow title="Version" subtitle="2.0.0" />);

    expect(view.queryByRole('button')).toBeNull();
    expect(view.getByLabelText('Version, 2.0.0')).toBeOnTheScreen();
  });

  it('is a named button with a value when pressable', async () => {
    const onPress = jest.fn();
    const view = await render(
      <ListRow icon="clock" title="Auto-lock" value="After 1 minute" onPress={onPress} />,
    );

    await fireEvent.press(view.getByRole('button', { name: 'Auto-lock, After 1 minute' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is one accessible switch that a screen reader toggles', async () => {
    const onValueChange = jest.fn();
    const view = await render(
      <ListRow title="Privacy cover" toggle={{ value: false, onValueChange }} />,
    );
    const row = view.getByRole('switch', { name: 'Privacy cover' });

    expect(row).not.toBeChecked();
    // The native switch inside is hidden, so there is a single stop.
    expect(view.getAllByRole('switch')).toHaveLength(1);
    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('toggles from the switch itself, not from a tap elsewhere on the row', async () => {
    const onValueChange = jest.fn();
    const view = await render(
      <ListRow title="Privacy cover" toggle={{ value: true, onValueChange }} />,
    );

    await fireEvent.press(view.getByText('Privacy cover'));
    expect(onValueChange).not.toHaveBeenCalled();
    await fireEvent(
      view.getByTestId('list-row-switch', { includeHiddenElements: true }),
      'valueChange',
      false,
    );
    expect(onValueChange).toHaveBeenCalledWith(false);
  });

  it('ignores a screen reader toggle while disabled', async () => {
    const onValueChange = jest.fn();
    const view = await render(
      <ListRow title="Face ID" disabled toggle={{ value: false, onValueChange }} />,
    );
    const row = view.getByRole('switch', { name: 'Face ID' });

    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('acts as a radio option', async () => {
    const view = await render(
      <>
        <ListRow title="Immediately" checked onPress={jest.fn()} />
        <ListRow title="Never" checked={false} onPress={jest.fn()} />
      </>,
    );

    expect(view.getByRole('radio', { name: 'Immediately' })).toBeChecked();
    expect(view.getByRole('radio', { name: 'Never' })).not.toBeChecked();
  });

  it('keeps a disabled row inert and explains why in the subtitle', async () => {
    const onPress = jest.fn();
    const view = await render(
      <ListRow
        title="Face ID"
        subtitle="Face ID isn't set up on this phone."
        disabled
        onPress={onPress}
      />,
    );
    const row = view.getByLabelText("Face ID, Face ID isn't set up on this phone.");

    expect(row).toBeDisabled();
    await fireEvent.press(row);
    expect(onPress).not.toHaveBeenCalled();
    expect(view.getByText('Face ID')).toHaveStyle({ color: lightColors.textTertiary });
  });

  it('colours destructive titles and keeps the minimum heights', async () => {
    const view = await render(
      <>
        <ListRow title="Delete everything" destructive onPress={jest.fn()} />
        <ListRow title="Lock now" subtitle="Requires your PIN" onPress={jest.fn()} />
      </>,
    );

    expect(view.getByText('Delete everything')).toHaveStyle({ color: lightColors.danger });
    expect(view.getByRole('button', { name: 'Delete everything' })).toHaveStyle({ minHeight: 52 });
    expect(view.getByRole('button', { name: 'Lock now, Requires your PIN' })).toHaveStyle({
      minHeight: 60,
    });
  });
});

describe('Group', () => {
  it('draws a header, a footer, and separators between rows only', async () => {
    const view = await render(
      <Group header="Security" footer="Counted from when you leave SecureVault.">
        <ListRow title="Lock now" onPress={jest.fn()} />
        <ListRow title="Auto-lock" onPress={jest.fn()} />
        <ListRow title="Change PIN" onPress={jest.fn()} />
      </Group>,
    );

    expect(view.getByRole('header', { name: 'Security' })).toBeOnTheScreen();
    expect(view.getByText('Counted from when you leave SecureVault.')).toBeOnTheScreen();
    expect(view.getAllByTestId('group-separator')).toHaveLength(2);
    // Rows inside a group leave the separators to it.
    expect(view.getByRole('button', { name: 'Lock now' })).toHaveStyle({ borderBottomWidth: 0 });
  });
});
