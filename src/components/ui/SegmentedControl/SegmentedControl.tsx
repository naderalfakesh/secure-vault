import { Pressable, View } from 'react-native';

import { textScale } from '@/theme/tokens';

import { useLargeText } from '../hooks/useLargeText';
import { Icon } from '../Icon';
import { Text } from '../Text';
import { SEGMENT_SLOP } from './constants';
import { styles } from './SegmentedControl.styles';
import type { SegmentedControlProps } from './types';

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
