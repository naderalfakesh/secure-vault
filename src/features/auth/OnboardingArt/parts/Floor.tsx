import { Ellipse } from 'react-native-svg';

import { FLOOR_OPACITY, SHADOW_INK } from '../constants';

export type FloorProps = { cx: number; cy: number; rx: number };

export function Floor({ cx, cy, rx }: FloorProps) {
  return (
    <Ellipse cx={cx} cy={cy} rx={rx} ry={rx * 0.12} fill={SHADOW_INK} opacity={FLOOR_OPACITY} />
  );
}
