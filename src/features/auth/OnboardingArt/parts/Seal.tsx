import { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';

import { brass } from '@/brand/folio';

import { SEAL_SHADOW_OPACITY, SEAL_UNIT, SHADOW_INK } from '../constants';

export type SealProps = { id: string; cx: number; cy: number; r: number };

export function Seal({ id, cx, cy, r }: SealProps) {
  const k = r / SEAL_UNIT;
  return (
    <G>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={brass.light} />
          <Stop offset="1" stopColor={brass.dark} />
        </LinearGradient>
      </Defs>
      <Ellipse
        cx={cx}
        cy={cy + r * 0.92}
        rx={r * 0.8}
        ry={r * 0.16}
        fill={SHADOW_INK}
        opacity={SEAL_SHADOW_OPACITY}
      />
      <Circle cx={cx} cy={cy} r={r} fill={`url(#${id})`} />
      <Circle
        cx={cx}
        cy={cy}
        r={r * 0.8}
        fill="none"
        stroke={brass.dark}
        strokeWidth={Math.max(1.5, 10 * k)}
        opacity={0.55}
      />
      <Circle cx={cx} cy={cy - 26 * k} r={32 * k} fill={brass.ink} />
      <Path d="M-18 -4 H18 L30 70 H-30 Z" x={cx} y={cy} scale={k} fill={brass.ink} />
    </G>
  );
}
