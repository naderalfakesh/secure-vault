import { act, fireEvent, render } from '@testing-library/react-native';
import { Text as NativeText } from 'react-native';

import { Chip } from '../Chip';
import { ToastProvider, useToast } from '../Toast';

describe('Chip', () => {
  it('announces the count with the label and reflects selection', async () => {
    const view = await render(<Chip label="Medical" count={3} selected />);
    const chip = view.getByRole('button', { name: 'Medical, 3' });

    expect(chip).toBeSelected();
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
