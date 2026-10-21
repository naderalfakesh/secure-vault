import { fireEvent, render } from '@testing-library/react-native';

import { lightColors } from '@/theme/colors';

import { Button } from '../Button';

describe('Button', () => {
  it('exposes label, disabled, and busy state to assistive tech while loading', async () => {
    const onPress = jest.fn();
    const view = await render(<Button label="Unlock" onPress={onPress} loading />);
    const button = view.getByRole('button', { name: 'Unlock' });

    expect(button).toBeDisabled();
    expect(button).toBeBusy();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('announces the verb-ing label while loading', async () => {
    const view = await render(
      <Button label="Restore" loadingLabel="Restoring…" loading onPress={jest.fn()} />,
    );

    expect(view.getByRole('button', { name: 'Restoring…' })).toBeBusy();
    expect(view.getByText('Restoring…')).toBeOnTheScreen();
  });

  it('calls onPress when enabled', async () => {
    const onPress = jest.fn();
    const view = await render(<Button label="Scan" icon="scan" onPress={onPress} />);

    await fireEvent.press(view.getByRole('button', { name: 'Scan' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('switches to the disabled colours and blocks presses when disabled', async () => {
    const onPress = jest.fn();
    const view = await render(
      <Button label="Save" variant="destructive" disabled onPress={onPress} />,
    );
    const button = view.getByRole('button', { name: 'Save' });

    expect(button).toBeDisabled();
    expect(button).not.toBeBusy();
    expect(button).toHaveStyle({ backgroundColor: lightColors.surfaceMuted });
    expect(view.getByText('Save')).toHaveStyle({ color: lightColors.textTertiary });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it.each([
    ['primary', 'primary', 'onPrimary'],
    ['tinted', 'primaryMuted', 'primary'],
    ['secondary', 'surfaceMuted', 'textPrimary'],
    ['destructive', 'danger', 'onDanger'],
    ['destructiveSoft', 'dangerMuted', 'danger'],
  ] as const)('draws the %s variant from the tokens', async (variant, background, foreground) => {
    const view = await render(<Button label="Go" variant={variant} />);

    expect(view.getByRole('button')).toHaveStyle({ backgroundColor: lightColors[background] });
    expect(view.getByText('Go')).toHaveStyle({ color: lightColors[foreground] });
  });

  it('meets the 52 and 44 pt heights', async () => {
    const view = await render(
      <>
        <Button label="Large" />
        <Button label="Medium" size="md" />
      </>,
    );

    expect(view.getByRole('button', { name: 'Large' })).toHaveStyle({ minHeight: 52 });
    expect(view.getByRole('button', { name: 'Medium' })).toHaveStyle({ minHeight: 44 });
  });
});
