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

/** The bar above each phase: a control either side of a centred title. */
export function FlowHeader({ leading, title, trailing }: FlowHeaderProps) {
  const stacked = useLargeText();
  // A bar title: it stops growing at 1.6× and shrinks to keep its words whole.
  // At the largest text sizes it gets a row of its own under the controls, so
  // the controls never squeeze it to nothing.
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
