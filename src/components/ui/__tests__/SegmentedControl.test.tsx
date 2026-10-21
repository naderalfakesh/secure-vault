import { fireEvent, render } from '@testing-library/react-native';

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
});
