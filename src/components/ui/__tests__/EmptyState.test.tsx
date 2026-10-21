import { fireEvent, render } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';

import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shows the title, body, and both actions', async () => {
    const scan = jest.fn();
    const importFile = jest.fn();
    const view = await render(
      <EmptyState
        icon="scan"
        title="Your vault is empty"
        description="Scan a passport, a lease or a receipt."
        actionLabel="Scan a document"
        onAction={scan}
        secondaryActionLabel="Import from Files or Photos"
        onSecondaryAction={importFile}
      />,
    );

    expect(view.getByText('Your vault is empty')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Scan a document' }));
    await fireEvent.press(view.getByRole('button', { name: 'Import from Files or Photos' }));
    expect(scan).toHaveBeenCalledTimes(1);
    expect(importFile).toHaveBeenCalledTimes(1);
  });

  it('has no buttons without actions', async () => {
    const view = await render(
      <EmptyState icon="warning" title="Couldn't load your documents" description="Try again." />,
    );

    expect(view.queryByRole('button')).toBeNull();
  });

  it('skips the entrance animation with reduced motion', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const timing = jest.spyOn(Reanimated, 'withTiming');
    await render(<EmptyState icon="scan" title="Empty" description="Nothing here." />);

    expect(timing).not.toHaveBeenCalled();
  });
});
