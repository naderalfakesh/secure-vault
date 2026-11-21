import { Pressable, View } from 'react-native';

import { textScale } from '@/theme/tokens';

import { useLargeText } from '../hooks/useLargeText';
import { Icon } from '../Icon';
import { Text } from '../Text';
import { SEGMENT_SLOP } from './constants';
import { styles } from './SegmentedControl.styles';
import type { SegmentedControlProps } from './types';

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
