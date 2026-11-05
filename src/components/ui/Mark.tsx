import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { useUnistyles } from 'react-native-unistyles';

import { darkColors, lightColors } from '@/theme/colors';

import { IconGlyph } from './Icon';
import type { IconPath } from './iconPaths';

export type MarkProps = {
  /** Squircle size: 64 on the lock screen, 72 on the splash, 80 on the privacy cover. */
  size?: number;
  /** Quiet variant for a paused state, such as the PIN lockout. */
  muted?: boolean;
  /** The glyph inside the squircle; the lockout shows the clock instead of the mark. */
  glyph?: IconPath;
  /** Style for the squircle, e.g. an animated transform. */
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

/** The glyph size the mark draws inside a squircle of this size. */
export function markGlyphSize(size: number): number {
  return glyphSizes[size] ?? Math.round(size * 0.6);
}

/**
 * The SecureVault mark: the outline document-with-padlock
 * glyph, drawn from the design's SVG path at a 1.5 stroke, on an indigo
 * squircle. Dark mode uses the muted indigo with an indigo glyph, as the dark
 * splash does. The splash image, the lock screen, and the privacy cover share
 * these proportions.
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
  const glyphSize = markGlyphSize(size);

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          // 18 on 64, 20 on 72, 22 on 80: the design's corners, drawn as plain
          // round corners so the mark matches the native splash image exactly.
          borderRadius: Math.round(size * 0.28),
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: muted
            ? colors.surfaceMuted
            : dark
              ? colors.primaryMuted
              : colors.primary,
        },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      <IconGlyph
        path={glyph}
        size={glyphSize}
        strokeWidth={1.5}
        color={muted ? colors.textTertiary : dark ? colors.primary : colors.onPrimary}
      />
    </Animated.View>
  );
}
