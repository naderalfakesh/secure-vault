import { t } from '@/i18n';
import type { AppearancePreference } from '@/theme/appearance';

export const SOURCE_URL = 'https://github.com/naderalfakesh/secure-vault';

/** Room left under the last group, above the floating tab bar. */
export const SCROLL_BOTTOM_GAP = 24;

export const APPEARANCE_CHOICES: { value: AppearancePreference; label: string }[] = [
  { value: 'system', label: t('settings.appearance.system') },
  { value: 'light', label: t('settings.appearance.light') },
  { value: 'dark', label: t('settings.appearance.dark') },
];
