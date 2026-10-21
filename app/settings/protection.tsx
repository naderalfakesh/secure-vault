import { router, Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, Group, ListRow, Screen, Text } from '@/components/ui';
import { PROTECTION_LIMITS, protectionFacts } from '@/features/session/protectionCopy';
import { t } from '@/i18n';

/** How your data is protected (handover §7.6): plain facts, then the limits. */
export default function ProtectionScreen() {
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
          {protectionFacts().map((fact) => (
            <ListRow key={fact} icon="check" tint="success" title={fact} />
          ))}
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

const styles = StyleSheet.create((theme) => ({
  bar: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: theme.spacing.xs,
  },
  content: {
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  title: {
    paddingHorizontal: theme.spacing.xxs,
  },
}));
