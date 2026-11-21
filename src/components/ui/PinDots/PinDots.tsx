import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { t } from '@/i18n';
import { motion } from '@/theme/tokens';

import { useAnnouncement } from '../announce';
import { styles } from './PinDots.styles';
import type { PinDotsProps } from './types';

/** PIN progress: 6 × 14 pt dots that announce "N of 6 digits entered". */
export function PinDots({ count = 6, filled, error = false, shake = 0 }: PinDotsProps) {
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(0);

  useEffect(() => {
    if (!shake || reduceMotion) return;
    const { distance, swings, durationMs } = motion.shake;
    const step = durationMs / (swings * 2);
    const steps = Array.from({ length: swings * 2 - 1 }, (_, index) =>
      withTiming(index % 2 === 0 ? distance : -distance, { duration: step }),
    );
    offset.value = withSequence(...steps, withTiming(0, { duration: step }));
  }, [shake, reduceMotion, offset]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const label = t('ui.pinDots.entered', { filled, count });
  // Android speaks the live region itself; iOS needs the announcement. An
  // empty row is not announced, so a reset after a wrong PIN leaves the
  // error sentence to speak.
  useAnnouncement(label, filled > 0);

  return (
    <Animated.View
      accessible
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      style={[styles.dots, style]}
    >
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={styles.dot(error ? 'error' : index < filled ? 'filled' : 'empty')}
          testID={`pin-dot-${index}`}
        />
      ))}
    </Animated.View>
  );
}
