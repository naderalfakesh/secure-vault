import { GlassView } from 'expo-glass-effect';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { GlassBackgroundProps } from './types';

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
