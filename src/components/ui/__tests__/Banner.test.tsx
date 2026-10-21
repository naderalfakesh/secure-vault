import { fireEvent, render } from '@testing-library/react-native';

import { Banner } from '../Banner';

describe('Banner', () => {
  it('reads lead and message together and offers its actions until dismissed', async () => {
    const shareAgain = jest.fn();
    const dismiss = jest.fn();
    const view = await render(
      <Banner
        lead="SecureVault locked while you were sharing."
        message="The temporary copy was removed. Share again if you still need to."
        actions={[{ label: 'Share again', onPress: shareAgain }]}
        onDismiss={dismiss}
      />,
    );

    expect(
      view.getByLabelText(
        'SecureVault locked while you were sharing. The temporary copy was removed. Share again if you still need to.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Share again' }));
    await fireEvent.press(view.getByRole('button', { name: 'Dismiss' }));
    expect(shareAgain).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
