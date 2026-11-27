import { Circle, G, Line, Path, Rect } from 'react-native-svg';

import { booklet, brass } from '@/brand/folio';

import { Backdrop, Floor } from '../parts';
import type { LayerProps } from '../types';

export function Papers({ colors, layer }: LayerProps) {
  if (layer === 'back') {
    return (
      <G>
        <Backdrop colors={colors} />
        <Floor cx={160} cy={206} rx={96} />
        <G transform="rotate(-12 116 122)">
          <Rect x={70} y={58} width={92} height={128} rx={10} fill={booklet} />
          <Circle cx={116} cy={108} r={19} fill="none" stroke={brass.light} strokeWidth={3} />
          <Line x1={97} y1={108} x2={135} y2={108} stroke={brass.light} strokeWidth={2} />
          <Path
            d="M116 89 Q104 108 116 127 Q128 108 116 89 Z"
            fill="none"
            stroke={brass.light}
            strokeWidth={2}
          />
          <Rect x={92} y={144} width={48} height={5} rx={2.5} fill={brass.light} opacity={0.85} />
          <Rect x={100} y={156} width={32} height={4} rx={2} fill={brass.light} opacity={0.6} />
        </G>
        <G transform="rotate(9 210 112)">
          <Rect
            x={150}
            y={74}
            width={120}
            height={78}
            rx={10}
            fill={colors.surface}
            stroke={colors.border}
            strokeWidth={1.5}
          />
          <Rect x={162} y={88} width={32} height={38} rx={6} fill={colors.primaryMuted} />
          <Circle cx={178} cy={102} r={7} fill={colors.primary} opacity={0.55} />
          <Path d="M166 124 Q178 110 190 124 Z" fill={colors.primary} opacity={0.55} />
          <Rect x={204} y={92} width={54} height={6} rx={3} fill={colors.borderStrong} />
          <Rect x={204} y={106} width={42} height={5} rx={2.5} fill={colors.border} />
          <Rect x={204} y={118} width={48} height={5} rx={2.5} fill={colors.border} />
          <Rect x={162} y={136} width={96} height={5} rx={2.5} fill={colors.border} />
        </G>
      </G>
    );
  }
  return (
    <G>
      <Path
        d="M126 92 H194 V196 L186.5 190 L178 196 L169.5 190 L161 196 L152.5 190 L144 196 L135.5 190 L126 196 Z"
        fill={colors.paper}
        stroke={colors.border}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Rect x={138} y={106} width={30} height={6} rx={3} fill={colors.borderStrong} />
      {[122, 134, 146].map((y) => (
        <G key={y}>
          <Rect x={138} y={y} width={26} height={4} rx={2} fill={colors.border} />
          <Rect x={172} y={y} width={12} height={4} rx={2} fill={colors.border} />
        </G>
      ))}
      <Line
        x1={138}
        y1={160}
        x2={184}
        y2={160}
        stroke={colors.border}
        strokeWidth={1.5}
        strokeDasharray="3 3"
      />
      <Rect x={138} y={168} width={22} height={6} rx={3} fill={colors.textTertiary} opacity={0.6} />
      <Rect x={168} y={168} width={16} height={6} rx={3} fill={colors.textTertiary} opacity={0.6} />
      <Floor cx={226} cy={212} rx={46} />
      <Rect
        x={178}
        y={174}
        width={100}
        height={32}
        rx={16}
        fill={colors.surface}
        stroke={colors.border}
        strokeWidth={1.5}
      />
      <Circle cx={196} cy={189} r={6} fill="none" stroke={colors.primary} strokeWidth={2.5} />
      <Line
        x1={200.5}
        y1={193.5}
        x2={205}
        y2={198}
        stroke={colors.primary}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <Rect x={214} y={184} width={46} height={5} rx={2.5} fill={colors.borderStrong} />
      <Rect x={214} y={194} width={30} height={4} rx={2} fill={colors.border} />
    </G>
  );
}
