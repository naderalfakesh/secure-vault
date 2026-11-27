import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { t } from '@/i18n';

import { decorative } from '../a11y';
import { Text } from '../Text';
import { RING, RING_LENGTH, RING_RADIUS, RING_STROKE } from './constants';
import { styles } from './Countdown.styles';
import type { CountdownProps } from './types';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function Countdown({ durationMs, still }: CountdownProps) {
  const { theme } = useUnistyles();
  const seconds = Math.round(durationMs / 1000);
  const [left, setLeft] = useState(seconds);
  const drained = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    drained.value = withTiming(1, { duration: durationMs, easing: Easing.linear });
    const interval = setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(interval);
  }, [still, durationMs, drained]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_LENGTH * drained.value,
  }));

  return (
    <View style={styles.ring} {...decorative} testID="toast-countdown">
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={theme.colors.toastText}
          strokeOpacity={0.2}
          strokeWidth={RING_STROKE}
        />
        <AnimatedCircle
          cx={RING / 2}
          cy={RING / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={theme.colors.toastAction}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={`${RING_LENGTH} ${RING_LENGTH}`}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          animatedProps={arcProps}
          testID="toast-countdown-arc"
        />
      </Svg>
      <Text variant="caption" style={styles.ringLabel}>
        {still ? t('ui.toast.seconds', { count: seconds }) : left}
      </Text>
    </View>
  );
}
