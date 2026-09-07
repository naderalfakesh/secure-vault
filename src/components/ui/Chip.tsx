import { Pressable, type PressableProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ChipProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  icon?: IconName;
  selected?: boolean;
  /** Small count rendered after the label, e.g. documents in a category. */
  count?: number;
};

export function Chip({ label, icon, selected = false, count, ...props }: ChipProps) {
  const tone = selected ? 'inverse' : 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
      {...props}
      style={({ pressed }) => [styles.base(selected), pressed && styles.pressed]}
    >
      {icon ? <Icon name={icon} size={16} tone={tone} /> : null}
      <Text variant="subheadline" tone={tone}>
        {label}
      </Text>
      {count !== undefined ? (
        <Text variant="footnote" tone={selected ? 'inverse' : 'tertiary'}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  base: (selected: boolean) => ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs + 2,
    minHeight: 36,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: selected ? theme.colors.primary : theme.colors.border,
    backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
  }),
  pressed: { opacity: 0.8 },
}));
