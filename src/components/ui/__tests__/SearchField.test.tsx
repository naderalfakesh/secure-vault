import { fireEvent, render } from '@testing-library/react-native';

import { SearchField } from '../SearchField';

describe('SearchField', () => {
  it('is a labelled field that reports typing', async () => {
    const onChangeText = jest.fn();
    const view = await render(<SearchField value="" onChangeText={onChangeText} />);

    await fireEvent.changeText(view.getByLabelText('Search documents'), 'lease');
    expect(onChangeText).toHaveBeenCalledWith('lease');
    expect(view.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });

  it('clears the query with a named button', async () => {
    const onChangeText = jest.fn();
    const view = await render(<SearchField value="lease" onChangeText={onChangeText} />);

    const clear = view.getByRole('button', { name: 'Clear search' });

    // 18 pt glyph plus its slop on both sides: a 44 pt target.
    expect(clear).toHaveStyle({ width: 18 });
    expect(18 + clear.props.hitSlop * 2).toBe(44);
    await fireEvent.press(clear);
    expect(onChangeText).toHaveBeenCalledWith('');
  });

  it('shows Cancel only while focused, and Cancel clears and leaves search', async () => {
    const onChangeText = jest.fn();
    const onCancel = jest.fn();
    const view = await render(
      <SearchField value="lease" onChangeText={onChangeText} onCancel={onCancel} />,
    );

    expect(view.queryByRole('button', { name: 'Cancel' })).toBeNull();
    await fireEvent(view.getByLabelText('Search documents'), 'focus');
    await fireEvent.press(view.getByRole('button', { name: 'Cancel' }));

    expect(onChangeText).toHaveBeenCalledWith('');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(view.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });
});
