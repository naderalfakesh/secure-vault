import { fireEvent, render } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';

import { lightColors } from '@/theme/colors';

import { PinDots } from '../PinDots';
import { PinPad } from '../PinPad';

describe('PinPad', () => {
  it('sends digits and backspace through named keys', async () => {
    const onKey = jest.fn();
    const view = await render(<PinPad onKey={onKey} />);

    await fireEvent.press(view.getByRole('button', { name: '7' }));
    await fireEvent.press(view.getByRole('button', { name: 'Delete' }));
    expect(onKey).toHaveBeenNthCalledWith(1, '7');
    expect(onKey).toHaveBeenNthCalledWith(2, 'del');
    expect(view.getByRole('button', { name: '0' })).toHaveStyle({ width: 76, height: 76 });
  });

  it('hides the biometric key when biometrics are unavailable', async () => {
    const view = await render(<PinPad onKey={jest.fn()} />);

    expect(view.queryByRole('button', { name: 'Use biometrics' })).toBeNull();
    expect(view.getAllByRole('button')).toHaveLength(11);
  });

  it('shows a named biometric key when available', async () => {
    const onBiometric = jest.fn();
    const view = await render(
      <PinPad onKey={jest.fn()} onBiometric={onBiometric} biometricLabel="Use Face ID" />,
    );

    await fireEvent.press(view.getByRole('button', { name: 'Use Face ID' }));
    expect(onBiometric).toHaveBeenCalledTimes(1);
  });

  it('dims and disables every key during a lockout', async () => {
    const onKey = jest.fn();
    const view = await render(<PinPad onKey={onKey} disabled />);

    expect(view.getByTestId('pin-pad')).toHaveStyle({ opacity: 0.32 });
    expect(view.getByRole('button', { name: '1' })).toBeDisabled();
    await fireEvent.press(view.getByRole('button', { name: '1' }));
    expect(onKey).not.toHaveBeenCalled();
  });

  it('ignores presses while busy without dimming', async () => {
    const onKey = jest.fn();
    const view = await render(<PinPad onKey={onKey} busy />);

    expect(view.getByTestId('pin-pad')).not.toHaveStyle({ opacity: 0.32 });
    await fireEvent.press(view.getByRole('button', { name: '1' }));
    expect(onKey).not.toHaveBeenCalled();
  });
});

describe('PinDots', () => {
  afterEach(() => jest.restoreAllMocks());

  it('announces how many digits are entered', async () => {
    const view = await render(<PinDots filled={2} />);

    expect(view.getByLabelText('2 of 6 digits entered')).toBeOnTheScreen();
    expect(view.getByTestId('pin-dot-1', { includeHiddenElements: true })).toHaveStyle({
      backgroundColor: lightColors.textPrimary,
    });
    expect(view.getByTestId('pin-dot-2', { includeHiddenElements: true })).toHaveStyle({
      borderWidth: 1.5,
      borderColor: lightColors.borderStrong,
    });
  });

  it('turns every dot danger on a wrong PIN', async () => {
    const view = await render(<PinDots filled={6} error />);

    expect(view.getByTestId('pin-dot-5', { includeHiddenElements: true })).toHaveStyle({
      backgroundColor: lightColors.danger,
    });
  });

  it('shakes 3 × 8 pt only without reduced motion', async () => {
    const sequence = jest.spyOn(Reanimated, 'withSequence');
    const view = await render(<PinDots filled={6} error shake={0} />);
    await view.rerender(<PinDots filled={6} error shake={1} />);
    expect(sequence).toHaveBeenCalledTimes(1);
    expect(sequence.mock.calls[0]).toHaveLength(6);

    sequence.mockClear();
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    await view.rerender(<PinDots filled={6} error shake={2} />);
    expect(sequence).not.toHaveBeenCalled();
  });
});
