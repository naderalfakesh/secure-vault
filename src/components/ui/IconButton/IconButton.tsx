import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet as NativeStyleSheet } from 'react-native';

import { Icon } from '../Icon';
import type { IconButtonProps } from './types';
import { styles } from './IconButton.styles';

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
