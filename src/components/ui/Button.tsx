import { ActivityIndicator, Pressable, type PressableProps, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

export type ButtonProps = Omit<PressableProps, 'style'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Optional leading element, usually an icon. */
  leading?: React.ReactNode;
};

const inverseVariants: ReadonlySet<ButtonVariant> = new Set(['primary', 'danger']);

export function Button({
  label,
  variant = 'primary',
  size = 'lg',
  disabled,
  loading,
  leading,
  ...props
}: ButtonProps) {
  const { theme } = useUnistyles();
  const isDisabled = Boolean(disabled) || Boolean(loading);
  const tone = inverseVariants.has(variant)
    ? 'inverse'
    : variant === 'danger'
      ? 'danger'
      : 'accent';
  const spinnerColor = inverseVariants.has(variant) ? theme.colors.onPrimary : theme.colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      hitSlop={size === 'md' ? 6 : 0}
      {...props}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base(variant, size),
        pressed && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator color={spinnerColor} size="small" /> : leading}
        <Text variant="headline" tone={tone}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  base: (variant: ButtonVariant, size: ButtonSize) => ({
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: size === 'lg' ? 52 : theme.touchTarget,
    paddingHorizontal: size === 'lg' ? theme.spacing.lg : theme.spacing.md,
    borderRadius: theme.radii.lg,
    ...(variant === 'primary' && { backgroundColor: theme.colors.primary }),
    ...(variant === 'danger' && { backgroundColor: theme.colors.danger }),
    ...(variant === 'secondary' && {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
    }),
    ...(variant === 'ghost' && { backgroundColor: 'transparent' }),
  }),
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.45,
  },
}));
