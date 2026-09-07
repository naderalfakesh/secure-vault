import { act, fireEvent, render } from '@testing-library/react-native';
import { Text as NativeText } from 'react-native';

import { Button } from '../Button';
import { Chip } from '../Chip';
import { ListRow } from '../ListRow';
import { ToastProvider, useToast } from '../Toast';

describe('Button', () => {
  it('exposes label, disabled, and busy state to assistive tech', async () => {
    const onPress = jest.fn();
    const view = await render(<Button label="Unlock" onPress={onPress} loading />);
    const button = view.getByRole('button', { name: 'Unlock' });

    expect(button).toBeDisabled();
    expect(button).toBeBusy();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('calls onPress when enabled', async () => {
    const onPress = jest.fn();
    const view = await render(<Button label="Scan" onPress={onPress} />);

    await fireEvent.press(view.getByRole('button', { name: 'Scan' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Chip', () => {
  it('announces the count with the label and reflects selection', async () => {
    const view = await render(<Chip label="Medical" count={3} selected />);
    const chip = view.getByRole('button', { name: 'Medical, 3' });

    expect(chip).toBeSelected();
  });
});

describe('ListRow', () => {
  it('is not a button when it has no press handler', async () => {
    const view = await render(<ListRow title="Version" subtitle="2.0.0" />);

    expect(view.queryByRole('button')).toBeNull();
    expect(view.getByLabelText('Version, 2.0.0')).toBeOnTheScreen();
  });
});

function ToastProbe() {
  const toast = useToast();
  return (
    <NativeText
      onPress={() =>
        toast.show({ message: 'Saved', action: { label: 'View', onPress: jest.fn() } })
      }
    >
      trigger
    </NativeText>
  );
}

describe('Toast', () => {
  it('shows a message with an action and dismisses after the timeout', async () => {
    jest.useFakeTimers();
    const view = await render(
      <ToastProvider>
        <ToastProbe />
      </ToastProvider>,
    );

    await fireEvent.press(view.getByText('trigger'));
    expect(view.getByRole('alert')).toBeOnTheScreen();
    expect(view.getByText('View')).toBeOnTheScreen();

    await act(async () => {
      jest.advanceTimersByTime(5100);
    });
    expect(view.queryByRole('alert')).toBeNull();
    jest.useRealTimers();
  });
});
