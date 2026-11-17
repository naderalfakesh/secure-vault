import { StatusBar } from 'expo-status-bar';
import Animated from 'react-native-reanimated';

import { Mark } from '@/components/ui';

import { SPLASH_BACKGROUND, SPLASH_MARK } from './constants';
import { styles } from './SplashHandoff.styles';
import type { SplashHandoffProps } from './types';
import { useHandoffFade } from './useHandoffFade';

/**
 * Picks up where the native splash leaves off: the same background and
 * the same 138 pt mark in the same place. Once the native splash hides, the
 * screen underneath is already drawn with its own mark in place, and the
 * overlay simply cross-fades out over 200 ms. Nothing travels, so there is
 * never a second moving mark. With reduced motion it goes at once. It never
 * takes touches, is hidden from assistive tech, and is gone at the latest
 * 1.5 s after release.
 *
 * When the pinned Appearance differs from the system scheme there is no fade:
 * a cross-fade between a light and a dark screen reads as a flicker, and the
 * screen underneath may still be settling into the pinned theme. The overlay
 * keeps the system colours (and the status bar to match), covers everything
 * for the length of the fade, then goes at once: one clean switch.
 */
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
      {/* The status bar matches the overlay, not the pinned scheme, while it shows. */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Mark size={SPLASH_MARK} scheme={scheme} testID="splash-handoff-mark" />
    </Animated.View>
  );
}
