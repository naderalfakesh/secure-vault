import { ScrollView } from 'react-native';

import { Text } from '../Text';
import { styles } from './TitledScroll.styles';
import type { TitledScrollProps } from './types';

/** A settings-style page body: the large title, then the content in a scroll view. */
export function TitledScroll({ title, children, showsVerticalScrollIndicator }: TitledScrollProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
    >
      <Text variant="largeTitle" accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {children}
    </ScrollView>
  );
}
