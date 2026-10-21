import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type EmptyStateProps = {
  icon: IconName;
  title: string;
  description: string;
  /** Primary action, e.g. "Scan a document". */
  actionLabel?: string;
  onAction?: () => void;
  /** Optional secondary action, e.g. "Import from Files or Photos". */
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  testID?: string;
};

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
    progress.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 10 }],
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

const styles = StyleSheet.create((theme) => ({
  container: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryMuted,
    marginBottom: theme.spacing.xs,
  },
  description: {
    maxWidth: 320,
  },
  actions: {
    marginTop: theme.spacing.sm,
    alignSelf: 'stretch',
    gap: theme.spacing.xs,
  },
}));
