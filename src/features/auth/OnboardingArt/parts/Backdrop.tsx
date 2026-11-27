import { Circle, G } from 'react-native-svg';

import { BACKDROP_DISC, BACKDROP_DOTS } from '../constants';
import type { Palette } from '../types';

export type BackdropProps = { colors: Palette };

export function Backdrop({ colors }: BackdropProps) {
  return (
    <G>
      <Circle {...BACKDROP_DISC} fill={colors.primaryMuted} />
      {BACKDROP_DOTS.map((dot) => (
        <Circle key={`${dot.cx},${dot.cy}`} {...dot} fill={colors.primaryMuted} />
      ))}
    </G>
  );
}
