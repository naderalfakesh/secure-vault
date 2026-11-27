import { G, Path } from 'react-native-svg';

import type { GlyphProps } from '../types';

export function FingerprintGlyph({ color }: GlyphProps) {
  return (
    <G stroke={color} strokeWidth={3.5} strokeLinecap="round" fill="none">
      <Path d="M138 104 A22 22 0 0 1 182 104 V112" />
      <Path d="M146 128 Q144 118 146 106 A14 14 0 0 1 174 106 V116 Q174 126 170 134" />
      <Path d="M160 104 V116 Q160 128 154 136" />
      <Path d="M138 116 Q138 126 140 132" />
    </G>
  );
}
