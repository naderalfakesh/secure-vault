import { Pressable, View } from 'react-native';

import { useInGroup } from '../Group';
import type { TextTone } from '../Text';
import { rowLabel, rowTint } from './helpers';
import { styles } from './ListRow.styles';
import { ListRowAccessory } from './ListRowAccessory';
import { ListRowContent } from './ListRowContent';
import type { ListRowProps } from './types';
import { useSwitchActivation } from './useSwitchActivation';

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
  const inGroup = useInGroup();
  const isDestructive = destructive ?? tone === 'danger';
  // A switch row toggles from a tap anywhere on it, its label included, or
  // from a screen reader's activation of the row.
  const handlePress = toggle ? undefined : onPress;
  const switchActivation = useSwitchActivation(() => {
    if (toggle && !disabled) toggle.onValueChange(!toggle.value);
  });
  const isPressable = Boolean(handlePress) && !disabled;
  const isRadio = checked !== undefined;
  const showDivider = divider ?? !inGroup;

  const role = isRadio ? 'radio' : isPressable ? 'button' : undefined;
  const label = rowLabel(title, value, subtitle);
  const titleTone: TextTone = disabled ? 'tertiary' : isDestructive ? 'danger' : 'primary';
  const rowStyle = styles.row(Boolean(subtitle), showDivider);

  const body = (
    <ListRowContent
      title={title}
      subtitle={subtitle}
      value={value}
      icon={icon}
      tint={rowTint(tint, isDestructive, iconTone)}
      titleTone={titleTone}
    >
      <ListRowAccessory
        trailing={trailing}
        toggle={toggle}
        checked={checked}
        pressable={isPressable}
        destructive={isDestructive}
        disabled={disabled}
      />
    </ListRowContent>
  );

  if (toggle) {
    return (
      <Pressable
        accessible
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ disabled: Boolean(disabled), checked: toggle.value }}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={switchActivation.onAccessibilityAction}
        onPress={switchActivation.onPress}
        disabled={Boolean(disabled)}
        testID={props.testID}
        style={({ pressed }) => [rowStyle, pressed && !disabled && styles.pressed]}
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
        style={rowStyle}
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
      style={({ pressed }) => [rowStyle, pressed && isPressable && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}
