import { TAB_BAR_BOTTOM, TAB_BAR_HEIGHT } from '@/components/ui';

const GAP = 24;

export function tabBarClearance(insetBottom: number): number {
  return TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + insetBottom + GAP;
}
