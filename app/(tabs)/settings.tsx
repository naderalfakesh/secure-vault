import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Alert, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
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
import { t } from '@/i18n';
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
  if (count === null || count === 0) return t('settings.erase.subjectAll');
  if (count === 1) return t('settings.erase.subjectOne');
  return t('settings.erase.subjectMany', { count });
}

const APPEARANCE_CHOICES: { value: AppearancePreference; label: string }[] = [
  { value: 'system', label: t('settings.appearance.system') },
  { value: 'light', label: t('settings.appearance.light') },
  { value: 'dark', label: t('settings.appearance.dark') },
];

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
    Alert.alert(t('settings.erase.title'), t('settings.erase.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.erase'),
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
                ? { message: t('settings.erase.done') }
                : // The erase finished, but the old PIN record survived both delete attempts.
                  { message: t('settings.erase.pinNotCleared'), tone: 'danger' },
            );
          } catch (e) {
            toast.show({
              message: describeBackupError(e, t('settings.erase.failed')),
              tone: 'danger',
            });
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }, [toast, eraseVault]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomSpace }]}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="largeTitle" accessibilityRole="header" style={styles.title}>
          {t('settings.title')}
        </Text>

        <Group header={t('settings.group.security')} separatorInset="content">
          {biometrics && biometrics.state !== 'unavailable' ? (
            <ListRow
              icon={biometryIcon(biometrics.kind)}
              title={
                Platform.OS === 'ios'
                  ? biometryName(biometrics.kind)
                  : t('settings.biometricUnlock')
              }
              subtitle={biometricReason ?? t('settings.biometricUnlock.subtitle')}
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
              title={t('settings.openSettings')}
              onPress={() => void Linking.openSettings().catch(() => {})}
              trailing={null}
            />
          ) : null}
          <ListRow
            icon="clock"
            title={t('settings.autoLock')}
            value={autoLockLabel(settings.autoLockSeconds)}
            onPress={() => router.push('/settings/auto-lock')}
          />
          <ListRow
            icon="eyeOff"
            title={t('settings.privacyCover')}
            subtitle={t('settings.privacyCover.subtitle')}
            toggle={{
              value: settings.privacyScreen,
              onValueChange: (value) => void updateSettings({ privacyScreen: value }),
            }}
          />
          {biometry !== 'none' ? (
            <ListRow
              icon="share"
              title={t('settings.confirmShare')}
              subtitle={t('settings.confirmShare.subtitle', { biometry: biometryName(biometry) })}
              toggle={{
                value: settings.biometricsForShare,
                onValueChange: (value) => void updateSettings({ biometricsForShare: value }),
              }}
            />
          ) : null}
          <ListRow
            icon="key"
            title={t('settings.changePin')}
            onPress={() => router.push('/settings/change-pin')}
          />
          <ListRow icon="lock" title={t('settings.lockNow')} onPress={lock} trailing={null} />
        </Group>

        <Group header={t('settings.group.data')}>
          <ListRow
            icon="backup"
            title={t('settings.backup')}
            subtitle={t('settings.backup.subtitle')}
            onPress={() => router.push('/settings/backup')}
          />
        </Group>

        <Group header={t('settings.group.appearance')}>
          <View style={styles.appearance}>
            <SegmentedControl
              accessibilityLabel={t('settings.appearance')}
              options={APPEARANCE_CHOICES}
              value={appearance}
              onChange={(option) => void setAppearance(option)}
            />
          </View>
        </Group>

        <Group header={t('settings.group.suggestions')}>
          <ListRow
            icon="sparkles"
            tint="neutral"
            title={t('settings.suggestions')}
            subtitle={
              engine === 'heuristic'
                ? t('settings.suggestions.heuristic')
                : engine
                  ? t('settings.suggestions.model', { engine })
                  : t('settings.suggestions.checking')
            }
          />
        </Group>

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

        <Group header={t('settings.group.danger')}>
          <ListRow
            icon="trash"
            title={t('settings.erase')}
            // A disabled row says why (ListRow): the erase waits for the
            // backup work holding the slot, or is itself running.
            subtitle={t(
              busy === 'clear' || running === 'erase'
                ? 'settings.erase.erasing'
                : running === 'export'
                  ? 'settings.erase.waitExport'
                  : running === 'restore'
                    ? 'settings.erase.waitRestore'
                    : 'settings.erase.subtitle',
            )}
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
            {t('settings.erase.title')}
          </Text>
          <Text variant="callout" tone="secondary">
            {t('settings.erase.body', { subject: eraseSubject(erase?.count ?? null) })}
          </Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t('settings.erase.backupFirst')}
            onPress={() => {
              setErase(null);
              router.push('/settings/backup');
            }}
            style={styles.link}
          >
            <Text variant="callout" tone="accent" style={styles.linkText}>
              {t('settings.erase.backupFirst')}
            </Text>
          </Pressable>
          <Button
            label={t('settings.erase')}
            variant="destructive"
            // The native alert opens over the sheet; the sheet closes once confirmed.
            onPress={clearAll}
          />
          <Button label={t('common.cancel')} variant="plain" onPress={() => setErase(null)} />
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
  link: {
    minHeight: theme.touchTarget,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  linkText: {
    fontWeight: '600',
  },
  appearance: {
    padding: theme.spacing.md,
  },
}));
