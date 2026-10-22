import { render, waitFor } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import AddDocumentScreen from '../../../../app/documents/add';
import { SessionProvider } from '../../../features/session/SessionProvider';
import { textScale } from '../../../theme/tokens';
import { SegmentedControl } from '../SegmentedControl';
import { Sheet } from '../Sheet';
import { Text, wholeWordFit } from '../Text';
import { ToastProvider } from '../Toast';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

/** iOS AX5 at the 3.1× the re-QA used, in a narrow (SE-width) window. */
const AX5 = 3.1;
function setWindow(fontScale: number, width = 320) {
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width, height: 568, scale: 2, fontScale });
}

/** The props that stop a word breaking mid-word, with one line per word at most. */
function expectWholeWords(node: { props: Record<string, unknown> }, words: number) {
  expect(node.props.adjustsFontSizeToFit).toBe(true);
  expect(node.props.minimumFontScale).toBe(textScale.fitMinScale);
  expect(node.props.numberOfLines).toBe(words);
}

describe('whole words at AX5 (F4)', () => {
  beforeEach(() => setWindow(AX5));
  afterEach(() => jest.restoreAllMocks());

  it('gives one line per word and shrinks to fit them', () => {
    expect(wholeWordFit('Library')).toEqual({
      numberOfLines: 1,
      adjustsFontSizeToFit: true,
      minimumFontScale: textScale.fitMinScale,
    });
    expect(wholeWordFit('  One encrypted   file ')?.numberOfLines).toBe(3);
    expect(wholeWordFit('Two words', 1)?.numberOfLines).toBe(1);
    expect(wholeWordFit('   ')).toBeNull();
  });

  it('fits the large title and caps it tighter', async () => {
    const view = await render(<Text variant="largeTitle">Library</Text>);
    const title = view.getByText('Library');
    expectWholeWords(title, 1);
    expect(title.props.maxFontSizeMultiplier).toBe(textScale.largeTitleMax);
    expect(textScale.largeTitleMax).toBeLessThanOrEqual(1.3);
  });

  it.each(['title1', 'title2', 'title3'] as const)('fits a %s heading', async (variant) => {
    const view = await render(
      <Text variant={variant} accessibilityRole="header">
        One encrypted file, your passphrase
      </Text>,
    );
    expectWholeWords(view.getByText('One encrypted file, your passphrase'), 5);
  });

  it('leaves body text and opted-out user content wrapping as before', async () => {
    const view = await render(
      <>
        <Text variant="body">Pages are encrypted on this device</Text>
        <Text variant="title2" fit={false}>
          Passport_scan_2024_final
        </Text>
      </>,
    );
    for (const text of ['Pages are encrypted on this device', 'Passport_scan_2024_final']) {
      const node = view.getByText(text);
      expect(node.props.adjustsFontSizeToFit).toBeUndefined();
      expect(node.props.numberOfLines).toBeUndefined();
    }
  });

  it('fits the sheet title on a row of its own, capped at the bar size', async () => {
    const view = await render(
      <Sheet visible onClose={jest.fn()} title="Encrypted backup">
        <Text>Body</Text>
      </Sheet>,
    );
    const title = view.getByText('Encrypted backup');
    expectWholeWords(title, 2);
    expect(title.props.maxFontSizeMultiplier).toBe(textScale.barTitleMax);
    expect(textScale.barTitleMax).toBeLessThanOrEqual(1.6);
    // Stacked: the title is no longer squeezed between the header controls.
    const close = view.getByRole('button', { name: 'Close' });
    expect(close.parent?.parent).not.toBe(title.parent?.parent);
  });

  it('turns the segmented control into a vertical list with fitted labels', async () => {
    const view = await render(
      <SegmentedControl
        accessibilityLabel="Appearance"
        options={[
          { value: 'system', label: 'System' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
        value="system"
        onChange={jest.fn()}
      />,
    );
    expect(view.getByLabelText('Appearance')).toHaveStyle({ flexDirection: 'column' });
    for (const label of ['System', 'Light', 'Dark']) {
      const node = view.getByText(label);
      expectWholeWords(node, 1);
      expect(node.props.maxFontSizeMultiplier).toBe(textScale.segmentMax);
    }
    expect(view.getByRole('radio', { name: 'System' })).toBeChecked();
  });

  it('keeps the segments side by side at regular sizes', async () => {
    setWindow(1, 390);
    const view = await render(
      <SegmentedControl
        accessibilityLabel="Appearance"
        options={[
          { value: 'system', label: 'System' },
          { value: 'dark', label: 'Dark' },
        ]}
        value="system"
        onChange={jest.fn()}
      />,
    );
    expect(view.getByLabelText('Appearance')).toHaveStyle({ flexDirection: 'row' });
  });

  it.each([AX5, 2])(
    'shows the Add a document title beside its close control at %f×',
    async (scale) => {
      // Android's largest font is 2×: the title used to collapse to just the X.
      setWindow(scale, 360);
      const view = await render(
        <SessionProvider>
          <ToastProvider>
            <AddDocumentScreen />
          </ToastProvider>
        </SessionProvider>,
      );
      await waitFor(() => expect(view.getByText('Add a document')).toBeOnTheScreen());
      const title = view.getByText('Add a document');
      expectWholeWords(title, 3);
      expect(title).not.toHaveStyle({ flex: 1 });
      expect(view.getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();
    },
  );
});
