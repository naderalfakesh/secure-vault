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

export function useHandoffFade({ released, onDone }: SplashHandoffProps) {
  const reduceMotion = useReducedMotion();
  // Frozen at mount so applying a pinned Appearance later doesn't flip the overlay.
  const [scheme] = useState(systemScheme);
  const [done, setDone] = useState(false);
  const opacity = useSharedValue(1);
  const switches = released && pinnedDiffers(scheme);
  const gone = done || (released && reduceMotion && !switches);

  useEffect(() => {
    if (gone) onDone?.();
  }, [gone, onDone]);

  useEffect(() => {
    if (!released) return;
    const timer = setTimeout(() => setDone(true), HANDOFF_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [released]);

  useEffect(() => {
    if (!released || (reduceMotion && !switches)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Wait one frame so the screen underneath has drawn before fading.
    const frame = requestAnimationFrame(() => {
      if (switches) {
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
