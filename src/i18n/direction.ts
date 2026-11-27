import { I18nManager } from 'react-native';

import { appLocale } from './index';

// Follows the active string table's direction so English never mirrors on an RTL device.
export function wantsRTL(): boolean {
  if (__DEV__ && process.env.EXPO_PUBLIC_RTL_PREVIEW === '1') return true;
  return appLocale().direction === 'rtl';
}

// Persisted natively by I18nManager; direction changes apply on the next launch.
export function applyLayoutDirection(): void {
  const rtl = wantsRTL();
  if (I18nManager.isRTL === rtl) return;
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
}
