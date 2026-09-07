import type { ReactNode } from 'react';
import { Pressable, type PressableProps, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Icon, type IconName } from './Icon';
import { Text, type TextTone } from './Text';

export type ListRowProps = Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconTone?: TextTone;
  /** Trailing element; defaults to a chevron when the row is pressable. */
  trailing?: ReactNode;
  tone?: 'default' | 'danger';
  /** Draw the separator below the row. */
  divider?: boolean;
};

/** Settings-style row: icon, title, optional subtitle, trailing control. */
export function ListRow({
  title,
  subtitle,
  icon,
  iconTone = 'accent',
  trailing,
  tone = 'default',
  divider = true,
  onPress,
  disabled,
  ...props
}: ListRowProps) {
  const isPressable = Boolean(onPress) && !disabled;
  const titleTone: TextTone = tone === 'danger' ? 'danger' : 'primary';

  return (
    <Pressable
      accessibilityRole={isPressable ? 'button' : undefined}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityState={{ disabled: Boolean(disabled) }}
      {...props}
      onPress={onPress}
      disabled={!isPressable}
      style={({ pressed }) => [styles.row(divider), pressed && isPressable && styles.pressed]}
    >
      {icon ? (
        <View style={styles.iconWrap}>
          <Icon name={icon} size={20} tone={tone === 'danger' ? 'danger' : iconTone} />
        </View>
      ) : null}
      <View style={styles.body}>
        <Text variant="body" tone={titleTone}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? (isPressable ? <Icon name="chevronRight" size={16} tone="tertiary" /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: (divider: boolean) => ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 56,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: divider ? StyleSheet.hairlineWidth : 0,
    borderBottomColor: theme.colors.border,
  }),
  pressed: { backgroundColor: theme.colors.surfaceMuted },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: theme.radii.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceMuted,
  },
  body: {
    flex: 1,
    gap: 2,
  },
}));
