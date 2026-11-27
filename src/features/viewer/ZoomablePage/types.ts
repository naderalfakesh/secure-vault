import type { SharedValue } from 'react-native-reanimated';

import type { SwipeDirection } from '@/utils/pager';

export interface ZoomablePageProps {
  uri: string;
  /** Screen-reader label for the page. */
  label: string;
  /** Fires when the page moves between rest scale and zoomed, so the pager can lock. */
  onZoomChange: (zoomed: boolean) => void;
  /** A vertical drag past the threshold at rest scale. */
  onDismiss: () => void;
  onTap: () => void;
  /** Progress of a dismiss drag, 0 to 1, for the pager's backdrop. */
  dismissProgress: SharedValue<number>;
  /** Whether a page lies beyond each edge, for a drag past the edge while zoomed. */
  canSwipe?: { left: boolean; right: boolean };
  /** A zoomed drag pulled past an edge: the page has zoomed out, turn to the neighbour. */
  onEdgeSwipe?: (direction: SwipeDirection) => void;
  /** Prefix for the gestures' test ids. */
  testID?: string;
}

export type UseZoomGesturesOptions = {
  /** Prefix for the gestures' test ids. */
  testID: string;
  zoomed: boolean;
  reportZoom: (zoomed: boolean) => void;
  reportEdgeSwipe: (direction: SwipeDirection) => void;
  onDismiss: () => void;
  onTap: () => void;
  dismissProgress: SharedValue<number>;
  canSwipe: { left: boolean; right: boolean };
};
