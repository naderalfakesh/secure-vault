import { useWindowDimensions } from 'react-native';

import { pinPadMetrics } from './helpers';
import type { PinPadMetrics } from './types';

export function usePinPadMetrics(): PinPadMetrics {
  const { height } = useWindowDimensions();
  return pinPadMetrics(height);
}
