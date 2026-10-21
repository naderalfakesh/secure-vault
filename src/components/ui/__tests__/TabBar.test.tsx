import { fireEvent, render } from '@testing-library/react-native';

import { lightColors } from '@/theme/colors';

import { TabBar } from '../TabBar';

describe('TabBar', () => {
  it('puts the Scan button between Library and Settings and marks the active tab', async () => {
    const library = jest.fn();
    const settings = jest.fn();
    const scan = jest.fn();
    const view = await render(
      <TabBar
        tabs={[
          { key: 'library', label: 'Library', icon: 'library', selected: true, onPress: library },
          {
            key: 'settings',
            label: 'Settings',
            icon: 'settings',
            selected: false,
            onPress: settings,
          },
        ]}
        onScan={scan}
      />,
    );
    const active = view.getByRole('tab', { name: 'Library' });

    expect(active).toBeSelected();
    expect(active).toHaveStyle({ backgroundColor: lightColors.primaryMuted });
    expect(view.getByRole('tab', { name: 'Settings' })).not.toBeSelected();

    await fireEvent.press(view.getByRole('tab', { name: 'Scan a document' }));
    await fireEvent.press(view.getByRole('tab', { name: 'Settings' }));
    expect(scan).toHaveBeenCalledTimes(1);
    expect(settings).toHaveBeenCalledTimes(1);
    expect(view.getByRole('tab', { name: 'Scan a document' })).toHaveStyle({
      width: 56,
      height: 56,
    });
  });

  it('keeps the Scan action inside the tab list as a never-selected tab', async () => {
    const view = await render(
      <TabBar
        tabs={[
          { key: 'library', label: 'Library', icon: 'library', selected: true, onPress: jest.fn() },
        ]}
        onScan={jest.fn()}
      />,
    );
    const scan = view.getByRole('tab', { name: 'Scan a document' });

    expect(scan).not.toBeSelected();
    expect(scan.props.accessibilityHint).toBe('Opens the scanner');
    expect(view.queryAllByRole('button')).toHaveLength(0);
  });
});
