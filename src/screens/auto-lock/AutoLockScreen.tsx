import { router, Stack } from 'expo-router';
import { View } from 'react-native';

import { BackBar, Group, InlineAlert, ListRow, Screen, TitledScroll } from '@/components/ui';
import { useSessionActions, useSessionState } from '@/features/session/SessionProvider';
import { AUTO_LOCK_OPTIONS, autoLockChoice } from '@/features/session/settings';
import { t } from '@/i18n';

/** Auto-lock: a radio list, counted from leaving the app. */
export function AutoLockScreen() {
  const { settings } = useSessionState();
  const { updateSettings } = useSessionActions();

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <BackBar label={t('settings.title')} onPress={() => router.back()} />
      <TitledScroll title={t('settings.autoLock')}>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('settings.autoLock')}>
          <Group header={t('settings.autoLock.header')} footer={t('settings.autoLock.footer')}>
            {AUTO_LOCK_OPTIONS.map((option) => (
              <ListRow
                key={option}
                title={autoLockChoice(option)}
                checked={settings.autoLockSeconds === option}
                onPress={() => void updateSettings({ autoLockSeconds: option })}
              />
            ))}
          </Group>
        </View>
        {settings.autoLockSeconds === -1 ? (
          <InlineAlert tone="warning" announce message={t('settings.autoLock.neverWarning')} />
        ) : null}
      </TitledScroll>
    </Screen>
  );
}
