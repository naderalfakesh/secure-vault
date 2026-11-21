import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet as NativeStyleSheet } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { Icon } from '../Icon';
import { styles } from './IconButton.styles';
import type { IconButtonProps } from './types';

export function IconButton({
  icon,
  accessibilityLabel,
  tone,
  size = 20,
  variant = 'tinted',
  disabled,
  ...props
}: IconButtonProps) {
  const { theme } = useUnistyles();
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
        <Icon name={icon} size={size} color={theme.colors.onStage} />
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
