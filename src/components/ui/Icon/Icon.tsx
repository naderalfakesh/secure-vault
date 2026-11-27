import { SymbolView } from 'expo-symbols';
import { I18nManager, Platform, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { decorative } from '../a11y';
import { MIRRORED } from './constants';
import { styles } from './Icon.styles';
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
  const isDecorative = !accessibilityLabel;

  // Neither SF Symbols nor SVGs auto-flip side-named glyphs (e.g. chevron.right), so mirror manually in RTL.
  const flip = glyph.mirror && I18nManager.isRTL;
  const svg = <IconGlyph path={glyph.d} size={size} color={tint} strokeWidth={strokeWidth} />;

  if (Platform.OS === 'ios' && glyph.sf) {
    return (
      <SymbolView
        name={glyph.sf}
        size={size}
        tintColor={tint}
        weight={weight}
        style={[styles.box(size), flip ? MIRRORED : null, style]}
        accessibilityLabel={accessibilityLabel}
        accessibilityElementsHidden={isDecorative}
        fallback={svg}
      />
    );
  }

  return (
    <View
      style={[styles.box(size), flip ? MIRRORED : null, style]}
      accessibilityLabel={accessibilityLabel}
      accessible={!isDecorative}
      accessibilityElementsHidden={isDecorative}
      importantForAccessibility={isDecorative ? decorative.importantForAccessibility : 'yes'}
    >
      {svg}
    </View>
  );
}
