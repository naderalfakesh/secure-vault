import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Alert, Linking, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import {
  Button,
  Group,
  Icon,
  ListRow,
  Screen,
  SegmentedControl,
  Sheet,
  TAB_BAR_BOTTOM,
  TAB_BAR_HEIGHT,
  Text,
  useToast,
} from '@/components/ui';
import { clearLastBackup } from '@/features/backup/lastBackup';
import { useSession } from '@/features/session/SessionProvider';
import { autoLockLabel } from '@/features/session/settings';
import {
  biometricUnavailableReason,
  useBiometricAvailability,
} from '@/features/auth/biometricAvailability';
import { biometryIcon, biometryName } from '@/features/auth/lockCopy';
import { selectIntelligence } from '@/features/intelligence';
import { useBackupActivity } from '@/hooks/useBackupActivity';
import { backupService, describeBackupError } from '@/services/BackupService';
import { documentService } from '@/services/DocumentService';
import { type AppearancePreference, setAppearance, useAppearance } from '@/theme/appearance';

const SOURCE_URL = 'https://github.com/naderalfakesh/secure-vault';

/** "1.0.0 (12)": the app version, with the build number when the binary has one. */
function appVersion(): string {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const build = Platform.select({
    ios: Constants.expoConfig?.ios?.buildNumber,
    android: Constants.expoConfig?.android?.versionCode?.toString(),
  });
  return build ? `${version} (${build})` : version;
}

function eraseSubject(count: number | null): string {
  if (count === null || count === 0) return 'All documents';
  if (count === 1) return 'The 1 document';
  return `All ${count} documents`;
}

