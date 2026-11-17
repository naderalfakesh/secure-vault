import { Pressable } from 'react-native';

import { textScale } from '@/theme/tokens';

import { Icon } from '../Icon';
import { Text } from '../Text';
import { styles } from './Tab.styles';
import type { TabProps } from './types';

/** One tab of the bar: its glyph over a capped label. */
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
      {/* Bar labels stop at 1.35×, as the system tab bar's do, so a label never
        splits mid-word; the tab keeps its full accessible name at every size. */}
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
