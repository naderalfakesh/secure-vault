import { useEffect, useState } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { HANDOFF_FADE_MS, HANDOFF_FALLBACK_MS, HANDOFF_SETTLE_MS } from './constants';
import { pinnedDiffers, systemScheme } from './helpers';
import type { SplashHandoffProps } from './types';

/** When and how the handoff overlay leaves; see `SplashHandoff`. */
export function useHandoffFade({ released, onDone }: SplashHandoffProps) {
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
      timer = setTimeout(() => setDone(true), HANDOFF_FADE_MS + HANDOFF_SETTLE_MS);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
    };
  }, [released, reduceMotion, switches, opacity]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return { scheme, gone, fadeStyle };
}
