import { controlSize } from '@/theme/tokens';

import type { PinPadMetrics } from './types';

export function pinPadMetrics(windowHeight: number): PinPadMetrics {
  if (windowHeight >= 780)
    return { key: controlSize.pinKey, rowGap: 16, columnGap: 26, compact: false };
  if (windowHeight >= 700) return { key: 68, rowGap: 12, columnGap: 24, compact: true };
  if (windowHeight >= 620) return { key: 60, rowGap: 10, columnGap: 22, compact: true };
  return { key: 52, rowGap: 8, columnGap: 20, compact: true };
}
