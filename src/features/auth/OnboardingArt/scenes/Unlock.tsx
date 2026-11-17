import { Circle, G, Path, Rect } from 'react-native-svg';

import { FaceGlyph, FingerprintGlyph, KeypadGlyph } from '../glyphs';
import { Backdrop, Floor, Seal } from '../parts';
import type { UnlockProps } from '../types';

/** Slide 3: the face, fingerprint or screen lock in a scan frame, and the seal giving way. */
export function Unlock({ colors, layer, biometry }: UnlockProps) {
  if (layer === 'back') {
    return (
      <G>
        <Backdrop colors={colors} />
        <Floor cx={160} cy={190} rx={70} />
        <Rect
          x={98}
          y={48}
          width={124}
          height={124}
          rx={30}
          fill={colors.surface}
          stroke={colors.border}
          strokeWidth={1.5}
        />
        {/* The PIN is always there as a backup */}
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Circle
            key={index}
            cx={125 + index * 14}
            cy={202}
            r={4.5}
            fill={index < 4 ? colors.primary : colors.borderStrong}
          />
        ))}
      </G>
    );
  }
  const corner = 'M0 18 V8 Q0 0 8 0 H18';
  return (
    <G>
      <G stroke={colors.primary} strokeWidth={5} strokeLinecap="round" fill="none">
        <Path d={corner} transform="translate(116 66)" />
        <Path d={corner} transform="translate(204 66) scale(-1 1)" />
        <Path d={corner} transform="translate(116 154) scale(1 -1)" />
        <Path d={corner} transform="translate(204 154) scale(-1 -1)" />
      </G>
      {biometry === 'faceId' ? (
        <FaceGlyph color={colors.primary} />
      ) : biometry === 'none' ? (
        <KeypadGlyph color={colors.primary} />
      ) : (
        <FingerprintGlyph color={colors.primary} />
      )}
      <Seal id="seal-unlock" cx={218} cy={160} r={26} />
      <Circle cx={240} cy={138} r={11} fill={colors.success} />
      <Path
        d="M235 138 L239 142 L246 134"
        stroke={colors.onSuccess}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </G>
  );
}
