import { View } from 'react-native';

import { Text } from '@/components/ui';
import { OnboardingArt } from '@/features/auth/OnboardingArt';
import type { SessionContextValue } from '@/features/session/SessionProvider';

import type { Slide } from '../../types';
import { styles } from './IntroSlide.styles';

export type IntroSlideProps = {
  slide: Slide;
  /** One page of the pager: the window's width. */
  width: number;
  biometry: SessionContextValue['biometry'];
};

/** The illustration over the slide's title and body. */
export function IntroSlide({ slide, width, biometry }: IntroSlideProps) {
  return (
    <View style={[styles.slide, { width }]}>
      <View style={styles.art}>
        <OnboardingArt scene={slide.scene} biometry={biometry} />
      </View>
      <Text variant="title1" accessibilityRole="header">
        {slide.title}
      </Text>
      <Text variant="body" tone="secondary">
        {slide.body}
      </Text>
    </View>
  );
}
