import { render } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { ListRow } from '../ListRow';
import { TabBar } from '../TabBar';
import { Text } from '../Text';

/** iOS AX5 reports a 3.57× font scale; Android's largest is 2×. */
function setFontScale(fontScale: number) {
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 402, height: 874, scale: 3, fontScale });
}

describe('largest text sizes (M4)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('caps the large title so a screen title never breaks one letter per line', async () => {
    const view = await render(
      <>
        <Text variant="largeTitle">Library</Text>
        <Text variant="body">Body text</Text>
      </>,
    );
    expect(view.getByText('Library').props.maxFontSizeMultiplier).toBe(1.6);
    // Body text keeps scaling uncapped (§10.2).
    expect(view.getByText('Body text').props.maxFontSizeMultiplier).toBeUndefined();
  });

  it('caps tab labels and keeps their full accessible names', async () => {
    setFontScale(3.57);
    const view = await render(
      <TabBar
        tabs={[
          { key: 'library', label: 'Library', icon: 'library', selected: true, onPress: jest.fn() },
          {
            key: 'settings',
            label: 'Settings',
            icon: 'settings',
            selected: false,
            onPress: jest.fn(),
          },
        ]}
        onScan={jest.fn()}
      />,
    );
    expect(view.getByText('Library').props.maxFontSizeMultiplier).toBe(1.35);
    expect(view.getByText('Settings').props.maxFontSizeMultiplier).toBe(1.35);
    expect(view.getByRole('tab', { name: 'Library' })).toBeOnTheScreen();
  });

  it('keeps a value beside its title at regular sizes', async () => {
    setFontScale(1);
    const view = await render(
      <ListRow title="Auto-lock" value="Immediately" icon="clock" onPress={jest.fn()} />,
    );
    const value = view.getByText('Immediately');
    expect(view.getByText('Auto-lock').parent?.parent).not.toBe(value.parent?.parent);
  });

  it.each([2, 3.57])('moves the value under the title at %f×', async (scale) => {
    setFontScale(scale);
    const view = await render(
      <ListRow title="Auto-lock" value="Immediately" icon="clock" onPress={jest.fn()} />,
    );
    const title = view.getByText('Auto-lock');
    const value = view.getByText('Immediately');
    // Both lines share the row's text column, so the value gets the full width.
    expect(value.parent?.parent).toBe(title.parent?.parent);
    expect(value.props.maxFontSizeMultiplier).toBe(2.4);
    expect(title.props.maxFontSizeMultiplier).toBe(2.4);
    expect(view.getByRole('button', { name: 'Auto-lock, Immediately' })).toBeOnTheScreen();
  });
});
