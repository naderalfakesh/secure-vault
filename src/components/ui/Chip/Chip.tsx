import { Pressable, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { t } from '@/i18n';
import { isolate, LRI, PDI } from '@/utils/bidi';

import { Icon, type IconName } from '../Icon';
import { Text } from '../Text';
import { styles } from './Chip.styles';
import { colours } from './constants';
import type { ChipProps } from './types';

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
  // Isolate "# " and the tag in LRI so numeric tags don't reorder to "2026 #" in RTL.
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
