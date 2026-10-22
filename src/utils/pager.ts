import { I18nManager } from 'react-native';

export type PagerScroll = {
  /** `contentOffset.x` as the native scroll view reports it: always from the left edge. */
  offsetX: number;
  /** Width of one page, the scroll view's own width. */
  pageWidth: number;
  /** `contentSize.width`, all pages together. */
  contentWidth: number;
  pageCount: number;
  rtl?: boolean;
};

/**
 * The page a horizontal pager rests on. Native scroll views measure the
 * offset from the left edge in both directions, but in a right-to-left layout
 * the first page sits at the right end, so the offset counts from the end.
 */
export function pageFromOffset({
  offsetX,
  pageWidth,
  contentWidth,
  pageCount,
  rtl = I18nManager.isRTL,
}: PagerScroll): number {
  if (pageWidth <= 0 || pageCount <= 0) return 0;
  const fromStart = rtl ? contentWidth - pageWidth - offsetX : offsetX;
  return Math.min(pageCount - 1, Math.max(0, Math.round(fromStart / pageWidth)));
}

/** The `x` to pass to `scrollTo` so that page `index` shows, in either direction. */
export function offsetForPage(
  index: number,
  pageWidth: number,
  pageCount: number,
  rtl = I18nManager.isRTL,
): number {
  const clamped = Math.min(Math.max(index, 0), Math.max(pageCount - 1, 0));
  return (rtl ? pageCount - 1 - clamped : clamped) * pageWidth;
}

/** The way a finger moved across the screen. */
export type SwipeDirection = 'left' | 'right';

/**
 * The page a horizontal swipe leads to, or `null` past either end. A leftward
 * swipe brings in the page to the right: the next one left to right, the
 * previous one right to left, where the pager is mirrored.
 */
export function pageForSwipe(
  index: number,
  direction: SwipeDirection,
  pageCount: number,
  rtl = I18nManager.isRTL,
): number | null {
  const forward = (direction === 'left') !== rtl;
  const target = index + (forward ? 1 : -1);
  return target >= 0 && target < pageCount ? target : null;
}

/** How far past the edge a zoomed page has to be dragged to turn the page. */
export const EDGE_SWIPE_DISTANCE = 56;

/**
 * Whether a one-finger drag on a zoomed page should turn the page: it started
 * with the page already against that edge and pulled past it by
 * `EDGE_SWIPE_DISTANCE`. A drag that only reaches the edge pans; the next one
 * pages. `bound` is how far the page can move either way at its scale.
 */
export function edgeSwipe(
  startX: number,
  translationX: number,
  bound: number,
): SwipeDirection | null {
  'worklet';
  const slop = 1;
  const endX = startX + translationX;
  // Dragging left reveals the right edge, where the page sits at -bound.
  if (startX <= -bound + slop && endX < -bound - EDGE_SWIPE_DISTANCE) return 'left';
  if (startX >= bound - slop && endX > bound + EDGE_SWIPE_DISTANCE) return 'right';
  return null;
}
