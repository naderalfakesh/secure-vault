import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  ScrollView,
  type ScrollViewInstance,
  useWindowDimensions,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { Button, Icon, IconButton, type IconName, Screen, Text } from '@/components/ui';
import { biometryIcon } from '@/features/auth/lockCopy';
import { unlockSlideBody } from '@/features/auth/onboardingCopy';
import { useSession } from '@/features/session/SessionProvider';

type Slide = { icon: IconName; title: string; body: string };

function introSlides(unlockBody: string, unlockIcon: IconName): Slide[] {
  return [
    {
      icon: 'files',
      title: 'One place for the papers that matter',
      body: 'Passports, IDs, insurance cards, leases, receipts. Scan them once and find them in seconds.',
    },
    {
      icon: 'lock',
      title: 'Encrypted on this phone',
      body: Platform.select({
        ios: 'Every page is encrypted before it’s saved. The key is created on this phone and kept by the iOS Keychain. There’s no account to sign up for.',
        default:
          'Every page is encrypted before it’s saved. The key is created on this phone and kept by the Android Keystore. There’s no account to sign up for.',
      }),
    },
    { icon: unlockIcon, title: 'Unlock the way you already do', body: unlockBody },
  ];
}

/** J0 intro, steps 1–3 (handover §6, §7.5). */
export default function OnboardingScreen() {
  const { biometry, vaultExists, vaultEmpty, setupHeld } = useSession();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState(0);
  const slides = introSlides(
    unlockSlideBody(biometry),
    biometry === 'none' ? 'unlock' : biometryIcon(biometry),
  );
  const last = page === slides.length - 1;

  // A key that guards documents only needs a PIN; it never sees "set up your
  // vault". A held setup has a key too, and stays where it is.
  if (vaultExists && !vaultEmpty && !setupHeld) return <Redirect href="/setup/pin" />;

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  const goTo = (next: number) => {
    setPage(next);
    // Reduced motion shows one step at a time without the slide.
    if (!reduceMotion) scrollRef.current?.scrollTo({ x: next * width, animated: true });
  };

  const next = () => {
    if (last) {
      router.push('/setup/pin');
      return;
    }
    goTo(page + 1);
  };

  const renderSlide = (slide: Slide) => (
    <View key={slide.title} style={[styles.slide, { width }]}>
      <View style={styles.art}>
        <View style={styles.badge}>
          <Icon name={slide.icon} size={40} tone="accent" />
        </View>
      </View>
      <Text variant="title1" accessibilityRole="header">
        {slide.title}
      </Text>
      <Text variant="body" tone="secondary">
        {slide.body}
      </Text>
    </View>
  );

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.bar}>
        {page > 0 ? (
          <IconButton icon="back" accessibilityLabel="Back" onPress={() => goTo(page - 1)} />
        ) : (
          <View />
        )}
        {last ? null : (
          <Button
            label="Skip"
            variant="plain"
            size="md"
            onPress={() => router.push('/setup/pin')}
          />
        )}
      </View>
      {reduceMotion ? (
        <View style={styles.pager}>{renderSlide(slides[page])}</View>
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
      <View style={styles.footer}>
        <View
          style={styles.dots}
          accessible
          accessibilityLabel={`Step ${page + 1} of ${slides.length}`}
        >
          {slides.map((slide, index) => (
            <View key={slide.title} style={styles.dot(index === page)} />
          ))}
        </View>
        <Button label={last ? 'Set up your vault' : 'Continue'} onPress={next} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  bar: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.sm,
  },
  pager: {
    flex: 1,
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  art: {
    height: 240,
    borderRadius: theme.radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.lg,
  },
  badge: {
    width: 96,
    height: 96,
    borderRadius: theme.radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryMuted,
  },
  footer: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  dot: (active: boolean) => ({
    width: active ? 20 : 8,
    height: 8,
    borderRadius: theme.radii.pill,
    backgroundColor: active ? theme.colors.primary : theme.colors.borderStrong,
  }),
}));
