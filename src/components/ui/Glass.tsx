import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

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
 * Liquid Glass for chrome only (handover §2, F16): the tab bar and sheets on
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

/**
 * The glass layer behind a chrome surface: fills its parent, follows the
 * app's own light or dark choice, and takes the parent's corner radii.
 */
export function GlassBackground({ style }: { style?: StyleProp<ViewStyle> }) {
  const { rt } = useUnistyles();
  return (
    <GlassView
      glassEffectStyle="regular"
      colorScheme={rt.themeName === 'dark' ? 'dark' : 'light'}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
    />
  );
}
