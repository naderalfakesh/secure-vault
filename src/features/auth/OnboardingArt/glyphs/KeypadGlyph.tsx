import { Circle, G } from 'react-native-svg';

import type { GlyphProps } from '../types';

/** No biometrics: the device passcode or screen lock keypad. */
export function KeypadGlyph({ color }: GlyphProps) {
  return (
    <G fill={color}>
      {[0, 1, 2].map((col) =>
        [0, 1, 2].map((row) => (
          <Circle key={`${col}${row}`} cx={140 + col * 20} cy={92 + row * 18} r={5} />
        )),
      )}
    </G>
  );
}
