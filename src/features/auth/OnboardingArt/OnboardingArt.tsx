import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Svg from 'react-native-svg';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { FADE_MS, LAYER_STAGGER_MS, LAYERS, RISE_DAMPING, RISE_MS, VIEW_BOX } from './constants';
import { styles } from './OnboardingArt.styles';
import { Scene } from './scenes';
import type { OnboardingArtProps } from './types';

/**
 * The onboarding illustrations, drawn in the app icon's style: indigo, paper
 * and the brass seal. Two layers rise in one after the other when the intro
 * first shows; with Reduce Motion they only fade. Decorative, so hidden from
 * assistive tech: the slide's title and body carry the meaning.
 */
export function OnboardingArt({ scene, biometry = 'none', testID }: OnboardingArtProps) {
  const { theme } = useUnistyles();
  const reduceMotion = useReducedMotion();
  const enter = (delay: number) =>
    reduceMotion
      ? FadeIn.duration(FADE_MS)
      : FadeInDown.duration(RISE_MS).delay(delay).springify().damping(RISE_DAMPING);

  return (
    <View
      style={styles.art}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID ?? `onboarding-art-${scene}`}
    >
      {LAYERS.map((layer, index) => (
        <Animated.View
          key={layer}
          entering={enter(index * LAYER_STAGGER_MS)}
          style={StyleSheet.absoluteFill}
        >
          <Svg width="100%" height="100%" viewBox={VIEW_BOX} preserveAspectRatio="xMidYMid meet">
            <Scene scene={scene} layer={layer} biometry={biometry} colors={theme.colors} />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}
