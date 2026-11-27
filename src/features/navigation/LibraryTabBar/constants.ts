import type { IconName } from '@/components/ui';
import type { StringKey } from '@/i18n';

export const TABS: Record<string, { label: StringKey; icon: IconName }> = {
  index: { label: 'nav.library', icon: 'library' },
  settings: { label: 'nav.settings', icon: 'settings' },
};
