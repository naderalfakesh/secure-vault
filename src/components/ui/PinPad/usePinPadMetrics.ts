import { useWindowDimensions } from 'react-native';

import { pinPadMetrics } from './helpers';
import type { PinPadMetrics } from './types';

/** The keypad metrics for the current window. */
export function usePinPadMetrics(): PinPadMetrics {
  const { height } = useWindowDimensions();
  return pinPadMetrics(height);
}
