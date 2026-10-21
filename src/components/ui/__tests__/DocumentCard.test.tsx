import { fireEvent, render } from '@testing-library/react-native';

import { lightColors } from '@/theme/colors';

import { DocumentCard } from '../DocumentCard';

describe('DocumentCard', () => {
  it('is a named button with the brass expiry line', async () => {
    const onPress = jest.fn();
    const view = await render(
      <DocumentCard title="Passport" expiry="Expires in 82 days" onPress={onPress} />,
    );
    const card = view.getByRole('button', { name: 'Passport, Expires in 82 days' });

    expect(view.getByText('Expires in 82 days')).toHaveStyle({ color: lightColors.warning });
    expect(card).toHaveStyle({ width: 210, borderRadius: 20 });
    await fireEvent.press(card);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('isolates the title so mixed-direction names keep their order', async () => {
    const view = await render(<DocumentCard title="عقد الإيجار 2026" meta="Yesterday" />);

    expect(view.getByText('⁨عقد الإيجار 2026⁩')).toBeOnTheScreen();
    expect(view.getByRole('button', { name: 'عقد الإيجار 2026, Yesterday' })).toBeDisabled();
  });
});
