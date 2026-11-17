import type { IconName } from '@/components/ui';
import type { StringKey } from '@/i18n';

/** The tabs the bar shows, by route name; the Scan button sits between them. */
export const TABS: Record<string, { label: StringKey; icon: IconName }> = {
  index: { label: 'nav.library', icon: 'library' },
  settings: { label: 'nav.settings', icon: 'settings' },
};
