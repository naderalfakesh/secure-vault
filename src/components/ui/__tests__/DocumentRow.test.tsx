import { fireEvent, render } from '@testing-library/react-native';

import { lightColors } from '@/theme/colors';

import { DocumentRow } from '../DocumentRow';

describe('DocumentRow', () => {
  it('reads title, meta, and snippet as one button', async () => {
    const onPress = jest.fn();
    const view = await render(
      <DocumentRow
        title="Lease agreement"
        meta="Legal · 5 pages · Yesterday"
        snippet={[{ text: '…the ' }, { text: 'deposit', match: true }, { text: ' is due…' }]}
        onPress={onPress}
      />,
    );
    const row = view.getByRole('button', {
      name: 'Lease agreement, Legal · 5 pages · Yesterday, …the deposit is due…',
    });

    expect(view.getByTestId('snippet-match')).toHaveStyle({
      backgroundColor: lightColors.accentMuted,
    });
    await fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('becomes a checkbox in multi-select and fills when selected', async () => {
    const view = await render(
      <>
        <DocumentRow
          title="Receipt"
          meta="Receipts · 1 page"
          selectable
          selected
          onPress={jest.fn()}
        />
        <DocumentRow
          title="Passport"
          meta="ID & Personal · 2 pages"
          selectable
          onPress={jest.fn()}
        />
      </>,
    );
    const selected = view.getByRole('checkbox', { name: 'Receipt, Receipts · 1 page' });

    expect(selected).toBeChecked();
    expect(selected).toHaveStyle({ backgroundColor: lightColors.primaryMuted });
    expect(
      view.getByRole('checkbox', { name: 'Passport, ID & Personal · 2 pages' }),
    ).not.toBeChecked();
  });

  it('starts multi-select on long press', async () => {
    const onLongPress = jest.fn();
    const view = await render(
      <DocumentRow title="Receipt" meta="Receipts" onPress={jest.fn()} onLongPress={onLongPress} />,
    );

    await fireEvent(view.getByRole('button', { name: 'Receipt, Receipts' }), 'longPress');
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });
});
