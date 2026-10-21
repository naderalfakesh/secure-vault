import { act, fireEvent, render } from '@testing-library/react-native';
import { Text as NativeText } from 'react-native';

import { ToastProvider, useToast } from '../Toast';

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
