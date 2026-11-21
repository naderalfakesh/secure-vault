import { ActivityIndicator, Pressable, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { Icon } from '../Icon';
import { Text } from '../Text';
import { styles } from './Button.styles';
import { buttonFill, isPlainVariant } from './helpers';
import type { ButtonProps } from './types';

/** Capsule button. Disabled buttons change colour, not just opacity. */
export function Button({
  label,
  variant = 'primary',
  size = 'lg',
  disabled,
  loading = false,
  loadingLabel,
  icon,
  accessibilityState,
  ...props
}: ButtonProps) {
  const { theme } = useUnistyles();
  const isDisabled = Boolean(disabled) || loading;
  const plain = isPlainVariant(variant);
  // A busy button keeps its colours so the spinner reads as progress, not as "off".
  const fill = buttonFill(variant, Boolean(disabled), loading);
  const foreground = theme.colors[fill.foreground];
  const shownLabel = loading ? (loadingLabel ?? label) : label;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={shownLabel}
      hitSlop={size === 'md' ? 6 : 0}
      {...props}
      accessibilityState={{ disabled: isDisabled, busy: loading, ...accessibilityState }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base(size, plain),
        {
          backgroundColor:
            fill.background === 'transparent' ? 'transparent' : theme.colors[fill.background],
        },
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={foreground} size="small" />
        ) : icon ? (
          <Icon name={icon} size={size === 'lg' ? 20 : 18} color={foreground} />
        ) : null}
        <Text
          variant={size === 'lg' ? 'headline' : 'subheadline'}
          style={[styles.label, { color: foreground }]}
        >
          {shownLabel}
        </Text>
      </View>
    </Pressable>
  );
}
