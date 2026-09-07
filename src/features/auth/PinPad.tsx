import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { Icon, type IconName, Text } from '@/components/ui';

export type PinDotsProps = {
  count?: number;
  filled: number;
  error?: boolean;
  /** Increment to play the shake. */
  shake?: number;
};

export function PinDots({ count = 6, filled, error = false, shake = 0 }: PinDotsProps) {
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(0);

  useEffect(() => {
    if (!shake || reduceMotion) return;
    offset.value = withSequence(
      withTiming(-9, { duration: 60 }),
      withTiming(8, { duration: 60 }),
      withTiming(-6, { duration: 60 }),
      withTiming(5, { duration: 60 }),
      withTiming(0, { duration: 60 }),
    );
  }, [shake, reduceMotion, offset]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  return (
    <Animated.View
      style={[styles.dots, style]}
      accessibilityLabel={`${filled} of ${count} digits entered`}
      accessibilityLiveRegion="polite"
    >
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.dot(index < filled, error)} />
      ))}
    </Animated.View>
  );
}

export type PinKeypadProps = {
  onKey: (key: string) => void;
  onBiometric?: () => void;
  biometricIcon?: IconName;
  disabled?: boolean;
};

export function PinKeypad({ onKey, onBiometric, biometricIcon, disabled = false }: PinKeypadProps) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', onBiometric ? 'bio' : '', '0', 'del'];

  return (
    <View style={styles.pad} pointerEvents={disabled ? 'none' : 'auto'}>
      {keys.map((key, index) => {
        if (key === '') return <View key={index} style={styles.cell} />;
        const isAction = key === 'del' || key === 'bio';
        return (
          <View key={index} style={styles.cell}>
            <Pressable
              onPress={() => (key === 'bio' ? onBiometric?.() : onKey(key))}
              accessibilityRole="button"
              accessibilityLabel={key === 'del' ? 'Delete' : key === 'bio' ? 'Use biometrics' : key}
              style={({ pressed }) => [styles.key(isAction), pressed && styles.pressed]}
            >
              {key === 'del' ? (
                <Icon name="back" size={24} />
              ) : key === 'bio' ? (
                <Icon name={biometricIcon ?? 'faceId'} size={28} tone="accent" />
              ) : (
                <Text variant="title2">{key}</Text>
              )}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  dots: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'center',
  },
  dot: (on: boolean, error: boolean) => ({
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: error
      ? theme.colors.danger
      : on
        ? theme.colors.primary
        : theme.colors.borderStrong,
    backgroundColor: error ? theme.colors.danger : on ? theme.colors.primary : 'transparent',
  }),
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    maxWidth: 300,
    alignSelf: 'center',
    width: '100%',
  },
  cell: {
    width: '33.33%',
    padding: 5,
    height: 74,
  },
  key: (isAction: boolean) => ({
    flex: 1,
    borderRadius: theme.radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isAction ? 'transparent' : theme.colors.surface,
    borderWidth: isAction ? 0 : StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  }),
  pressed: {
    opacity: 0.6,
  },
}));
