import { router, Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { Button, Group, ListRow, Screen, Text } from '@/components/ui';
import {
  mlKitDisclosure,
  PROTECTION_LIMITS,
  protectionFacts,
} from '@/features/session/protectionCopy';
import { t } from '@/i18n';

import { useKeyProtection } from './hooks/useKeyProtection';
import { styles } from './ProtectionScreen.styles';

/** How your data is protected: plain facts, then the limits. */
export function ProtectionScreen() {
  // Where this device keeps the key; the plain sentence shows until it answers.
  const protection = useKeyProtection();

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.bar}>
        <Button
          label={t('settings.title')}
          variant="plain"
          size="md"
          icon="back"
          onPress={() => router.back()}
        />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="largeTitle" accessibilityRole="header" style={styles.title}>
          {t('settings.protection')}
        </Text>
        <Group header={t('settings.protection.does')} separatorInset="content">
          {protectionFacts(protection).map((fact) => (
            <ListRow key={fact} icon="check" tint="success" title={fact} />
          ))}
          {/* What ML Kit sends is a notice, not a protection: no success check. */}
          <ListRow icon="info" tint="neutral" title={mlKitDisclosure()} />
        </Group>
        <Group header={t('settings.protection.cant')} separatorInset="content">
          {PROTECTION_LIMITS.map((limit) => (
            <ListRow key={limit} icon="warning" tint="warning" title={limit} />
          ))}
        </Group>
      </ScrollView>
    </Screen>
  );
}
