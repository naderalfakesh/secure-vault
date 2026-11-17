import { TAB_BAR_BOTTOM, TAB_BAR_HEIGHT } from '@/components/ui';

/** Room left under the last row, above the floating tab bar. */
const GAP = 24;

/** Bottom padding that lets a tab's scroll content clear the floating tab bar. */
export function tabBarClearance(insetBottom: number): number {
  return TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + insetBottom + GAP;
}