const APPEARANCE_CHOICES: { value: AppearancePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

// The erase finished, but the old PIN record survived both delete attempts.
const PIN_NOT_CLEARED =
  'Vault emptied, but the old PIN could not be removed. Set up the vault again now with a new PIN.';

export default function SettingsScreen() {
  const toast = useToast();
  const { lock, settings, updateSettings, biometry, eraseVault } = useSession();
  // The Delete everything sheet, with the number of documents it erases.
  const [erase, setErase] = useState<{ count: number | null } | null>(null);
  const insets = useSafeAreaInsets();
  const bottomSpace = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + insets.bottom + 24;
  const [engine, setEngine] = useState<string>('');
  const biometrics = useBiometricAvailability();
  const biometricReason = biometrics ? biometricUnavailableReason(biometrics) : null;
  useEffect(() => {
    let active = true;
    selectIntelligence().then((selected) => {
      if (active) setEngine(selected.engine);
    });
    return () => {
      active = false;
    };
  }, []);
  const appearance = useAppearance();
  const [busy, setBusy] = useState<'clear' | null>(null);
  // An export or restore, possibly started before the last lock, is still
  // running in the Backup hub; nothing may erase the vault under it.
  const running = useBackupActivity();
  const blocked = busy !== null || running !== null;

  const openErase = useCallback(() => {
    setErase({ count: null });
    documentService
      .countByCategory()
      .then((counts) => {
        const count = Object.values(counts).reduce((sum, value) => sum + (value ?? 0), 0);
        setErase((current) => (current ? { count } : current));
      })
      .catch(() => {});
  }, []);

  const clearAll = useCallback(() => {
    // Destructive and irreversible: the one place a native confirmation is right.
    Alert.alert(
      'Delete everything?',
      'Every document and the vault index are erased from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            setErase(null);
            setBusy('clear');
            try {
              const pinCleared = await backupService.exclusive('erase', async () => {
                await documentService.eraseEverything();
                await clearLastBackup();
                return eraseVault();
              });
              toast.show(
                pinCleared
                  ? { message: 'Vault emptied' }
                  : { message: PIN_NOT_CLEARED, tone: 'danger' },
              );
            } catch (e) {
              toast.show({
                message: describeBackupError(e, 'Could not clear the vault.'),
                tone: 'danger',
              });
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }, [toast, eraseVault]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomSpace }]}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="largeTitle" accessibilityRole="header" style={styles.title}>
          Settings
        </Text>

        <Group header="Security" separatorInset="content">
          {biometrics && biometrics.state !== 'unavailable' ? (
            <ListRow
              icon={biometryIcon(biometrics.kind)}
              title={Platform.OS === 'ios' ? biometryName(biometrics.kind) : 'Biometric unlock'}
              subtitle={biometricReason ?? 'Unlock without typing your PIN'}
              disabled={biometrics.state !== 'available'}
              toggle={{
                value: biometrics.state === 'available' && settings.biometricUnlock,
                onValueChange: (value) => void updateSettings({ biometricUnlock: value }),
              }}
            />
          ) : null}
          {biometrics?.state === 'denied' ? (
            <ListRow
              icon="settings"
              tint="neutral"
              title="Open Settings"
              onPress={() => void Linking.openSettings().catch(() => {})}
              trailing={null}
            />
          ) : null}
          <ListRow
            icon="clock"
            title="Auto-lock"
            value={autoLockLabel(settings.autoLockSeconds)}
            onPress={() => router.push('/settings/auto-lock')}
          />
          <ListRow
            icon="eyeOff"
            title="Privacy cover"
            subtitle="Hide the vault in the app switcher and block screenshots"
            toggle={{
              value: settings.privacyScreen,
              onValueChange: (value) => void updateSettings({ privacyScreen: value }),
            }}
          />
          {biometry !== 'none' ? (
            <ListRow
              icon="share"
              title="Confirm before sharing"
              subtitle={`Ask for ${biometryName(biometry)} before a copy leaves the vault`}
              toggle={{
                value: settings.biometricsForShare,
                onValueChange: (value) => void updateSettings({ biometricsForShare: value }),
              }}
            />
          ) : null}
          <ListRow
            icon="key"
            title="Change PIN"
            onPress={() => router.push('/settings/change-pin')}
          />
          <ListRow icon="lock" title="Lock now" onPress={lock} trailing={null} />
        </Group>

        <Group header="Data">
          <ListRow
            icon="backup"
            title="Backup"
            subtitle="Create or restore an encrypted backup"
            onPress={() => router.push('/settings/backup')}
          />
        </Group>

        <Group header="Appearance">
          <View style={styles.appearance}>
            <SegmentedControl
              accessibilityLabel="Appearance"
              options={APPEARANCE_CHOICES}
              value={appearance}
              onChange={(option) => void setAppearance(option)}
            />
          </View>
        </Group>

        <Group header="Suggestions">
          <ListRow
            icon="sparkles"
            tint="neutral"
            title="Detail suggestions"
            subtitle={
              engine === 'heuristic'
                ? 'Text patterns read on this device. No on-device model is used yet.'
                : engine
                  ? `On-device model: ${engine}`
                  : 'Checking'
            }
          />
        </Group>

        <Group header="About" separatorInset="content">
          <ListRow
            icon="shield"
            tint="neutral"
            title="How your data is protected"
            onPress={() => router.push('/settings/protection')}
          />
          <ListRow
            icon="document"
            tint="neutral"
            title="Source code"
            value="GitHub"
            onPress={() => void Linking.openURL(SOURCE_URL).catch(() => {})}
            trailing={null}
          />
          <ListRow icon="info" tint="neutral" title="Version" value={appVersion()} />
        </Group>

        <Group header="Danger zone">
          <ListRow
            icon="trash"
            title="Delete everything"
            subtitle="Erase every document from this phone"
            destructive
            onPress={openErase}
            disabled={blocked}
          />
        </Group>
      </ScrollView>

      <Sheet visible={erase !== null} onClose={() => setErase(null)}>
        <View style={styles.erase}>
          <View style={styles.eraseIcon}>
            <Icon name="trash" size={26} tone="danger" />
          </View>
          <Text variant="title2" accessibilityRole="header">
            Delete everything?
          </Text>
          <Text variant="callout" tone="secondary">
            {`${eraseSubject(erase?.count ?? null)} and the vault index are erased from this phone. This can’t be undone. Backups you saved elsewhere aren’t affected.`}
          </Text>
          <Button
            label="Delete everything"
            variant="destructive"
            // The native alert opens over the sheet; the sheet closes once confirmed.
            onPress={clearAll}
          />
          <Button label="Cancel" variant="plain" onPress={() => setErase(null)} />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs,
    gap: theme.spacing.lg,
  },
  title: {
    paddingHorizontal: theme.spacing.xxs,
  },
  erase: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md,
  },
  eraseIcon: {
    width: 52,
    height: 52,
    borderRadius: theme.radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.dangerMuted,
  },
  appearance: {
    padding: theme.spacing.md,
  },
}));
