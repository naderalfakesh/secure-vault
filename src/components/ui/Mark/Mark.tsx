import Animated from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import { useUnistyles } from 'react-native-unistyles';

import { markSvg } from '@/brand/folio';
import { darkColors, lightColors } from '@/theme/colors';

import { decorative } from '../a11y';
import { IconGlyph } from '../Icon';
import { markGlyphSize } from './helpers';
import { styles } from './Mark.styles';
import type { MarkProps } from './types';

/**
 * The SecureVault mark: the sealed folio, the app icon's drawing on its
 * rounded indigo tile (night blue in dark mode). It comes from the same SVG
 * as the splash image, so the splash handoff repaints the native splash
 * exactly. The muted variant, and any other glyph such as the lockout clock,
 * keeps the quiet outline style on a plain tile.
 */
export function Mark({
  size = 72,
  muted = false,
  glyph = 'mark',
  style,
  scheme,
  testID = 'mark',
}: MarkProps) {
  const { theme, rt } = useUnistyles();
  const dark = scheme ? scheme === 'dark' : rt.themeName === 'dark';
  const colors = scheme ? (dark ? darkColors : lightColors) : theme.colors;
  const art = !muted && glyph === 'mark';

  return (
    <Animated.View
      style={[styles.tile(size, art ? 'transparent' : colors.surfaceMuted), style]}
      {...decorative}
      testID={testID}
    >
      {art ? (
        <SvgXml
          xml={markSvg(dark ? 'dark' : 'light')}
          width={size}
          height={size}
          testID={`${testID}-${dark ? 'dark' : 'light'}`}
        />
      ) : (
        <IconGlyph
          path={glyph}
          size={markGlyphSize(size)}
          strokeWidth={1.5}
          color={colors.textTertiary}
        />
      )}
    </Animated.View>
  );
}
