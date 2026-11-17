import { router } from 'expo-router';
import { Linking } from 'react-native';

import { Group, ListRow } from '@/components/ui';
import { t } from '@/i18n';

import { appVersion } from '../../appVersion';
import { SOURCE_URL } from '../../constants';

export function AboutGroup() {
  return (
    <Group header={t('settings.group.about')} separatorInset="content">
      <ListRow
        icon="shield"
        tint="neutral"
        title={t('settings.protection')}
        onPress={() => router.push('/settings/protection')}
      />
      <ListRow
        icon="document"
        tint="neutral"
        title={t('settings.sourceCode')}
        value={t('settings.sourceCode.value')}
        onPress={() => void Linking.openURL(SOURCE_URL).catch(() => {})}
        trailing={null}
      />
      <ListRow icon="info" tint="neutral" title={t('settings.version')} value={appVersion()} />
    </Group>
  );
}
