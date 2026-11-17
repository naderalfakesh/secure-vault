import { t } from '@/i18n';
import type { AppearancePreference } from '@/theme/appearance';

export const SOURCE_URL = 'https://github.com/naderalfakesh/secure-vault';

export const APPEARANCE_CHOICES: { value: AppearancePreference; label: string }[] = [
  { value: 'system', label: t('settings.appearance.system') },
  { value: 'light', label: t('settings.appearance.light') },
  { value: 'dark', label: t('settings.appearance.dark') },
];
