import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

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
