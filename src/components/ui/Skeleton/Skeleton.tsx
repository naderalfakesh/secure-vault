import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { decorative } from '../a11y';
import { PULSE_MIN_OPACITY, PULSE_MS, PULSE_RANGE } from './constants';
import { styles } from './Skeleton.styles';
import type { SkeletonProps } from './types';

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
  testID,
}: SkeletonProps) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(pulse);
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: PULSE_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: PULSE_MIN_OPACITY + pulse.value * PULSE_RANGE,
  }));

  return (
    <Animated.View
      {...decorative}
      testID={testID}
      style={[styles.base, animatedStyle, { width, height, borderRadius }, style]}
    />
  );
}
