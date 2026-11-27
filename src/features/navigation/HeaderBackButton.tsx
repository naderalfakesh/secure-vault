import { router } from 'expo-router';

import { IconButton } from '@/components/ui';
import { t } from '@/i18n';

export function HeaderBackButton() {
  return (
    <IconButton icon="back" accessibilityLabel={t('common.back')} onPress={() => router.back()} />
  );
}
