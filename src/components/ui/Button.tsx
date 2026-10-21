import { ActivityIndicator, Pressable, type PressableProps, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { Palette } from '@/theme/colors';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ButtonVariant =
  | 'primary'
  | 'tinted'
  | 'plain'
  | 'plainDestructive'
  | 'secondary'
  | 'destructive'
  | 'destructiveSoft';
export type ButtonSize = 'md' | 'lg';

export type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: ButtonVariant;
  /** Large is 52 pt high, medium 44. */
  size?: ButtonSize;
  /** Shows a spinner and blocks presses; pair it with a verb-ing `loadingLabel`. */
  loading?: boolean;
  /** Label while loading, e.g. "Encrypting…". Defaults to `label`. */
  loadingLabel?: string;
  /** Optional leading icon, coloured to match the label. */
  icon?: IconName;
};

type Fill = { background: keyof Palette | 'transparent'; foreground: keyof Palette };

const fills: Record<ButtonVariant | 'disabled', Fill> = {
  primary: { background: 'primary', foreground: 'onPrimary' },
  tinted: { background: 'primaryMuted', foreground: 'primary' },
  plain: { background: 'transparent', foreground: 'primary' },
  /** Text-only destructive action, e.g. "Delete 3" in a toolbar. */
  plainDestructive: { background: 'transparent', foreground: 'danger' },
  secondary: { background: 'surfaceMuted', foreground: 'textPrimary' },
  destructive: { background: 'danger', foreground: 'onDanger' },
  destructiveSoft: { background: 'dangerMuted', foreground: 'danger' },
  disabled: { background: 'surfaceMuted', foreground: 'textTertiary' },
};

/** Capsule button (handover §4). Disabled buttons change colour, not just opacity. */
export function Button({
  label,
  variant = 'primary',
  size = 'lg',
  disabled,
  loading = false,
  loadingLabel,
  icon,
  ...props
}: ButtonProps) {
  const { theme } = useUnistyles();
  const isDisabled = Boolean(disabled) || loading;
  // A busy button keeps its colours so the spinner reads as progress, not as "off".
  const plain = variant === 'plain' || variant === 'plainDestructive';
  // A disabled text button stays unfilled; only its label greys out.
  const fill =
    disabled && !loading
      ? plain
        ? { background: 'transparent' as const, foreground: 'textTertiary' as const }
        : fills.disabled
      : fills[variant];
  const foreground = theme.colors[fill.foreground];
  const shownLabel = loading ? (loadingLabel ?? label) : label;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={shownLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      hitSlop={size === 'md' ? 6 : 0}
      {...props}
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
          numberOfLines={2}
        >
          {shownLabel}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  base: (size: ButtonSize, plain: boolean) => ({
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: size === 'lg' ? theme.controlSize.buttonLarge : theme.controlSize.buttonMedium,
    paddingHorizontal: plain ? theme.spacing.xs : size === 'lg' ? theme.spacing.lg : 18,
    borderRadius: theme.radii.pill,
  }),
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  label: {
    fontWeight: '600',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
}));
