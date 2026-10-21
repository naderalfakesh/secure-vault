import { render } from '@testing-library/react-native';
import * as GlassEffect from 'expo-glass-effect';
import { AccessibilityInfo, Platform } from 'react-native';

import { Sheet } from '../Sheet';
import { TabBar } from '../TabBar';

jest.mock('expo-glass-effect', () => {
  const { View } = jest.requireActual('react-native');
  return {
    GlassView: (props: object) => <View testID="glass" {...props} />,
    isLiquidGlassAvailable: jest.fn(() => false),
    isGlassEffectAPIAvailable: jest.fn(() => true),
  };
});

const hidden = { includeHiddenElements: true };
const tabs = [
  { key: 'library', label: 'Library', icon: 'library', selected: true, onPress: () => {} },
  { key: 'settings', label: 'Settings', icon: 'settings', selected: false, onPress: () => {} },
] as const;

function renderChrome() {
  return render(
    <>
      <TabBar tabs={[...tabs]} onScan={() => {}} />
      <Sheet visible onClose={() => {}} title="Share">
        {null}
      </Sheet>
    </>,
  );
}

describe('Liquid Glass chrome', () => {
  const os = Platform.OS;
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
    jest.restoreAllMocks();
  });

  it('puts glass behind the tab bar and the sheet on iOS 26+', async () => {
    jest.mocked(GlassEffect.isLiquidGlassAvailable).mockReturnValue(true);
    jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(false);
    const view = await renderChrome();
    expect(view.getAllByTestId('glass', hidden)).toHaveLength(2);
  });

  it('stays solid with Reduce Transparency on', async () => {
    jest.mocked(GlassEffect.isLiquidGlassAvailable).mockReturnValue(true);
    jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(true);
    const view = await renderChrome();
    expect(view.queryAllByTestId('glass', hidden)).toHaveLength(0);
  });

  it('stays solid on iOS without Liquid Glass', async () => {
    jest.mocked(GlassEffect.isLiquidGlassAvailable).mockReturnValue(false);
    const view = await renderChrome();
    expect(view.queryAllByTestId('glass', hidden)).toHaveLength(0);
  });

  it('stays solid on Android', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
    jest.mocked(GlassEffect.isLiquidGlassAvailable).mockReturnValue(true);
    const view = await renderChrome();
    expect(view.queryAllByTestId('glass', hidden)).toHaveLength(0);
  });
});
