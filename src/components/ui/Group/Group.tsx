import { Children, isValidElement } from 'react';
import { View } from 'react-native';

import { Text } from '../Text';
import { GroupContext } from './GroupContext';
import type { GroupProps } from './types';
import { styles } from './Group.styles';

/** Grouped surface with hairline separators between its rows. */
export function Group({
  header,
  footer,
  separatorInset = 'edge',
  children,
  style,
  testID,
}: GroupProps) {
  const rows = Children.toArray(children).filter(isValidElement);

  return (
    <View style={[styles.wrap, style]} testID={testID}>
      {header ? (
        <Text variant="label" tone="tertiary" accessibilityRole="header" style={styles.header}>
          {header}
        </Text>
      ) : null}
      <View style={styles.group}>
        <GroupContext.Provider value>
          {rows.map((row, index) => (
            <View key={row.key ?? index}>
              {index > 0 ? (
                <View style={styles.separator(separatorInset)} testID="group-separator" />
              ) : null}
              {row}
            </View>
          ))}
        </GroupContext.Provider>
      </View>
      {footer ? (
        <Text variant="footnote" tone="secondary" style={styles.footer}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}
