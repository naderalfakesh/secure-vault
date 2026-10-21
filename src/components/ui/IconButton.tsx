import { BlurView } from 'expo-blur';
import { Pressable, type PressableProps, StyleSheet as NativeStyleSheet } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Icon, type IconName } from './Icon';
import type { TextTone } from './Text';

export type IconButtonVariant = 'tinted' | 'plain' | 'filled' | 'glass';

export type IconButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  icon: IconName;
  /** Required: icon-only controls need a spoken name. */
  accessibilityLabel: string;
  tone?: TextTone;
  /** Glyph size; the button itself is always a 44 pt circle. */
  size?: number;
  /**
   * `tinted` (default) is the surfaceMuted circle, `plain` has no fill,
   * `filled` is primary, and `glass` is the viewer's control over the dark stage.
   */
  variant?: IconButtonVariant;
};

export function IconButton({
  icon,
  accessibilityLabel,
  tone,
  size = 20,
  variant = 'tinted',
  disabled,
  ...props
}: IconButtonProps) {
  const glass = variant === 'glass';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      hitSlop={4}
      {...props}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base(variant),
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {glass ? <BlurView intensity={30} tint="dark" style={NativeStyleSheet.absoluteFill} /> : null}
      {glass ? (
        <Icon name={icon} size={size} color="#FFFFFF" />
      ) : (
        <Icon
          name={icon}
          size={size}
          tone={tone ?? (variant === 'filled' ? 'inverse' : 'primary')}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  base: (variant: IconButtonVariant) => ({
    width: theme.touchTarget,
    height: theme.touchTarget,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...(variant === 'tinted' && { backgroundColor: theme.colors.surfaceMuted }),
    ...(variant === 'filled' && { backgroundColor: theme.colors.primary }),
    ...(variant === 'glass' && {
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    }),
  }),
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
}));
