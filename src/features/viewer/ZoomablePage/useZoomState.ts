import { useCallback, useState } from 'react';

import type { SwipeDirection } from '@/utils/pager';

type Options = {
  onZoomChange: (zoomed: boolean) => void;
  onEdgeSwipe?: (direction: SwipeDirection) => void;
};

/**
 * The JS side of the page's zoom: whether it is zoomed, and the reports to
 * the pager when that changes.
 */
export function useZoomState({ onZoomChange, onEdgeSwipe }: Options) {
  // Mirrors the scale on the JS side so the zoomed pan only exists while
  // zoomed. At rest it must not activate at all: an active pan claims the
  // touch, and the pager underneath never sees the horizontal swipe.
  const [zoomed, setZoomed] = useState(false);

  const reportZoom = useCallback(
    (value: boolean) => {
      setZoomed(value);
      onZoomChange(value);
    },
    [onZoomChange],
  );

  const reportEdgeSwipe = useCallback(
    (direction: SwipeDirection) => {
      reportZoom(false);
      onEdgeSwipe?.(direction);
    },
    [reportZoom, onEdgeSwipe],
  );

  return { zoomed, reportZoom, reportEdgeSwipe };
}
