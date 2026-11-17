import Svg, { Path } from 'react-native-svg';

import { iconPaths } from '../iconPaths';
import { ICON_STROKE } from './constants';
import type { IconGlyphProps } from './types';

/** The bare outline glyph, drawn from the design's path. */
export function IconGlyph({ path, size, color, strokeWidth = ICON_STROKE }: IconGlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={iconPaths[path]}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
