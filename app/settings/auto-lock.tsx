import { router, Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, Group, InlineAlert, ListRow, Screen, Text } from '@/components/ui';
import { useSession } from '@/features/session/SessionProvider';
import { AUTO_LOCK_OPTIONS, autoLockChoice } from '@/features/session/settings';

/** Auto-lock (handover §6 Settings): a radio list, counted from leaving the app. */
export default function AutoLockScreen() {
  const { settings, updateSettings } = useSession();

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.bar}>
        <Button
          label="Settings"
          variant="plain"
          size="md"
          icon="back"
          onPress={() => router.back()}
        />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="largeTitle" accessibilityRole="header" style={styles.title}>
          Auto-lock
        </Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Auto-lock">
          <Group
            header="Lock the vault"
            footer="Counted from when you leave SecureVault. The privacy cover hides the vault straight away either way."
          >
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
          <InlineAlert
            tone="warning"
            announce
            message="Anyone holding your unlocked phone can open the vault."
          />
        ) : null}
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
