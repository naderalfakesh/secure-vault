import { render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { PinDots } from '../PinDots';
import { PinPad } from '../PinPad';
import { Sheet } from '../Sheet';
import { Text } from '../Text';

describe('Dynamic Type', () => {
  it('lets text scale to the largest accessibility size', async () => {
    const view = await render(<Text>Your vault is empty</Text>);
    expect(view.getByText('Your vault is empty')).not.toHaveProp('maxFontSizeMultiplier');
  });

  it('scrolls a sheet body that grows past the sheet', async () => {
    const view = await render(
      <Sheet visible onClose={() => {}} title="Restore">
        <Text>Everything currently in this vault will be replaced by this backup.</Text>
      </Sheet>,
    );
    const types: string[] = [];
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      const element = node as { type?: string; children?: unknown[] };
      if (element.type) types.push(element.type);
      element.children?.forEach(walk);
    };
    walk(view.toJSON());
    expect(types).toContain('RCTScrollView');
  });
});

describe('PIN entry', () => {
  it('announces how many digits are entered, and stays quiet when empty', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    announce.mockClear();
    const view = await render(<PinDots filled={0} />);
    expect(view.getByLabelText('0 of 6 digits entered')).toBeOnTheScreen();
    expect(announce).not.toHaveBeenCalled();

    await view.rerender(<PinDots filled={2} />);
    expect(view.getByLabelText('2 of 6 digits entered')).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('2 of 6 digits entered');
    announce.mockRestore();
  });

  it('keeps Western Arabic digits on the keypad', async () => {
    const view = await render(<PinPad onKey={() => {}} />);
    for (const digit of ['0', '1', '9']) expect(view.getByText(digit)).toBeOnTheScreen();
    expect(view.getByTestId('pin-pad')).toHaveStyle({ direction: 'ltr' });
  });
});
