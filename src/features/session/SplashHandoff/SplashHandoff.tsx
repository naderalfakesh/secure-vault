import { StatusBar } from 'expo-status-bar';
import Animated from 'react-native-reanimated';

import { Mark } from '@/components/ui';

import { SPLASH_BACKGROUND, SPLASH_MARK } from './constants';
import { styles } from './SplashHandoff.styles';
import type { SplashHandoffProps } from './types';
import { useHandoffFade } from './useHandoffFade';

// Mirrors the native splash and cross-fades out; snaps cleanly if pinned theme differs from system.
export function SplashHandoff({ released, onDone }: SplashHandoffProps) {
  const { scheme, gone, fadeStyle } = useHandoffFade({ released, onDone });

  if (gone) return null;

  return (
    <Animated.View
      style={[styles.root, { backgroundColor: SPLASH_BACKGROUND[scheme] }, fadeStyle]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="splash-handoff"
    >
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Mark size={SPLASH_MARK} scheme={scheme} testID="splash-handoff-mark" />
    </Animated.View>
  );
}
