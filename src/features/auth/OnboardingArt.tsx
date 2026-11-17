import { type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { booklet, brass } from '@/brand/folio';

import type { BiometryType } from '../../../modules/expo-vault';

export type OnboardingScene = 'papers' | 'sealed' | 'unlock';

/** The illustrations share one 320 × 240 canvas. */
const VIEW_BOX = '0 0 320 240';

type Palette = ReturnType<typeof useUnistyles>['theme']['colors'];

/** The brass seal with its keyhole, the icon's centrepiece, at (cx, cy). */
function Seal({ id, cx, cy, r }: { id: string; cx: number; cy: number; r: number }) {
  const k = r / 132;
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
        fill="#0A0F2E"
        opacity={0.12}
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

/** A soft floor shadow, standing in for the drop shadows react-native-svg can't draw. */
function Floor({ cx, cy, rx }: { cx: number; cy: number; rx: number }) {
  return <Ellipse cx={cx} cy={cy} rx={rx} ry={rx * 0.12} fill="#0A0F2E" opacity={0.08} />;
}

function Backdrop({ colors }: { colors: Palette }) {
  return (
    <G>
      <Circle cx={160} cy={122} r={104} fill={colors.primaryMuted} />
      <Circle cx={52} cy={58} r={5} fill={colors.primaryMuted} />
      <Circle cx={278} cy={70} r={8} fill={colors.primaryMuted} />
      <Circle cx={268} cy={196} r={4} fill={colors.primaryMuted} />
    </G>
  );
}

/** Slide 1: a passport, an ID card and a receipt, and a search that finds them. */
function Papers({ colors, layer }: { colors: Palette; layer: 'back' | 'front' }) {
  if (layer === 'back') {
    return (
      <G>
        <Backdrop colors={colors} />
        <Floor cx={160} cy={206} rx={96} />
        {/* Passport */}
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
        {/* ID card */}
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
      {/* Receipt */}
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
      {/* Search */}
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

/** Slide 2: a document turned to ciphertext inside the phone, closed with the seal. */
function Sealed({ colors, layer }: { colors: Palette; layer: 'back' | 'front' }) {
  if (layer === 'back') {
    return (
      <G>
        <Backdrop colors={colors} />
        <Floor cx={160} cy={216} rx={70} />
        {/* Phone */}
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
        {/* A page on its way in */}
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
      {/* The page inside: the first lines readable, the rest ciphertext */}
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

function FaceGlyph({ color }: { color: string }) {
  return (
    <G stroke={color} strokeWidth={4} strokeLinecap="round" fill="none">
      <Line x1={146} y1={92} x2={146} y2={102} />
      <Line x1={174} y1={92} x2={174} y2={102} />
      <Path d="M160 94 V112 H155" strokeLinejoin="round" />
      <Path d="M146 124 Q160 134 174 124" />
    </G>
  );
}

function FingerprintGlyph({ color }: { color: string }) {
  return (
    <G stroke={color} strokeWidth={3.5} strokeLinecap="round" fill="none">
      <Path d="M138 104 A22 22 0 0 1 182 104 V112" />
      <Path d="M146 128 Q144 118 146 106 A14 14 0 0 1 174 106 V116 Q174 126 170 134" />
      <Path d="M160 104 V116 Q160 128 154 136" />
      <Path d="M138 116 Q138 126 140 132" />
    </G>
  );
}

function KeypadGlyph({ color }: { color: string }) {
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

/** Slide 3: the face, fingerprint or screen lock in a scan frame, and the seal giving way. */
function Unlock({
  colors,
  layer,
  biometry,
}: {
  colors: Palette;
  layer: 'back' | 'front';
  biometry: BiometryType;
}) {
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

function Scene({
  scene,
  layer,
  biometry,
  colors,
}: {
  scene: OnboardingScene;
  layer: 'back' | 'front';
  biometry: BiometryType;
  colors: Palette;
}): ReactNode {
  if (scene === 'papers') return <Papers colors={colors} layer={layer} />;
  if (scene === 'sealed') return <Sealed colors={colors} layer={layer} />;
  return <Unlock colors={colors} layer={layer} biometry={biometry} />;
}

/**
 * The onboarding illustrations, drawn in the app icon's style: indigo, paper
 * and the brass seal. Two layers rise in one after the other when the intro
 * first shows; with Reduce Motion they only fade. Decorative, so hidden from
 * assistive tech: the slide's title and body carry the meaning.
 */
export function OnboardingArt({
  scene,
  biometry = 'none',
  testID,
}: {
  scene: OnboardingScene;
  biometry?: BiometryType;
  testID?: string;
}) {
  const { theme } = useUnistyles();
  const reduceMotion = useReducedMotion();
  const enter = (delay: number) =>
    reduceMotion
      ? FadeIn.duration(200)
      : FadeInDown.duration(520).delay(delay).springify().damping(18);

  return (
    <View
      style={styles.art}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID ?? `onboarding-art-${scene}`}
    >
      {(['back', 'front'] as const).map((layer, index) => (
        <Animated.View key={layer} entering={enter(index * 120)} style={StyleSheet.absoluteFill}>
          <Svg width="100%" height="100%" viewBox={VIEW_BOX} preserveAspectRatio="xMidYMid meet">
            <Scene scene={scene} layer={layer} biometry={biometry} colors={theme.colors} />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  art: {
    width: '100%',
    aspectRatio: 4 / 3,
    maxHeight: 300,
    alignSelf: 'center',
  },
});
