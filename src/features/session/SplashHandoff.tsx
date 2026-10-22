import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { Mark } from '@/components/ui';
import { getAppearance } from '@/theme/appearance';
import { darkColors, lightColors } from '@/theme/colors';

/** The native splash draws the 72 pt mark in the middle of the window (§3.5). */
export const SPLASH_MARK = 72;
/** The cross-fade from the splash repaint to the screen underneath. */
export const HANDOFF_FADE_MS = 200;
/** Whatever happens to layout or timers, the overlay is gone this long after release. */
export const HANDOFF_FALLBACK_MS = 1500;

/**
 * The system scheme, read when the overlay mounts. That is before the stored
 * Appearance setting is applied, so a pinned light or dark app still gets the
 * colours the native splash used, which always follow the system.
 */
function systemScheme(): 'light' | 'dark' {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

/** True when a pinned Appearance draws the app in the other scheme. */
function pinnedDiffers(scheme: 'light' | 'dark'): boolean {
  const pinned = getAppearance();
  return pinned !== 'system' && pinned !== scheme;
}

/**
 * Picks up where the native splash leaves off (§3.5): the same background and
 * the same 72 pt mark in the same place. Once the native splash hides, the
 * screen underneath is already drawn with its own mark in place, and the
 * overlay simply cross-fades out over 200 ms. Nothing travels, so there is
 * never a second moving mark. With reduced motion it goes at once. It never
 * takes touches, is hidden from assistive tech, and is gone at the latest
 * 1.5 s after release.
 *
 * When the pinned Appearance differs from the system scheme there is no fade:
 * a cross-fade between a light and a dark screen reads as a flicker, and the
 * screen underneath may still be settling into the pinned theme. The overlay
 * keeps the system colours (and the status bar to match), covers everything
 * for the length of the fade, then goes at once: one clean switch.
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
  // Frozen at mount: a pinned Appearance applied later must not flip it.
  const [scheme] = useState(systemScheme);
  const [done, setDone] = useState(false);
  const opacity = useSharedValue(1);
  // The pinned Appearance is applied before the release, so it is known here.
  const switches = released && pinnedDiffers(scheme);
  // Reduced motion: no fade at all, the overlay goes with the native splash;
  // when the schemes differ it is held as long as without reduced motion.
  const gone = done || (released && reduceMotion && !switches);

  useEffect(() => {
    if (gone) onDone?.();
  }, [gone, onDone]);

  // Hard stop: the overlay never outlives the release by more than this.
  useEffect(() => {
    if (!released) return;
    const timer = setTimeout(() => setDone(true), HANDOFF_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [released]);

  useEffect(() => {
    if (!released || (reduceMotion && !switches)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // One frame first, so the screen underneath has been drawn.
    const frame = requestAnimationFrame(() => {
      if (switches) {
        // Fully opaque until it goes, in one frame.
        timer = setTimeout(() => setDone(true), HANDOFF_FADE_MS);
        return;
      }
      opacity.value = withTiming(0, {
        duration: HANDOFF_FADE_MS,
        easing: Easing.out(Easing.quad),
      });
      timer = setTimeout(() => setDone(true), HANDOFF_FADE_MS + 32);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
    };
  }, [released, reduceMotion, switches, opacity]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (gone) return null;

  return (
    <Animated.View
      style={[styles.root, { backgroundColor: splashBackground[scheme] }, fadeStyle]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="splash-handoff"
    >
      {/* The status bar matches the overlay, not the pinned scheme, while it shows. */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Mark size={SPLASH_MARK} scheme={scheme} testID="splash-handoff-mark" />
    </Animated.View>
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
});
