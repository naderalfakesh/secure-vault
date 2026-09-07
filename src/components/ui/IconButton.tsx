import { Pressable, type PressableProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Icon, type IconName } from './Icon';
import type { TextTone } from './Text';

export type IconButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  icon: IconName;
  /** Required: icon-only controls need a spoken name. */
  accessibilityLabel: string;
  tone?: TextTone;
  size?: number;
  variant?: 'plain' | 'filled' | 'tinted';
};

export function IconButton({
  icon,
  accessibilityLabel,
  tone = 'primary',
  size = 22,
  variant = 'plain',
  disabled,
  ...props
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      hitSlop={8}
      {...props}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base(variant),
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Icon name={icon} size={size} tone={variant === 'filled' ? 'inverse' : tone} />
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  base: (variant: 'plain' | 'filled' | 'tinted') => ({
    width: theme.touchTarget,
    height: theme.touchTarget,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...(variant === 'filled' && { backgroundColor: theme.colors.primary }),
    ...(variant === 'tinted' && { backgroundColor: theme.colors.surfaceMuted }),
  }),
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
}));
