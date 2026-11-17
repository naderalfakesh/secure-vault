import { controlSize } from '@/theme/tokens';

import type { PinPadMetrics } from './types';

/**
 * Keypad size for a window height. The design's 76 pt keys fit a regular
 * phone; on short windows (a 411 × 648 dp Android phone, split screen) the
 * keys and gaps step down so the pad never covers the title and the dots.
 * The smallest step stays well above the 44 pt minimum target.
 */
export function pinPadMetrics(windowHeight: number): PinPadMetrics {
  if (windowHeight >= 780)
    return { key: controlSize.pinKey, rowGap: 16, columnGap: 26, compact: false };
  if (windowHeight >= 700) return { key: 68, rowGap: 12, columnGap: 24, compact: true };
  if (windowHeight >= 620) return { key: 60, rowGap: 10, columnGap: 22, compact: true };
  return { key: 52, rowGap: 8, columnGap: 20, compact: true };
}
