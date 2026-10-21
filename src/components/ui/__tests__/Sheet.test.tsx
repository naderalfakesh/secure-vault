import { fireEvent, render } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';

import { Text } from '../Text';
import { Sheet } from '../Sheet';

describe('Sheet', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shows a header title and a named close button', async () => {
    const onClose = jest.fn();
    const view = await render(
      <Sheet visible onClose={onClose} title="Sort and filter">
        <Text>Body</Text>
      </Sheet>,
    );

    expect(view.getByRole('header', { name: 'Sort and filter' })).toBeOnTheScreen();
    // The modal panel hides the backdrop from assistive tech; the header circle is the control.
    await fireEvent.press(view.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('offers a leading text action in the header', async () => {
    const onReset = jest.fn();
    const view = await render(
      <Sheet
        visible
        onClose={jest.fn()}
        title="Sort and filter"
        headerAction={{ label: 'Reset', onPress: onReset }}
      >
        <Text>Body</Text>
      </Sheet>,
    );

    await fireEvent.press(view.getByRole('button', { name: 'Reset' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('cannot be closed while busy', async () => {
    const onClose = jest.fn();
    const view = await render(
      <Sheet visible onClose={onClose} title="Restoring" dismissable={false}>
        <Text>Restoring 3 of 48</Text>
      </Sheet>,
    );

    expect(view.queryByRole('button', { name: 'Close' })).toBeNull();
    expect(view.getByText('Restoring 3 of 48')).toBeOnTheScreen();
  });

  it('springs open normally and cross-fades with reduced motion', async () => {
    const spring = jest.spyOn(Reanimated, 'withSpring');
    await render(
      <Sheet visible onClose={jest.fn()} title="Auto-lock">
        <Text>Body</Text>
      </Sheet>,
    );
    expect(spring).toHaveBeenCalled();

    spring.mockClear();
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const timing = jest.spyOn(Reanimated, 'withTiming');
    await render(
      <Sheet visible onClose={jest.fn()} title="Auto-lock">
        <Text>Body</Text>
      </Sheet>,
    );
    expect(spring).not.toHaveBeenCalled();
    expect(timing).toHaveBeenCalled();
  });
});
