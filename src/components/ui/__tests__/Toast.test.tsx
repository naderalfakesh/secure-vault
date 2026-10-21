import { act, fireEvent, render } from '@testing-library/react-native';
import { AccessibilityInfo, Text as NativeText } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

import { ToastProvider, useToast, type ToastOptions } from '../Toast';

function Probe({ options }: { options: ToastOptions }) {
  const toast = useToast();
  return <NativeText onPress={() => toast.show(options)}>trigger</NativeText>;
}

async function showToast(options: ToastOptions) {
  const view = await render(
    <ToastProvider>
      <Probe options={options} />
    </ToastProvider>,
  );
  await fireEvent.press(view.getByText('trigger'));
  return view;
}

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('announces a neutral toast politely and hides it after 4 s', async () => {
    const view = await showToast({ message: 'PIN changed' });
    const message = view.getByText('PIN changed');

    expect(message).toHaveProp('accessibilityLiveRegion', 'polite');
    expect(view.queryByRole('alert')).toBeNull();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('PIN changed');

    await act(async () => {
      jest.advanceTimersByTime(3900);
    });
    expect(view.getByText('PIN changed')).toBeOnTheScreen();
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(view.queryByText('PIN changed')).toBeNull();
  });

  it('makes a danger toast an assertive alert', async () => {
    const view = await showToast({
      message: "That file isn't a SecureVault backup.",
      tone: 'danger',
    });

    expect(view.getByRole('alert')).toHaveProp('accessibilityLiveRegion', 'assertive');
  });

  it('keeps a toast with an action for 8 s and runs the action once', async () => {
    const onUndo = jest.fn();
    const view = await showToast({
      message: '“Lease agreement” deleted',
      action: { label: 'Undo', onPress: onUndo },
      countdown: true,
    });

    await act(async () => {
      jest.advanceTimersByTime(7000);
    });
    // The ring is decorative; the action names itself.
    const hidden = { includeHiddenElements: true };
    expect(view.getByTestId('toast-countdown', hidden)).toBeOnTheScreen();
    expect(view.getByText('1', hidden)).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(view.queryByText('“Lease agreement” deleted')).toBeNull();
  });

  it('shows a static countdown with reduced motion', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const view = await showToast({
      message: '2 documents deleted',
      action: { label: 'Undo', onPress: jest.fn() },
      countdown: true,
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(view.getByText('8s', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});
