import type { StyleProp, ViewStyle } from 'react-native';
import type { AnimatedStyle } from 'react-native-reanimated';

import type { IconPath } from '../Icon';

export type MarkProps = {
  size?: number;
  muted?: boolean;
  glyph?: IconPath;
  style?: StyleProp<AnimatedStyle<ViewStyle>>;
  /** Overrides the app theme; used by SplashHandoff to match the system-scheme native splash. */
  scheme?: 'light' | 'dark';
  testID?: string;
};
