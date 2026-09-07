import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { Button, Icon, type IconName, Screen, Text } from '@/components/ui';

const slides: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'files',
    title: 'One place for the papers that matter',
    body: 'Passports, IDs, insurance cards, leases, receipts. Scan them once and find them in seconds.',
  },
  {
    icon: 'shield',
    title: 'Nothing leaves your phone',
    body: 'Every file is encrypted with a key that lives in your device’s secure hardware. There is no account and no cloud.',
  },
  {
    icon: 'faceId',
    title: 'Unlock the way you already do',
    body: 'Face ID, Touch ID, or your device passcode opens the vault. A 6-digit PIN is always there as a fallback.',
  },
];

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const last = page === slides.length - 1;

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  const next = () => {
    if (last) {
      router.push('/setup/pin');
      return;
    }
    scrollRef.current?.scrollTo({ x: (page + 1) * width, animated: !reduceMotion });
  };

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.skipRow}>
        <Button label="Skip" variant="ghost" size="md" onPress={() => router.push('/setup/pin')} />
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={styles.pager}
      >
        {slides.map((slide) => (
          <View key={slide.title} style={[styles.slide, { width }]} accessibilityRole="summary">
            <View style={styles.badge}>
              <Icon name={slide.icon} size={40} tone="accent" />
            </View>
            <Text variant="title1" align="center" accessibilityRole="header">
              {slide.title}
            </Text>
            <Text variant="body" tone="secondary" align="center" style={styles.body}>
              {slide.body}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <View style={styles.dots} accessibilityLabel={`Page ${page + 1} of ${slides.length}`}>
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
  skipRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: theme.spacing.sm,
  },
  pager: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  badge: {
    width: 96,
    height: 96,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryMuted,
    marginBottom: theme.spacing.sm,
  },
  body: {
    maxWidth: 320,
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
