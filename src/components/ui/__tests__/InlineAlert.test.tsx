import { render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { InlineAlert } from '../InlineAlert';

describe('InlineAlert', () => {
  beforeEach(() => jest.clearAllMocks());

  it('marks errors as alerts and announces them', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const view = await render(
      <InlineAlert tone="danger" message="That passphrase does not match this backup." />,
    );

    expect(
      view.getByRole('alert', { name: 'That passphrase does not match this backup.' }),
    ).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('That passphrase does not match this backup.');
  });

  it('keeps info callouts quiet and without the alert role', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const view = await render(
      <InlineAlert message="Text is read on this device. Google ML Kit sends Google usage metrics, but not your pages or their text." />,
    );

    expect(view.queryByRole('alert')).toBeNull();
    expect(
      view.getByLabelText(
        'Text is read on this device. Google ML Kit sends Google usage metrics, but not your pages or their text.',
      ),
    ).toBeOnTheScreen();
    expect(announce).not.toHaveBeenCalled();
  });

  it('announces a brass callout with its bold lead when asked', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await render(
      <InlineAlert
        tone="warning"
        title="This can't be stopped."
        message="The previous vault has been removed."
        announce
      />,
    );

    expect(announce).toHaveBeenCalledWith(
      "This can't be stopped. The previous vault has been removed.",
    );
  });
});
