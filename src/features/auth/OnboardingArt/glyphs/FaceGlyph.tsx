import { G, Line, Path } from 'react-native-svg';

import type { GlyphProps } from '../types';

/** Face ID: eyes, nose and smile. */
export function FaceGlyph({ color }: GlyphProps) {
  return (
    <G stroke={color} strokeWidth={4} strokeLinecap="round" fill="none">
      <Line x1={146} y1={92} x2={146} y2={102} />
      <Line x1={174} y1={92} x2={174} y2={102} />
      <Path d="M160 94 V112 H155" strokeLinejoin="round" />
      <Path d="M146 124 Q160 134 174 124" />
    </G>
  );
}
