import { Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { textScale } from '@/theme/tokens';

import { Icon } from './Icon';
import { Text } from './Text';
import { useLargeText } from './useLargeText';

export type SegmentedOption<T extends string> = { value: T; label: string };

export type SegmentedControlProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Spoken name of the whole control, e.g. "Appearance". */
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
};

/**
 * Pill segmented control, e.g. System / Light / Dark. Labels
 * stop growing at 1.6× and shrink to stay on one line. At the accessibility
 * text sizes the segments no longer fit side by side, so it becomes a
 * vertical list of the same radio options, with a check on the chosen one.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  disabled = false,
  testID,
}: SegmentedControlProps<T>) {
  const vertical = useLargeText();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track(vertical), disabled && styles.disabled]}
      testID={testID}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            // The track's 3 pt padding is part of the target: 38 + 3 + 3 = 44 pt.
            hitSlop={SEGMENT_SLOP}
            onPress={() => {
              if (!selected) onChange(option.value);
            }}
            style={styles.segment(selected, vertical)}
          >
            <Text
              variant="subheadline"
              tone={selected ? 'primary' : 'secondary'}
              maxFontSizeMultiplier={textScale.segmentMax}
              fit
              numberOfLines={1}
              style={styles.label(selected, vertical)}
            >
              {option.label}
            </Text>
            {vertical && selected ? <Icon name="check" size={18} tone="accent" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const SEGMENT_SLOP = { top: 3, bottom: 3 };

const styles = StyleSheet.create((theme) => ({
  track: (vertical: boolean) => ({
    flexDirection: vertical ? 'column' : 'row',
    padding: 3,
    gap: 2,
    borderRadius: vertical ? theme.radii.lg : theme.radii.pill,
    backgroundColor: theme.colors.surfaceMuted,
  }),
  // 38 pt segments; their hit slop reaches over the 3 pt track to 44 pt.
  // Stacked rows are full 44 pt targets of their own.
  segment: (selected: boolean, vertical: boolean) => ({
    flex: vertical ? undefined : 1,
    minHeight: vertical ? theme.touchTarget : theme.touchTarget - 6,
    paddingHorizontal: 14,
    borderRadius: vertical ? theme.radii.md : theme.radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: vertical ? 'space-between' : 'center',
    gap: theme.spacing.xs,
    ...(selected && { backgroundColor: theme.colors.surface, ...theme.elevation.card }),
  }),
  label: (selected: boolean, vertical: boolean) => ({
    fontWeight: selected ? '600' : '400',
    flexShrink: 1,
    ...(vertical && { paddingVertical: theme.spacing.xs }),
  }),
  disabled: { opacity: 0.5 },
}));
