import { Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Text } from './Text';

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

/** Pill segmented control, e.g. System / Light / Dark (handover §4). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  disabled = false,
  testID,
}: SegmentedControlProps<T>) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, disabled && styles.disabled]}
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
            style={styles.segment(selected)}
          >
            <Text
              variant="subheadline"
              tone={selected ? 'primary' : 'secondary'}
              style={styles.label(selected)}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const SEGMENT_SLOP = { top: 3, bottom: 3 };

const styles = StyleSheet.create((theme) => ({
  track: {
    flexDirection: 'row',
    padding: 3,
    gap: 2,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surfaceMuted,
  },
  // 38 pt segments; their hit slop reaches over the 3 pt track to 44 pt.
  segment: (selected: boolean) => ({
    flex: 1,
    minHeight: theme.touchTarget - 6,
    paddingHorizontal: 14,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...(selected && { backgroundColor: theme.colors.surface, ...theme.elevation.card }),
  }),
  label: (selected: boolean) => ({
    fontWeight: selected ? '600' : '400',
  }),
  disabled: { opacity: 0.5 },
}));
