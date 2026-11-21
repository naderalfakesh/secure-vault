import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Speaks `message` when it appears or changes. Android announces live regions
 * itself, so this only fills the gap on iOS, which ignores them.
 */
export function useAnnouncement(message: string | null | undefined, enabled = true): void {
  useEffect(() => {
    if (!enabled || !message || Platform.OS !== 'ios') return;
    AccessibilityInfo.announceForAccessibility(message);
  }, [enabled, message]);
}

/**
 * Like `useAnnouncement`, for a line that changes quickly, such as
 * "Checking 18 of 48": iOS hears it when it appears, then at most once every
 * `intervalMs`, so VoiceOver is not flooded. Android's polite live region
 * queues the changes itself.
 */
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
