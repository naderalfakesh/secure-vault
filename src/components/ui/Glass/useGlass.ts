import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

function glassSupported(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    // Both checks required: some iOS 26 betas expose isLiquidGlassAvailable() without the effect API and crash.
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
}

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
