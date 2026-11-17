import { TAB_BAR_BOTTOM, TAB_BAR_HEIGHT } from '@/components/ui';

import { tabBarClearance } from '../tabBarClearance';

describe('tabBarClearance', () => {
  it('clears the floating tab bar and the home indicator', () => {
    expect(tabBarClearance(34)).toBe(TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + 34 + 24);
    expect(tabBarClearance(34) - tabBarClearance(0)).toBe(34);
  });
});
