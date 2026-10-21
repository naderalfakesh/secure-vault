import { I18nManager } from 'react-native';

import { appLocale } from './index';

/**
 * Whether the layout should run right to left: the direction of the language
 * the app actually speaks (F17). A phone set to Arabic stays left to right
 * until an Arabic table ships, so English never renders mirrored. Development
 * builds can preview the mirrored layout with `EXPO_PUBLIC_RTL_PREVIEW=1`.
 */
export function wantsRTL(): boolean {
  if (__DEV__ && process.env.EXPO_PUBLIC_RTL_PREVIEW === '1') return true;
  return appLocale().direction === 'rtl';
}

/**
 * Tells React Native which direction to lay out in. The setting is stored
 * natively and applies from the next launch, so a change of language mirrors
 * the app the next time it opens; the current session keeps its layout.
 */
export function applyLayoutDirection(): void {
  const rtl = wantsRTL();
  if (I18nManager.isRTL === rtl) return;
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
}
