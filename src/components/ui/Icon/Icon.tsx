import { SymbolView } from 'expo-symbols';
import { I18nManager, Platform, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { MIRRORED } from './constants';
import { IconGlyph } from './IconGlyph';
import { icons } from './icons';
import type { Glyph, IconProps } from './types';
import { toneToColor } from '../Text/constants';

export function Icon({
  name,
  size = 22,
  tone = 'primary',
  color,
  weight = 'regular',
  strokeWidth,
  style,
  accessibilityLabel,
}: IconProps) {
  const { theme } = useUnistyles();
  const tint = color ?? theme.colors[toneToColor[tone]];
  const glyph: Glyph = icons[name];
  const decorative = !accessibilityLabel;

  // Directional glyphs are named for a side ("chevron.right"), which neither
  // SF Symbols nor the SVG flips, so both platforms mirror them in a
  // right-to-left layout. The keypad's backspace is not directional and never flips.
  const flip = glyph.mirror && I18nManager.isRTL;
  const svg = <IconGlyph path={glyph.d} size={size} color={tint} strokeWidth={strokeWidth} />;

  if (Platform.OS === 'ios' && glyph.sf) {
    return (
      <SymbolView
        name={glyph.sf}
        size={size}
        tintColor={tint}
        weight={weight}
        style={[{ width: size, height: size }, flip ? MIRRORED : null, style]}
        accessibilityLabel={accessibilityLabel}
        accessibilityElementsHidden={decorative}
        fallback={svg}
      />
    );
  }

  return (
    <View
      style={[{ width: size, height: size }, flip ? MIRRORED : null, style]}
      accessibilityLabel={accessibilityLabel}
      accessible={!decorative}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
    >
      {svg}
    </View>
  );
}
