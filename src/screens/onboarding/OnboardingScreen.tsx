import { Redirect, router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { Screen } from '@/components/ui';
import { unlockSlideBody } from '@/features/auth/onboardingCopy';
import { useSessionState } from '@/features/session/SessionProvider';

import { IntroBar, IntroFooter, IntroSlide } from './components';
import { introSlides } from './helpers';
import { useIntroPager } from './hooks/useIntroPager';
import { styles } from './OnboardingScreen.styles';
import type { Slide } from './types';

const toPin = () => router.push('/setup/pin');

/** The intro, steps 1–3. */
export function OnboardingScreen() {
  const { biometry, vaultExists, vaultEmpty, setupHeld } = useSessionState();
  const slides = introSlides(unlockSlideBody(biometry));
  const { width, reduceMotion, scrollRef, page, onScroll, goTo } = useIntroPager(slides.length);
  const last = page === slides.length - 1;
  const currentSlide = slides[page];

  // A key that guards documents only needs a PIN; it never sees "set up your
  // vault". A held setup has a key too, and stays where it is.
  if (vaultExists && !vaultEmpty && !setupHeld) return <Redirect href="/setup/pin" />;

  const next = () => {
    if (last) {
      toPin();
      return;
    }
    goTo(page + 1);
  };

  const renderSlide = (slide: Slide) => (
    <IntroSlide key={slide.title} slide={slide} width={width} biometry={biometry} />
  );

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <IntroBar canGoBack={page > 0} last={last} onBack={() => goTo(page - 1)} onSkip={toPin} />
      {reduceMotion ? (
        <View style={styles.pager}>{currentSlide ? renderSlide(currentSlide) : null}</View>
      ) : (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          style={styles.pager}
        >
          {slides.map(renderSlide)}
        </ScrollView>
      )}
      <IntroFooter slides={slides} page={page} onNext={next} />
    </Screen>
  );
}
