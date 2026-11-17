import { useCallback, useEffect, useState } from 'react';

import type { SwipeDirection } from '@/utils/pager';

type Options = {
  uri: string;
  onZoomChange: (zoomed: boolean) => void;
  onEdgeSwipe?: (direction: SwipeDirection) => void;
};

/**
 * The JS side of the page's zoom: whether it is zoomed, and the reports to
 * the pager when that changes.
 */
export function useZoomState({ uri, onZoomChange, onEdgeSwipe }: Options) {
  // Mirrors the scale on the JS side so the zoomed pan only exists while
  // zoomed. At rest it must not activate at all: an active pan claims the
  // touch, and the pager underneath never sees the horizontal swipe.
  const [zoomed, setZoomed] = useState(false);
  // A new page starts at rest: a page zoomed when it was swapped drops the
  // zoom here, and the effect below tells the pager.
  const [shownUri, setShownUri] = useState(uri);
  const [restAfterSwap, setRestAfterSwap] = useState(false);
  if (shownUri !== uri) {
    setShownUri(uri);
    if (zoomed) {
      setZoomed(false);
      setRestAfterSwap(true);
    }
  }

  const reportZoom = useCallback(
    (value: boolean) => {
      setZoomed(value);
      setRestAfterSwap(false);
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

  useEffect(() => {
    if (restAfterSwap) onZoomChange(false);
  }, [restAfterSwap, onZoomChange]);

  return { zoomed, reportZoom, reportEdgeSwipe };
}
