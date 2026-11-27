import { Pressable } from 'react-native';

import { textScale } from '@/theme/tokens';

import { Icon } from '../Icon';
import { Text } from '../Text';
import { styles } from './Tab.styles';
import type { TabProps } from './types';

export function Tab({ item }: TabProps) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: item.selected }}
      onPress={item.onPress}
      style={styles.tab(item.selected)}
    >
      <Icon name={item.icon} size={22} tone={item.selected ? 'accent' : 'secondary'} />
      <Text
        variant="caption"
        tone={item.selected ? 'accent' : 'secondary'}
        maxFontSizeMultiplier={textScale.tabLabelMax}
        style={styles.label}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}
