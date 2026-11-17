import type { StyleProp, ViewStyle } from 'react-native';
import type { AnimatedStyle } from 'react-native-reanimated';

import type { IconPath } from '../iconPaths';

export type MarkProps = {
  /** Tile size: 64 on the lock screen, 80 on the privacy cover, 138 on the splash. */
  size?: number;
  /** Quiet variant for a paused state, such as the PIN lockout. */
  muted?: boolean;
  /** `mark` draws the sealed folio; another glyph, such as the lockout clock, draws the quiet outline style. */
  glyph?: IconPath;
  /** Style for the tile, e.g. an animated transform. */
  style?: StyleProp<AnimatedStyle<ViewStyle>>;
  /**
   * Draw in this scheme's colours instead of the app theme's. The splash
   * handoff repaints the native splash, which follows the system scheme.
   */
  scheme?: 'light' | 'dark';
  testID?: string;
};
