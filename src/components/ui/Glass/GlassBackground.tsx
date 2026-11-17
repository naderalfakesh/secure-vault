import { GlassView } from 'expo-glass-effect';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { GlassBackgroundProps } from './types';

/**
 * The glass layer behind a chrome surface: fills its parent, follows the
 * app's own light or dark choice, and takes the parent's corner radii.
 */
export function GlassBackground({ style }: GlassBackgroundProps) {
  const { rt } = useUnistyles();
  return (
    <GlassView
      glassEffectStyle="regular"
      colorScheme={rt.themeName === 'dark' ? 'dark' : 'light'}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
    />
  );
}
