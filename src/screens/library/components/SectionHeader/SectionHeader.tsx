import { View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { textScale } from '@/theme/tokens';

import { styles } from './SectionHeader.styles';

type SectionHeaderProps = {
  title: string;
  /** A count or note at the trailing edge. */
  trailing?: string;
  action?: { label: string; onPress: () => void };
};

export function SectionHeader({ title, trailing, action }: SectionHeaderProps) {
  return (
    <View style={styles.header}>
      {/* Capped and shrinkable, so the action beside it stays whole at AX5. */}
      <Text
        variant="title3"
        accessibilityRole="header"
        maxFontSizeMultiplier={textScale.barTitleMax}
        style={styles.title}
      >
        {title}
      </Text>
      {trailing ? (
        <Text variant="subheadline" tone="secondary">
          {trailing}
        </Text>
      ) : null}
      {action ? (
        <Button label={action.label} variant="plain" size="md" onPress={action.onPress} />
      ) : null}
    </View>
  );
}
