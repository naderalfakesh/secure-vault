import { Circle, G, Path, Rect } from 'react-native-svg';

import { Backdrop, Floor, Seal } from '../parts';
import type { LayerProps } from '../types';

export function Sealed({ colors, layer }: LayerProps) {
  if (layer === 'back') {
    return (
      <G>
        <Backdrop colors={colors} />
        <Floor cx={160} cy={216} rx={70} />
        <Rect
          x={108}
          y={28}
          width={104}
          height={184}
          rx={20}
          fill={colors.surface}
          stroke={colors.borderStrong}
          strokeWidth={2}
        />
        <Rect x={146} y={38} width={28} height={7} rx={3.5} fill={colors.borderStrong} />
        <G transform="rotate(-10 58 98)">
          <Rect
            x={38}
            y={72}
            width={40}
            height={52}
            rx={6}
            fill={colors.paper}
            stroke={colors.border}
            strokeWidth={1.5}
          />
          <Rect x={46} y={84} width={22} height={4} rx={2} fill={colors.borderStrong} />
          <Rect x={46} y={94} width={24} height={4} rx={2} fill={colors.border} />
          <Rect x={46} y={104} width={16} height={4} rx={2} fill={colors.border} />
        </G>
        <Path
          d="M84 96 Q100 84 116 92"
          fill="none"
          stroke={colors.primary}
          strokeWidth={2}
          strokeDasharray="4 4"
          strokeLinecap="round"
        />
      </G>
    );
  }
  const dots = [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <G>
      <Rect
        x={122}
        y={60}
        width={76}
        height={100}
        rx={8}
        fill={colors.paper}
        stroke={colors.border}
        strokeWidth={1.5}
      />
      <Rect x={132} y={72} width={34} height={5} rx={2.5} fill={colors.borderStrong} />
      {[88, 100, 112, 124, 136].map((y, row) => (
        <G key={y}>
          {dots.slice(0, row % 2 === 0 ? 8 : 6).map((index) => (
            <Circle
              key={index}
              cx={134 + index * 7.4}
              cy={y}
              r={2.2}
              fill={colors.primary}
              opacity={0.45 + (index % 3) * 0.18}
            />
          ))}
        </G>
      ))}
      <Rect x={122} y={172} width={76} height={24} rx={12} fill={colors.primary} opacity={0.14} />
      <Rect x={134} y={182} width={52} height={4} rx={2} fill={colors.primary} opacity={0.5} />
      <Seal id="seal-sealed" cx={204} cy={156} r={30} />
    </G>
  );
}
