import { type ReactNode, useRef } from 'react';
import { Pressable, type PressableProps, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { Palette } from '@/theme/colors';
import { textScale } from '@/theme/tokens';

import { useInGroup } from './Group';
import { Icon, type IconName } from './Icon';
import { Switch } from './Switch';
import { Text, type TextTone } from './Text';
import { useLargeText } from './useLargeText';

/** Fill of the leading 30 pt icon tile. */
export type ListRowTint = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

export type ListRowProps = Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  /** Second line; for a disabled row, say why it is disabled here. */
  subtitle?: string;
  icon?: IconName;
  tint?: ListRowTint;
  /** @deprecated Use `tint`. Kept so existing rows keep their colour. */
  iconTone?: TextTone;
  /** Trailing value text, e.g. "After 1 minute". */
  value?: string;
  /** Trailing switch; pressing the row toggles it. */
  toggle?: { value: boolean; onValueChange: (value: boolean) => void };
  /** Radio row: shows a checkmark when true. */
  checked?: boolean;
  /** Custom trailing element; replaces the chevron. */
  trailing?: ReactNode;
  /** Destructive title colour, e.g. "Delete everything". */
  destructive?: boolean;
  /** @deprecated Use `destructive`. */
  tone?: 'default' | 'danger';
  /** Separator below the row when it is not inside a Group. */
  divider?: boolean;
};

const tintFromTone: Partial<Record<TextTone, ListRowTint>> = {
  accent: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

const tileColors: Record<ListRowTint, { fill: keyof Palette; glyph: keyof Palette }> = {
  primary: { fill: 'primary', glyph: 'onPrimary' },
  success: { fill: 'success', glyph: 'onSuccess' },
  // Brass has no "on" colour of its own; onPrimary passes AA on it in both modes.
  warning: { fill: 'warning', glyph: 'onPrimary' },
  danger: { fill: 'danger', glyph: 'onDanger' },
  neutral: { fill: 'surfaceMuted', glyph: 'textSecondary' },
};

/**
 * Settings-style row: leading icon tile, title, optional
 * subtitle, and a trailing chevron, value, switch, checkmark, or nothing.
 */
export function ListRow({
  title,
  subtitle,
  icon,
  tint,
  iconTone,
  value,
  toggle,
  checked,
  trailing,
  destructive,
  tone = 'default',
  divider,
  onPress,
  disabled,
  ...props
}: ListRowProps) {
  const { theme } = useUnistyles();
  const inGroup = useInGroup();
  // At the accessibility sizes the value moves under the title, so neither
  // is squeezed into a sliver of the row.
  const stacked = useLargeText();
  const isDestructive = destructive ?? tone === 'danger';
  // A switch row toggles from a tap anywhere on it, its label included, or
  // from a screen reader's activation of the row.
  const handlePress = toggle ? undefined : onPress;
  // A screen reader's activation may arrive both as the action and as a press.
  const lastActivation = useRef(0);
  const isPressable = Boolean(handlePress) && !disabled;
  const isRadio = checked !== undefined;
  const tileTint =
    tint ??
    (isDestructive ? 'danger' : iconTone ? (tintFromTone[iconTone] ?? 'neutral') : 'primary');
  const tile = tileColors[tileTint];
  const showDivider = divider ?? !inGroup;

  const role = isRadio ? 'radio' : isPressable ? 'button' : undefined;
  const label = [title, value, subtitle].filter(Boolean).join(', ');
  const titleTone: TextTone = disabled ? 'tertiary' : isDestructive ? 'danger' : 'primary';

  let accessory: ReactNode = null;
  if (trailing !== undefined) {
    accessory = trailing;
  } else if (toggle) {
    // The row is the one accessible switch; the native one would be a second
    // stop, and a second touch target that could toggle twice with the row.
    accessory = (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      >
        <Switch
          value={toggle.value}
          onValueChange={toggle.onValueChange}
          disabled={disabled}
          testID="list-row-switch"
        />
      </View>
    );
  } else if (isRadio) {
    accessory = checked ? <Icon name="check" size={18} tone="accent" /> : null;
  } else if (isPressable && !isDestructive) {
    accessory = <Icon name="chevronRight" size={18} tone="tertiary" />;
  }

  // Row text stops at 2.4× (between AX2 and AX3) so a single word such as
  // "Immediately" always fits the row and wraps whole, never mid-word.
  const valueText = (
    <Text
      variant="body"
      tone="secondary"
      maxFontSizeMultiplier={textScale.rowMax}
      style={stacked ? null : styles.value}
    >
      {value}
    </Text>
  );

  const body = (
    <>
      {icon ? (
        <View style={[styles.tile, { backgroundColor: theme.colors[tile.fill] }]}>
          <Icon name={icon} size={18} color={theme.colors[tile.glyph]} />
        </View>
      ) : null}
      <View style={styles.body}>
        <Text variant="body" tone={titleTone} maxFontSizeMultiplier={textScale.rowMax}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" tone="secondary" maxFontSizeMultiplier={textScale.rowMax}>
            {subtitle}
          </Text>
        ) : null}
        {value && stacked ? valueText : null}
      </View>
      {value && !stacked ? valueText : null}
      {accessory}
    </>
  );

  if (toggle) {
    const flip = () => {
      if (!disabled) toggle.onValueChange(!toggle.value);
    };
    return (
      <Pressable
        accessible
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ disabled: Boolean(disabled), checked: toggle.value }}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName !== 'activate') return;
          lastActivation.current = Date.now();
          flip();
        }}
        onPress={() => {
          if (Date.now() - lastActivation.current < 500) return;
          flip();
        }}
        disabled={Boolean(disabled)}
        testID={props.testID}
        style={({ pressed }) => [
          styles.row(Boolean(subtitle), showDivider),
          pressed && !disabled && styles.pressed,
        ]}
      >
        {body}
      </Pressable>
    );
  }

  // A row with nothing to do (an info row such as "Version") is not a
  // pressable at all, so it reads as text rather than an unnamed control.
  // A disabled row keeps its button role and states that it is disabled.
  if (!handlePress && !isRadio) {
    return (
      <View
        accessible
        accessibilityLabel={label}
        accessibilityState={disabled ? { disabled: true } : undefined}
        testID={props.testID}
        style={styles.row(Boolean(subtitle), showDivider)}
      >
        {body}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{
        disabled: Boolean(disabled),
        ...(isRadio ? { checked } : null),
      }}
      {...props}
      onPress={handlePress}
      disabled={!isPressable}
      style={({ pressed }) => [
        styles.row(Boolean(subtitle), showDivider),
        pressed && isPressable && styles.pressed,
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: (hasSubtitle: boolean, divider: boolean) => ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: hasSubtitle ? 60 : 52,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: divider ? StyleSheet.hairlineWidth : 0,
    borderBottomColor: theme.colors.border,
  }),
  pressed: { backgroundColor: theme.colors.surfaceMuted },
  tile: {
    width: theme.controlSize.iconTile,
    height: theme.controlSize.iconTile,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  value: {
    flexShrink: 1,
  },
}));
