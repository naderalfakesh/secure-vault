import { Pressable, View } from 'react-native';

import { useInGroup } from '../Group';
import type { TextTone } from '../Text';
import { rowLabel, rowTint } from './helpers';
import { styles } from './ListRow.styles';
import { ListRowAccessory } from './ListRowAccessory';
import { ListRowContent } from './ListRowContent';
import type { ListRowProps } from './types';
import { useSwitchActivation } from './useSwitchActivation';

export function ListRow({
  title,
  subtitle,
  icon,
  tint,
  value,
  toggle,
  checked,
  trailing,
  destructive,
  divider,
  onPress,
  disabled,
  ...props
}: ListRowProps) {
  const inGroup = useInGroup();
  const isDestructive = Boolean(destructive);
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
      tint={rowTint(tint, isDestructive)}
      titleTone={titleTone}
    >
      <ListRowAccessory
        trailing={trailing}
        toggle={toggle}
        checked={checked}
        pressable={isPressable}
        destructive={isDestructive}
        disabled={disabled}
        testID={props.testID}
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
        accessibilityHint={props.accessibilityHint}
        nativeID={props.nativeID}
        testID={props.testID}
        style={({ pressed }) => [rowStyle, pressed && !disabled && styles.pressed]}
      >
        {body}
      </Pressable>
    );
  }

  // Non-interactive rows stay plain Views so screen readers announce text instead of a button.
  if (!handlePress && !isRadio) {
    return (
      <View
        accessible
        accessibilityLabel={label}
        accessibilityState={disabled ? { disabled: true } : undefined}
        accessibilityHint={props.accessibilityHint}
        nativeID={props.nativeID}
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
