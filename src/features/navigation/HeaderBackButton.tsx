import { router } from 'expo-router';

import { IconButton } from '@/components/ui';
import { t } from '@/i18n';

/** One explicit back control so the header reads the same on iOS and Android. */
export function HeaderBackButton() {
  return (
    <IconButton icon="back" accessibilityLabel={t('common.back')} onPress={() => router.back()} />
  );
}
