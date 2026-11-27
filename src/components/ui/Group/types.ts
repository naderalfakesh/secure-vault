import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export type GroupProps = {
  header?: string;
  footer?: string;
  separatorInset?: 'edge' | 'content';
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};
