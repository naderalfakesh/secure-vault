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
