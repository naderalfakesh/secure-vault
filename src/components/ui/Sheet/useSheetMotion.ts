import { useEffect } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useUnistyles } from 'react-native-unistyles';

import { CLOSE_MS, SLIDE } from './constants';

/**
 * The backdrop fade and the panel's slide for a sheet that is showing or
 * not. Reduced motion cross-fades instead of sliding.
 */
export function useSheetMotion(visible: boolean) {
  const { theme } = useUnistyles();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    const target = visible ? 1 : 0;
    if (reduceMotion) {
      // Reduced motion: a cross-fade instead of the slide.
      progress.value = withTiming(target, { duration: theme.motion.durationBase });
      return;
    }
    progress.value = visible
      ? withSpring(target, theme.motion.spring)
      : withTiming(target, { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) });
  }, [progress, reduceMotion, visible, theme.motion]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: Math.min(progress.value, 1) }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity: Math.min(progress.value, 1),
    transform: [{ translateY: reduceMotion ? 0 : (1 - progress.value) * SLIDE }],
  }));

  return { backdropStyle, panelStyle };
}
