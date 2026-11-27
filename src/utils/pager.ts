import { I18nManager } from 'react-native';

export type PagerScroll = {
  offsetX: number;
  pageWidth: number;
  contentWidth: number;
  pageCount: number;
  rtl?: boolean;
};

// Native scroll views measure contentOffset.x from the left in both directions, so RTL counts from the end.
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

export function offsetForPage(
  index: number,
  pageWidth: number,
  pageCount: number,
  rtl = I18nManager.isRTL,
): number {
  const clamped = Math.min(Math.max(index, 0), Math.max(pageCount - 1, 0));
  return (rtl ? pageCount - 1 - clamped : clamped) * pageWidth;
}

export type SwipeDirection = 'left' | 'right';

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

export const EDGE_SWIPE_DISTANCE = 56;

// Turns page only when drag starts already at the zoom bound and pulls EDGE_SWIPE_DISTANCE past it.
export function edgeSwipe(
  startX: number,
  translationX: number,
  bound: number,
): SwipeDirection | null {
  'worklet';
  const slop = 1;
  const endX = startX + translationX;
  if (startX <= -bound + slop && endX < -bound - EDGE_SWIPE_DISTANCE) return 'left';
  if (startX >= bound - slop && endX > bound + EDGE_SWIPE_DISTANCE) return 'right';
  return null;
}
