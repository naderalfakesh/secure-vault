import { useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, useColorScheme, View, type ViewInstance } from 'react-native';
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
import { darkColors, lightColors } from '@/theme/colors';

/** The native splash draws the 72 pt mark in the middle of the window (§3.5). */
export const SPLASH_MARK = 72;
const MOVE_MS = 360;
const FADE_MS = 200;
/** How long to wait for the lock screen to report where its mark sits. */
const TARGET_WAIT_MS = 250;
/** Whatever happens to layout or timers, the overlay is gone this long after release. */
export const HANDOFF_FALLBACK_MS = 1500;
/** How long a fresh window measurement may take before the last one is used. */
const MEASURE_WAIT_MS = 50;

export type MarkFrame = { x: number; y: number; size: number };
type Measure = () => Promise<MarkFrame | null>;

let target: MarkFrame | null = null;
let measureTarget: Measure | null = null;
const listeners = new Set<() => void>();

/**
 * The lock screen reports where its mark sits in the window, so the splash
 * handoff can carry the splash mark there. Null when it should not (lockout).
 * `measure` lets the handoff measure the mark again just before it moves: the
 * first report can come before the safe-area insets settle, which shifts the
 * mark by a status bar without a new layout event on the mark itself.
 */
export function reportSplashTarget(frame: MarkFrame | null, measure?: Measure) {
  target = frame;
  measureTarget = frame ? (measure ?? null) : null;
  listeners.forEach((listener) => listener());
}

/** Test hook. */
export function resetSplashTarget() {
  target = null;
  measureTarget = null;
  listeners.clear();
}

/** A measurement, or `fallback` when the view does not answer in time. */
function measureOr<T>(measure: (() => Promise<T>) | null, fallback: T): Promise<T> {
  if (!measure) return Promise.resolve(fallback);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), MEASURE_WAIT_MS);
    measure()
      .then((value) => resolve(value ?? fallback))
      .catch(() => resolve(fallback))
      .finally(() => clearTimeout(timer));
  });
}

type RootFrame = { x: number; y: number; width: number; height: number };

function measureView(view: ViewInstance | null): Promise<RootFrame | null> {
  return new Promise((resolve) => {
    if (!view) {
      resolve(null);
      return;
    }
    view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
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
 * Both frames are window coordinates from the same measurement, so a root
 * that does not start at the top of the window (Android reports window
 * coordinates below the status bar) cancels out instead of leaving the mark
 * a status bar short.
 */
export function planHandoff(
  frame: MarkFrame,
  root: { x?: number; y?: number; width: number; height: number },
): HandoffPlan {
  const scale = frame.size / SPLASH_MARK;
  const rootX = root.x ?? 0;
  const rootY = root.y ?? 0;
  return {
    dx: frame.x + frame.size / 2 - (rootX + root.width / 2),
    dy: frame.y + frame.size / 2 - (rootY + root.height / 2),
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
export function SplashHandoff({
  released,
  onDone,
}: {
  released: boolean;
  /** Called once the overlay is gone, so the navigator can animate again. */
  onDone?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  // The native splash follows the system scheme, and so does this repaint:
  // the dark splash colours in dark mode (§3.5), never the light mark on a
  // dark background. A pinned Appearance updates the scheme once applied.
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [done, setDone] = useState(false);
  const rootRef = useRef<ViewInstance>(null);
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

  useEffect(() => {
    if (done) onDone?.();
  }, [done, onDone]);

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
    waitForTarget(reduceMotion ? 0 : TARGET_WAIT_MS)
      .then(async (reported) => {
        if (!reported || reduceMotion) return { frame: reported, root: size.current };
        // Measure both ends again, in the same window coordinates, right
        // before the move; the reported frame and the layout size are the
        // fallbacks.
        const layout = size.current;
        const [frame, root] = await Promise.all([
          measureOr(measureTarget, reported),
          measureOr<RootFrame | null>(
            () => measureView(rootRef.current),
            layout ? { x: 0, y: 0, ...layout } : null,
          ),
        ]);
        // A lockout that landed while measuring withdrew the target.
        return { frame: target ? frame : null, root };
      })
      .then(({ frame, root }) => {
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
      ref={rootRef}
      collapsable={false}
      style={styles.root}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={onLayout}
      testID="splash-handoff"
    >
      <Animated.View
        style={[styles.background, { backgroundColor: splashBackground[scheme] }, backgroundStyle]}
        testID="splash-handoff-background"
      />
      <Mark
        size={SPLASH_MARK}
        scheme={scheme}
        style={markStyle}
        glyphStyle={glyphStyle}
        testID={gliding ? 'splash-handoff-mark-glide' : 'splash-handoff-mark-fade'}
      />
    </View>
  );
}

/** The native splash backgrounds (app.json, §3.5). */
const splashBackground = { light: lightColors.background, dark: darkColors.background } as const;

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
});
