import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text, useLargeText } from '@/components/ui';
import { textScale } from '@/theme/tokens';

import { styles } from './FlowHeader.styles';

export type FlowHeaderProps = {
  leading?: ReactNode;
  title?: string;
  trailing?: ReactNode;
};

export function FlowHeader({ leading, title, trailing }: FlowHeaderProps) {
  const stacked = useLargeText();
  const titleText = title ? (
    <Text
      variant="headline"
      accessibilityRole="header"
      maxFontSizeMultiplier={textScale.barTitleMax}
      fit
      style={stacked ? styles.centered : styles.title}
    >
      {title}
    </Text>
  ) : null;
  if (stacked) {
    return (
      <View>
        {leading || trailing ? (
          <View style={styles.header}>
            <View style={styles.stackedSide}>{leading}</View>
            <View style={[styles.stackedSide, styles.end]}>{trailing}</View>
          </View>
        ) : null}
        {titleText ? <View style={styles.stackedTitle}>{titleText}</View> : null}
      </View>
    );
  }
  return (
    <View style={styles.header}>
      <View style={styles.side}>{leading}</View>
      {titleText ?? <View style={styles.title} />}
      <View style={[styles.side, styles.end]}>{trailing}</View>
    </View>
  );
}
