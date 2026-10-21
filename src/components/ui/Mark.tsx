import { View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { IconGlyph } from './Icon';
import type { IconPath } from './iconPaths';

export type MarkProps = {
  /** Squircle size: 64 on the lock screen, 72 on the splash, 80 on the privacy cover. */
  size?: number;
  /** Quiet variant for a paused state, such as the PIN lockout. */
  muted?: boolean;
  /** The glyph inside the squircle; the lockout shows the clock instead of the mark. */
  glyph?: IconPath;
};

/** Glyph sizes from the design (Lock board, §3.5 splash, privacy cover). */
const glyphSizes: Record<number, number> = { 64: 38, 72: 44, 80: 46 };

/**
 * The SecureVault mark (handover §3.5): the outline document-with-padlock
 * glyph, drawn from the design's SVG path at a 1.5 stroke, on an indigo
 * squircle. Dark mode uses the muted indigo with an indigo glyph, as the dark
 * splash does. The splash image, the lock screen, and the privacy cover share
 * these proportions.
 */
export function Mark({ size = 72, muted = false, glyph = 'mark' }: MarkProps) {
  const { theme, rt } = useUnistyles();
  const dark = rt.themeName === 'dark';
  const glyphSize = glyphSizes[size] ?? Math.round(size * 0.6);

  return (
    <View
      style={{
        width: size,
        height: size,
        // 18 on 64, 20 on 72, 22 on 80: the design's squircle corners.
        borderRadius: Math.round(size * 0.28),
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: muted
          ? theme.colors.surfaceMuted
          : dark
            ? theme.colors.primaryMuted
            : theme.colors.primary,
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="mark"
    >
      <IconGlyph
        path={glyph}
        size={glyphSize}
        strokeWidth={1.5}
        color={
          muted ? theme.colors.textTertiary : dark ? theme.colors.primary : theme.colors.onPrimary
        }
      />
    </View>
  );
}
