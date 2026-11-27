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
