import type { SharedValue } from 'react-native-reanimated';

import type { SwipeDirection } from '@/utils/pager';

export interface ZoomablePageProps {
  uri: string;
  label: string;
  onZoomChange: (zoomed: boolean) => void;
  onDismiss: () => void;
  onTap: () => void;
  dismissProgress: SharedValue<number>;
  canSwipe?: { left: boolean; right: boolean };
  onEdgeSwipe?: (direction: SwipeDirection) => void;
  testID?: string;
}

export type UseZoomGesturesOptions = {
  testID: string;
  zoomed: boolean;
  reportZoom: (zoomed: boolean) => void;
  reportEdgeSwipe: (direction: SwipeDirection) => void;
  onDismiss: () => void;
  onTap: () => void;
  dismissProgress: SharedValue<number>;
  canSwipe: { left: boolean; right: boolean };
};
