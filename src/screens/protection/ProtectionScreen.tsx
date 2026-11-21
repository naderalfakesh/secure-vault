import { router, Stack } from 'expo-router';

import { BackBar, Group, ListRow, Screen, TitledScroll } from '@/components/ui';
import {
  mlKitDisclosure,
  PROTECTION_LIMITS,
  protectionFacts,
} from '@/features/session/protectionCopy';
import { t } from '@/i18n';

import { useKeyProtection } from './hooks/useKeyProtection';

/** How your data is protected: plain facts, then the limits. */
export function ProtectionScreen() {
  // Where this device keeps the key; the plain sentence shows until it answers.
  const protection = useKeyProtection();
  const mlKitNotice = mlKitDisclosure();

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <BackBar label={t('settings.title')} onPress={() => router.back()} />
      <TitledScroll title={t('settings.protection')}>
        <Group header={t('settings.protection.does')} separatorInset="content">
          {protectionFacts(protection).map((fact) => (
            <ListRow key={fact} icon="check" tint="success" title={fact} />
          ))}
          {/* Android: what ML Kit sends is a notice, not a protection, so no success check. */}
          {mlKitNotice ? <ListRow icon="info" tint="neutral" title={mlKitNotice} /> : null}
        </Group>
        <Group header={t('settings.protection.cant')} separatorInset="content">
          {PROTECTION_LIMITS.map((limit) => (
            <ListRow key={limit} icon="warning" tint="warning" title={limit} />
          ))}
        </Group>
      </TitledScroll>
    </Screen>
  );
}
