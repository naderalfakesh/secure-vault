import { fireEvent, render } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { SegmentedControl } from '../SegmentedControl';

const options = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

describe('SegmentedControl', () => {
  it('is a named radio group with the current option checked', async () => {
    const view = await render(
      <SegmentedControl
        accessibilityLabel="Appearance"
        options={options}
        value="system"
        onChange={jest.fn()}
      />,
    );

    // The group stays non-accessible itself so its radios remain reachable.
    expect(view.getByLabelText('Appearance')).toHaveProp('accessibilityRole', 'radiogroup');
    expect(view.getByRole('radio', { name: 'System' })).toBeChecked();
    expect(view.getByRole('radio', { name: 'Dark' })).not.toBeChecked();
  });

  it('reports a new choice and ignores the current one', async () => {
    const onChange = jest.fn();
    const view = await render(
      <SegmentedControl
        accessibilityLabel="Appearance"
        options={options}
        value="system"
        onChange={onChange}
      />,
    );

    await fireEvent.press(view.getByRole('radio', { name: 'System' }));
    await fireEvent.press(view.getByRole('radio', { name: 'Dark' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('dark');
  });

  it('blocks changes when disabled', async () => {
    const onChange = jest.fn();
    const view = await render(
      <SegmentedControl
        accessibilityLabel="Appearance"
        options={options}
        value="system"
        onChange={onChange}
        disabled
      />,
    );
    const dark = view.getByRole('radio', { name: 'Dark' });

    expect(dark).toBeDisabled();
    await fireEvent.press(dark);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('gives each segment a 44 pt target', async () => {
    jest
      .spyOn(Dimensions, 'get')
      .mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
    const view = await render(
      <SegmentedControl
        accessibilityLabel="Appearance"
        options={options}
        value="system"
        onChange={jest.fn()}
      />,
    );
    const segment = view.getByRole('radio', { name: 'Light' });
    const { top, bottom } = segment.props.hitSlop;

    expect(segment).toHaveStyle({ minHeight: 38 });
    expect(38 + top + bottom).toBe(44);
    jest.restoreAllMocks();
  });

  it('gives each stacked row a 44 pt target of its own at large text', async () => {
    jest
      .spyOn(Dimensions, 'get')
      .mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 2 });
    const view = await render(
      <SegmentedControl
        accessibilityLabel="Appearance"
        options={options}
        value="system"
        onChange={jest.fn()}
      />,
    );
    expect(view.getByRole('radio', { name: 'Light' })).toHaveStyle({ minHeight: 44 });
    jest.restoreAllMocks();
  });
});
