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
import { markGlyphSize } from '@/components/ui/Mark';

/** The native splash draws the 72 pt mark in the middle of the window (§3.5). */
export const SPLASH_MARK = 72;
const MOVE_MS = 360;
const FADE_MS = 200;
/** How long to wait for the lock screen to report where its mark sits. */
const TARGET_WAIT_MS = 250;
/** Whatever happens to layout or timers, the overlay is gone this long after release. */
export const HANDOFF_FALLBACK_MS = 1500;

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

export type HandoffPlan = { dx: number; dy: number; scale: number; glyphScale: number };

/**
 * Where the splash mark goes: its offset from the middle of the root, the
 * squircle's scale, and the glyph's own extra scale. The glyph lands at the
 * lock mark's glyph size (38 on 64), not the scaled splash glyph (39.1).
 */
export function planHandoff(
  frame: MarkFrame,
  root: { width: number; height: number },
): HandoffPlan {
  const scale = frame.size / SPLASH_MARK;
  return {
    dx: frame.x + frame.size / 2 - root.width / 2,
    dy: frame.y + frame.size / 2 - root.height / 2,
    scale,
    glyphScale: markGlyphSize(frame.size) / markGlyphSize(SPLASH_MARK) / scale,
  };
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
  // The latest root size. A ref, so a resize mid-handoff (Split View, Stage
  // Manager, a foldable) never restarts or cancels the handoff.
  const size = useRef<{ width: number; height: number } | null>(null);
  const [measured, setMeasured] = useState(false);
  const progress = useSharedValue(0);
  // Where the mark travels: offset from the middle, squircle scale, the
  // glyph's own extra scale, and whether it travels at all.
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const scale = useSharedValue(1);
  const glyphScale = useSharedValue(1);
  const carry = useSharedValue(0);
  const started = useRef(false);
  // Mirrors `carry` for the render tree: gliding onto the lock mark, or fading.
  const [gliding, setGliding] = useState(false);

  // Hard stop: the overlay never outlives the release by more than this.
  useEffect(() => {
    if (!released) return;
    const timer = setTimeout(() => setDone(true), HANDOFF_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [released]);

  useEffect(() => {
    if (!released || !measured || started.current) return;
    started.current = true;
    // Runs once; nothing here is cancelled by a later render. The fallback
    // above and the unmount guard cover the rest.
    let unsubscribe = () => {};
    waitForTarget(reduceMotion ? 0 : TARGET_WAIT_MS).then((frame) => {
      const root = size.current;
      const travels = frame !== null && root !== null && !reduceMotion;
      if (frame && root && travels) {
        const plan = planHandoff(frame, root);
        dx.value = plan.dx;
        dy.value = plan.dy;
        scale.value = plan.scale;
        glyphScale.value = plan.glyphScale;
        carry.value = 1;
        setGliding(true);
        // The lock screen withdraws its mark when the lockout lands late:
        // fade instead of landing on the clock squircle.
        const onChange = () => {
          if (target) return;
          carry.value = 0;
          setGliding(false);
        };
        listeners.add(onChange);
        unsubscribe = () => listeners.delete(onChange);
      }
      const duration = travels ? MOVE_MS : FADE_MS;
      progress.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
      setTimeout(() => {
        unsubscribe();
        setDone(true);
      }, duration + 32);
    });
  }, [released, measured, reduceMotion, progress, dx, dy, scale, glyphScale, carry]);

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
  const glyphStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + (glyphScale.value - 1) * progress.value }],
  }));

  if (done) return null;

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    size.current = { width, height };
    setMeasured(true);
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
      <Mark
        size={SPLASH_MARK}
        style={markStyle}
        glyphStyle={glyphStyle}
        testID={gliding ? 'splash-handoff-mark-glide' : 'splash-handoff-mark-fade'}
      />
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
