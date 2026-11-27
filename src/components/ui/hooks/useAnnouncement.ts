import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

// iOS ignores accessibilityLiveRegion, so announce changes explicitly via AccessibilityInfo.
export function useAnnouncement(message: string | null | undefined, enabled = true): void {
  useEffect(() => {
    if (!enabled || !message || Platform.OS !== 'ios') return;
    AccessibilityInfo.announceForAccessibility(message);
  }, [enabled, message]);
}

// Throttled iOS-only announcement so rapid progress updates don't flood VoiceOver (Android queues live regions).
export function useThrottledAnnouncement(
  message: string | null | undefined,
  intervalMs = 3000,
  enabled = true,
): void {
  const last = useRef(0);
  useEffect(() => {
    if (!enabled || !message || Platform.OS !== 'ios') return;
    const now = Date.now();
    if (last.current && now - last.current < intervalMs) return;
    last.current = now;
    AccessibilityInfo.announceForAccessibility(message);
  }, [enabled, intervalMs, message]);
}
