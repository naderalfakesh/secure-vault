import { useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { Mark } from '@/components/ui';

/** The native splash draws the 72 pt mark in the middle of the window (§3.5). */
export const SPLASH_MARK = 72;
const MOVE_MS = 360;
const FADE_MS = 200;
/** How long to wait for the lock screen to report where its mark sits. */
const TARGET_WAIT_MS = 250;

export type MarkFrame = { x: number; y: number; size: number };

let target: MarkFrame | null = null;
const listeners = new Set<() => void>();

/**
 * The lock screen reports where its mark sits in the window, so the splash
 * handoff can carry the splash mark there. Null when it should not (lockout).
 */
export function reportSplashTarget(frame: MarkFrame | null) {
  target = frame;
  listeners.forEach((listener) => listener());
}

/** Test hook. */
export function resetSplashTarget() {
  target = null;
  listeners.clear();
}

function waitForTarget(ms: number): Promise<MarkFrame | null> {
  if (target) return Promise.resolve(target);
  return new Promise((resolve) => {
    const done = () => {
      listeners.delete(onReport);
      clearTimeout(timer);
      resolve(target);
    };
    const onReport = () => {
      if (target) done();
    };
    const timer = setTimeout(done, ms);
    listeners.add(onReport);
  });
}

/**
 * Picks up where the native splash leaves off (§3.5): the same background and
 * the same 72 pt mark in the same place. Once the native splash hides, the
 * mark glides to the lock screen's mark while the background fades, so the
 * two marks meet with no jump. With reduced motion, or on a screen without the
 * mark (setup, vault unavailable), it only cross-fades. It never takes touches
 * and is hidden from assistive tech.
 */
export function SplashHandoff({ released }: { released: boolean }) {
  const reduceMotion = useReducedMotion();
  const [done, setDone] = useState(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const progress = useSharedValue(0);
  // Where the mark travels: offset from the middle, scale, and whether it travels at all.
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const scale = useSharedValue(1);
  const carry = useSharedValue(0);
  const started = useRef(false);

  useEffect(() => {
    if (!released || !size || started.current) return;
    started.current = true;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    waitForTarget(reduceMotion ? 0 : TARGET_WAIT_MS).then((frame) => {
      if (cancelled) return;
      const travels = frame !== null && !reduceMotion;
      if (frame && travels) {
        dx.value = frame.x + frame.size / 2 - size.width / 2;
        dy.value = frame.y + frame.size / 2 - size.height / 2;
        scale.value = frame.size / SPLASH_MARK;
        carry.value = 1;
      }
      const duration = travels ? MOVE_MS : FADE_MS;
      progress.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
      timer = setTimeout(() => setDone(true), duration + 32);
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [released, size, reduceMotion, progress, dx, dy, scale, carry]);

  const backgroundStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const markStyle = useAnimatedStyle(() => ({
    // Carried to the lock screen's identical mark, it stays opaque and lands
    // on top of it; otherwise it fades with the background.
    opacity: carry.value ? 1 : 1 - progress.value,
    transform: [
      { translateX: dx.value * progress.value },
      { translateY: dy.value * progress.value },
      { scale: 1 + (scale.value - 1) * progress.value },
    ],
  }));

  if (done) return null;

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  return (
    <View
      style={styles.root}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={onLayout}
      testID="splash-handoff"
    >
      <Animated.View style={[styles.background, backgroundStyle]} />
      <Animated.View style={markStyle}>
        <Mark size={SPLASH_MARK} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background,
  },
}));
