import { Children, createContext, isValidElement, type ReactNode, useContext } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Text } from './Text';

/** Rows inside a Group leave the separators to it. */
const GroupContext = createContext(false);

export function useInGroup(): boolean {
  return useContext(GroupContext);
}

export type GroupProps = {
  /** Optional uppercase section header above the group. */
  header?: string;
  /** Optional footnote below the group. */
  footer?: string;
  /**
   * Where separators start: `content` lines up with row text after a leading
   * icon tile; `edge` starts at the row padding.
   */
  separatorInset?: 'edge' | 'content';
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

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

const styles = StyleSheet.create((theme) => ({
  wrap: {
    gap: theme.spacing.xs,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
  },
  group: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.group,
    overflow: 'hidden',
  },
  separator: (inset: 'edge' | 'content') => ({
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginStart:
      inset === 'content'
        ? theme.spacing.md + theme.controlSize.iconTile + theme.spacing.sm
        : theme.spacing.md,
  }),
  footer: {
    paddingHorizontal: theme.spacing.md,
  },
}));
