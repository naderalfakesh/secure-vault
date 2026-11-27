import { useCallback, useState } from 'react';

import type { SwipeDirection } from '@/utils/pager';

type Options = {
  onZoomChange: (zoomed: boolean) => void;
  onEdgeSwipe?: (direction: SwipeDirection) => void;
};

export function useZoomState({ onZoomChange, onEdgeSwipe }: Options) {
  // Mirrors scale on JS side so zoomedPan is disabled at rest and won't steal pager swipes.
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
