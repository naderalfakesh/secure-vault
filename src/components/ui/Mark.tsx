import { View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { Icon } from './Icon';

export type MarkProps = {
  /** Squircle size; the glyph is about 60% of it. */
  size?: number;
};

/**
 * The SecureVault mark (handover §3.5): a document with a padlock on an
 * indigo squircle; dark mode uses the muted indigo with an indigo glyph. The
 * splash, the lock screen, and the privacy cover share it. The glyph is the
 * nearest system symbol until the mark ships as an image asset.
 */
export function Mark({ size = 72 }: MarkProps) {
  const { theme, rt } = useUnistyles();
  const dark = rt.themeName === 'dark';

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: dark ? theme.colors.primaryMuted : theme.colors.primary,
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Icon
        name="mark"
        size={Math.round(size * 0.6)}
        color={dark ? theme.colors.primary : theme.colors.onPrimary}
      />
    </View>
  );
}
