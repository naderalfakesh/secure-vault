import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/** Whether this iOS build and device can draw Liquid Glass (iOS 26+). */
function glassSupported(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    // Some iOS 26 betas lack the API and crash on it, so both checks run.
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
}

/**
 * Liquid Glass for chrome only: the tab bar and sheets on
 * iOS 26+. False on Android, on older iOS, and while Reduce Transparency is
 * on, where those surfaces stay solid.
 */
export function useGlass(): boolean {
  const [supported] = useState(glassSupported);
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    if (!supported) return;
    let active = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((enabled) => {
        if (active) setReduceTransparency(enabled);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, [supported]);

  return supported && !reduceTransparency;
}
