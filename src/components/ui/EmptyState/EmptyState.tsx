import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '../Button';
import { Icon } from '../Icon';
import { Text } from '../Text';
import { ENTER_MS, ENTER_RISE } from './constants';
import { styles } from './EmptyState.styles';
import type { EmptyStateProps } from './types';

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  testID,
}: EmptyStateProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
  }, [progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * ENTER_RISE }],
  }));

  return (
    <Animated.View
      accessibilityRole="summary"
      testID={testID}
      style={[styles.container, animatedStyle]}
    >
      <View style={styles.iconWrap}>
        <Icon name={icon} size={30} tone="accent" />
      </View>
      <Text variant="title3" align="center">
        {title}
      </Text>
      <Text variant="body" tone="secondary" align="center" style={styles.description}>
        {description}
      </Text>
      {(actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction) ? (
        <View style={styles.actions}>
          {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
          {secondaryActionLabel && onSecondaryAction ? (
            <Button label={secondaryActionLabel} onPress={onSecondaryAction} variant="plain" />
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}
