import { Pressable, type PressableProps, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { t } from '@/i18n';
import type { Palette } from '@/theme/colors';
import { isolate, LRI, PDI } from '@/utils/bidi';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/**
 * `filter` (default) toggles a collection or filter, `status` is the brass
 * expiry chip, `success` marks "Searchable", and `tag` is an outlined `# tag`.
 */
export type ChipVariant = 'filter' | 'status' | 'success' | 'tag';

export type ChipProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  icon?: IconName;
  variant?: ChipVariant;
  selected?: boolean;
  /** Small count rendered after the label, e.g. documents in a category. */
  count?: number;
  /** Adds a remove (×) control with a 24 pt hit area. */
  onRemove?: () => void;
};

const colours: Record<ChipVariant, { fill: keyof Palette | 'transparent'; ink: keyof Palette }> = {
  filter: { fill: 'surfaceMuted', ink: 'textPrimary' },
  status: { fill: 'accentMuted', ink: 'accent' },
  success: { fill: 'successMuted', ink: 'success' },
  tag: { fill: 'transparent', ink: 'textPrimary' },
};

export function Chip({
  label,
  icon,
  variant = 'filter',
  selected = false,
  count,
  onRemove,
  onPress,
  disabled,
  accessibilityLabel,
  ...props
}: ChipProps) {
  const { theme } = useUnistyles();
  const on = variant === 'filter' && selected;
  const scheme = colours[variant];
  const ink = on ? theme.colors.onPrimary : theme.colors[scheme.ink];
  const fill = on
    ? theme.colors.primary
    : scheme.fill === 'transparent'
      ? 'transparent'
      : theme.colors[scheme.fill];
  const text = variant === 'tag' ? `# ${label}` : label;
  // "# " in a left-to-right isolate with the tag in its own: a tag of digits
  // only would otherwise read "2026 #" in a right-to-left layout.
  const shown = variant === 'tag' ? `${LRI}# ${isolate(label)}${PDI}` : label;
  const spoken = accessibilityLabel ?? (count === undefined ? text : `${text}, ${count}`);
  const leading: IconName | undefined = icon ?? (on ? 'check' : undefined);
  const pressable = Boolean(onPress);

  const content = (
    <>
      {leading ? <Icon name={leading} size={16} color={ink} /> : null}
      <Text variant="subheadline" style={[styles.label, { color: ink }]}>
        {shown}
      </Text>
      {count !== undefined ? (
        <Text
          variant="footnote"
          style={{ color: on ? theme.colors.onPrimary : theme.colors.textTertiary }}
        >
          {count}
        </Text>
      ) : null}
    </>
  );

  const removeButton = onRemove ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('ui.chip.remove', { label: isolate(label) })}
      onPress={onRemove}
      disabled={disabled}
      hitSlop={10}
      style={styles.remove}
    >
      <Icon name="close" size={14} color={ink} />
    </Pressable>
  ) : null;

  const chipStyle = [styles.base(variant === 'tag'), { backgroundColor: fill }];

  if (!pressable) {
    return (
      <View style={chipStyle} testID={props.testID}>
        <View accessible accessibilityLabel={spoken} style={styles.inner}>
          {content}
        </View>
        {removeButton}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on, disabled: Boolean(disabled) }}
      accessibilityLabel={spoken}
      // The chip is one element to a screen reader, so removing is a custom action.
      accessibilityActions={
        onRemove
          ? [{ name: 'remove', label: t('ui.chip.remove', { label: isolate(label) }) }]
          : undefined
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'remove') onRemove?.();
      }}
      hitSlop={4}
      {...props}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [...chipStyle, pressed && styles.pressed]}
    >
      <View style={styles.inner}>{content}</View>
      {removeButton}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  base: (outlined: boolean) => ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs + 2,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: theme.radii.pill,
    borderWidth: outlined ? 1 : 0,
    borderColor: theme.colors.borderStrong,
  }),
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs + 2,
    flexShrink: 1,
  },
  label: {
    fontWeight: '500',
  },
  remove: {
    width: 24,
    height: 24,
    marginEnd: -theme.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
}));
