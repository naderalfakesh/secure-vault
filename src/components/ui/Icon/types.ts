import type { SFSymbol, SymbolWeight } from 'expo-symbols';
import type { StyleProp, ViewStyle } from 'react-native';

import type { IconPath } from './iconPaths';
import type { TextTone } from '../Text';
import type { icons } from './icons';

export type Glyph = {
  d: IconPath;
  sf?: SFSymbol;
  mirror?: boolean;
};

export type IconName = keyof typeof icons;

export type IconProps = {
  name: IconName;
  size?: number;
  tone?: TextTone;
  color?: string;
  weight?: SymbolWeight;
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
