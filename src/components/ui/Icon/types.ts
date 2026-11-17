import type { SFSymbol, SymbolWeight } from 'expo-symbols';
import type { StyleProp, ViewStyle } from 'react-native';

import type { IconPath } from '../iconPaths';
import type { TextTone } from '../Text';
import type { icons } from './icons';

export type Glyph = {
  /** The outline glyph: drawn on Android, and on iOS when `sf` is absent. */
  d: IconPath;
  /**
   * SF Symbol used on iOS where the system has the same glyph. Glyphs the
   * system has no match for (the mark, scan, settings sliders, filter, legal,
   * restore) draw the design's SVG on iOS too.
   */
  sf?: SFSymbol;
  /** Directional glyphs flip in right-to-left layouts. */
  mirror?: boolean;
};

export type IconName = keyof typeof icons;

export type IconProps = {
  name: IconName;
  size?: number;
  tone?: TextTone;
  /** Explicit color wins over tone. */
  color?: string;
  /** SF Symbol weight on iOS. */
  weight?: SymbolWeight;
  /** Stroke on the 24 pt grid: 1.75 by default, 1.5 for the large mark. */
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export type IconGlyphProps = {
  path: IconPath;
  size: number;
  color: string;
  strokeWidth?: number;
};
