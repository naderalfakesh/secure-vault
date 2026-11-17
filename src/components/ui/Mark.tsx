import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import { useUnistyles } from 'react-native-unistyles';

import { markSvg } from '@/brand/folio';
import { darkColors, lightColors } from '@/theme/colors';

import { IconGlyph } from './Icon';
import type { IconPath } from './iconPaths';

export type MarkProps = {
  /** Tile size: 64 on the lock screen, 80 on the privacy cover, 138 on the splash. */
  size?: number;
  /** Quiet variant for a paused state, such as the PIN lockout. */
  muted?: boolean;
  /** `mark` draws the sealed folio; another glyph, such as the lockout clock, draws the quiet outline style. */
  glyph?: IconPath;
  /** Style for the tile, e.g. an animated transform. */
  style?: StyleProp<AnimatedStyle<ViewStyle>>;
  /**
   * Draw in this scheme's colours instead of the app theme's. The splash
   * handoff repaints the native splash, which follows the system scheme.
   */
  scheme?: 'light' | 'dark';
  testID?: string;
};

/** Glyph sizes from the design (lock screen, splash, privacy cover). */
const glyphSizes: Record<number, number> = { 64: 38, 72: 44, 80: 46 };

/** The outline glyph size inside a tile of this size. */
export function markGlyphSize(size: number): number {
  return glyphSizes[size] ?? Math.round(size * 0.6);
}

/** The tile's corner radius on the 1024 canvas of `src/brand/folio.ts`. */
const TILE_CORNER = 230 / 1024;

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
      style={[
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * TILE_CORNER),
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: art ? 'transparent' : colors.surfaceMuted,
        },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
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
