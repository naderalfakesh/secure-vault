import { useEffect } from 'react';
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
