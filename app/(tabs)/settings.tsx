import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Alert, ScrollView, Switch, TextInput, View } from 'react-native';
import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles';

import { Button, Card, Chip, Icon, ListRow, Screen, Sheet, Text, useToast } from '@/components/ui';
import { useSession } from '@/features/session/SessionProvider';
import { AUTO_LOCK_OPTIONS, autoLockDescription, autoLockLabel } from '@/features/session/settings';
import { selectIntelligence } from '@/features/intelligence';
import { backupService, describeBackupError, passphraseProblem } from '@/services/BackupService';
import { documentService } from '@/services/DocumentService';
import { formatFileSize } from '@/utils/format';

type Appearance = 'system' | 'light' | 'dark';

const APP_VERSION = '2.0.0';

export default function SettingsScreen() {
  const toast = useToast();
  const { lock, settings, updateSettings, biometry, eraseVault, withoutAutoLock } = useSession();
  const [autoLockSheet, setAutoLockSheet] = useState(false);
  const [engine, setEngine] = useState<string>('');

  useEffect(() => {
    let active = true;
    selectIntelligence().then((selected) => {
      if (active) setEngine(selected.engine);
    });
    return () => {
      active = false;
    };
  }, []);
  const [appearance, setAppearanceState] = useState<Appearance>(() =>
    UnistylesRuntime.hasAdaptiveThemes
      ? 'system'
      : UnistylesRuntime.themeName === 'dark'
        ? 'dark'
        : 'light',
  );

  const [exportSheet, setExportSheet] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [restore, setRestore] = useState<{
    uri: string;
    name: string;
    entries: number;
    created: string;
  } | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [busy, setBusy] = useState<'export' | 'import' | 'clear' | null>(null);

  const setAppearance = useCallback((next: Appearance) => {
    setAppearanceState(next);
    if (next === 'system') {
      UnistylesRuntime.setAdaptiveThemes(true);
      return;
    }
    UnistylesRuntime.setAdaptiveThemes(false);
    UnistylesRuntime.setTheme(next);
  }, []);

  const openExport = useCallback(() => {
    setPassphrase('');
    setConfirmation('');
    setExportSheet(true);
  }, []);

  // Writes the container, hands it to the share sheet, and removes the copy
  // once the sheet closes. The passphrase never leaves this screen.
  const exportVault = useCallback(async () => {
    const problem = passphraseProblem(passphrase, confirmation);
    if (problem) {
      toast.show({ message: problem });
      return;
    }
    setBusy('export');
    setProgress({ done: 0, total: 1 });
    let uri: string | null = null;
    try {
      const backup = await backupService.createBackup(passphrase, setProgress);
      uri = backup.uri;
      setExportSheet(false);
      setPassphrase('');
      setConfirmation('');
      await withoutAutoLock(() =>
        Sharing.shareAsync(backup.uri, {
          dialogTitle: backup.name,
          mimeType: 'application/octet-stream',
          UTI: 'public.data',
        }),
      );
      toast.show({
        message: `Backup of ${backup.entries} entries (${formatFileSize(backup.bytes)}) shared`,
        tone: 'success',
      });
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : 'Could not create the backup.',
        tone: 'danger',
      });
    } finally {
      if (uri) backupService.discardBackup(uri);
      setProgress(null);
      setBusy(null);
    }
  }, [passphrase, confirmation, toast, withoutAutoLock]);

  // Picks a file, reads its header, and only then asks for the passphrase.
  const pickBackup = useCallback(async () => {
    try {
      const result = await withoutAutoLock(() =>
        DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true }),
      );
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      const info = await backupService.inspectBackup(asset.uri);
      setRestorePassphrase('');
      setRestore({
        uri: asset.uri,
        name: asset.name,
        entries: info.entries,
        created: info.created,
      });
    } catch (e) {
      toast.show({ message: describeBackupError(e), tone: 'danger' });
    }
  }, [toast, withoutAutoLock]);

  const importVault = useCallback(async () => {
    if (!restore || !restorePassphrase) return;
    setBusy('import');
    setProgress({ done: 0, total: 1 });
    try {
      const entries = await backupService.restoreBackup(
        restore.uri,
        restorePassphrase,
        setProgress,
      );
      setRestore(null);
      setRestorePassphrase('');
      toast.show({ message: `Vault restored: ${entries} entries`, tone: 'success' });
    } catch (e) {
      toast.show({ message: describeBackupError(e), tone: 'danger' });
    } finally {
      setProgress(null);
      setBusy(null);
    }
  }, [restore, restorePassphrase, toast]);

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
            setBusy('clear');
            try {
              await documentService.eraseEverything();
              await eraseVault();
              toast.show({ message: 'Vault emptied' });
            } catch (e) {
              toast.show({
                message: e instanceof Error ? e.message : 'Could not clear the vault.',
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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="title1" accessibilityRole="header">
          Settings
        </Text>

        <Section title="Security">
          <ListRow
            icon="lock"
            title="Lock now"
            subtitle="Requires biometrics or your PIN to reopen"
            onPress={lock}
          />
          <ListRow
            icon="clock"
            title="Auto-lock"
            subtitle={autoLockDescription(settings.autoLockSeconds)}
            onPress={() => setAutoLockSheet(true)}
          />
          <ListRow
            icon="eyeOff"
            title="Privacy screen"
            subtitle="Blur in the app switcher and block screenshots"
            trailing={
              <Switch
                value={settings.privacyScreen}
                onValueChange={(value) => updateSettings({ privacyScreen: value })}
                accessibilityLabel="Privacy screen"
              />
            }
          />
          {biometry !== 'none' ? (
            <ListRow
              icon="shield"
              title="Confirm before sharing"
              subtitle="Ask for biometrics again before a file leaves the vault"
              trailing={
                <Switch
                  value={settings.biometricsForShare}
                  onValueChange={(value) => updateSettings({ biometricsForShare: value })}
                  accessibilityLabel="Confirm before sharing"
                />
              }
            />
          ) : null}
          <ListRow
            icon="edit"
            title="Change PIN"
            onPress={() => router.push('/settings/change-pin')}
            divider={false}
          />
        </Section>

        <Section title="Appearance">
          <View style={styles.chips}>
            {(['system', 'light', 'dark'] as const).map((option) => (
              <Chip
                key={option}
                label={option === 'system' ? 'System' : option === 'light' ? 'Light' : 'Dark'}
                icon={option === 'dark' ? 'moon' : option === 'light' ? 'eye' : 'settings'}
                selected={appearance === option}
                onPress={() => setAppearance(option)}
              />
            ))}
          </View>
        </Section>

        <Section title="Backup">
          <ListRow
            icon="backup"
            title="Export vault"
            subtitle="Encrypted copy of every document and the index"
            onPress={openExport}
            disabled={busy !== null}
          />
          <ListRow
            icon="restore"
            title="Restore from backup"
            subtitle="Replaces everything in this vault"
            onPress={pickBackup}
            disabled={busy !== null}
            divider={false}
          />
        </Section>

        <Section title="About">
          <ListRow
            icon="shield"
            title="How your data is protected"
            subtitle="AES-256-GCM with a key in the Secure Enclave or Android Keystore"
          />
          <ListRow
            icon="sparkles"
            title="Suggestions"
            subtitle={
              engine === 'heuristic'
                ? 'On-device rules read dates, numbers, and keywords. No model, nothing uploaded.'
                : engine
                  ? `On-device model: ${engine}`
                  : 'Checking'
            }
          />
          <ListRow icon="info" title="Version" subtitle={APP_VERSION} divider={false} />
        </Section>

        <Section title="Danger zone">
          <ListRow
            icon="trash"
            title="Delete everything"
            subtitle="Erases all documents from this device"
            tone="danger"
            onPress={clearAll}
            disabled={busy !== null}
            divider={false}
          />
        </Section>
      </ScrollView>

      <Sheet visible={autoLockSheet} onClose={() => setAutoLockSheet(false)} title="Auto-lock">
        <Text variant="subheadline" tone="secondary">
          How long the vault stays open after you leave the app.
        </Text>
        <Card>
          {AUTO_LOCK_OPTIONS.map((option, index) => (
            <ListRow
              key={option}
              title={autoLockLabel(option)}
              onPress={() => {
                void updateSettings({ autoLockSeconds: option });
                setAutoLockSheet(false);
              }}
              trailing={
                settings.autoLockSeconds === option ? (
                  <Icon name="check" size={18} tone="accent" />
                ) : (
                  <View />
                )
              }
              divider={index < AUTO_LOCK_OPTIONS.length - 1}
            />
          ))}
        </Card>
      </Sheet>

      <Sheet
        visible={exportSheet}
        onClose={() => setExportSheet(false)}
        title="Export vault"
        dismissable={busy !== 'export'}
      >
        <Text variant="subheadline" tone="secondary">
          Every document and the index go into one file, protected by a passphrase that is never
          stored. Without it the backup cannot be opened, not even by this app.
        </Text>
        <TextInput
          style={styles.passphraseInput}
          value={passphrase}
          onChangeText={setPassphrase}
          placeholder="Passphrase (at least 8 characters)"
          accessibilityLabel="Backup passphrase"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={busy !== 'export'}
        />
        <TextInput
          style={styles.passphraseInput}
          value={confirmation}
          onChangeText={setConfirmation}
          placeholder="Repeat the passphrase"
          accessibilityLabel="Repeat the backup passphrase"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={busy !== 'export'}
        />
        {progress && busy === 'export' ? (
          <Text variant="footnote" tone="secondary" accessibilityLiveRegion="polite">
            Encrypting {progress.done} of {progress.total}
          </Text>
        ) : null}
        <Button
          label="Create backup"
          onPress={exportVault}
          loading={busy === 'export'}
          disabled={!passphrase || !confirmation}
        />
      </Sheet>

      <Sheet
        visible={restore !== null}
        onClose={() => setRestore(null)}
        title="Restore from backup"
        dismissable={busy !== 'import'}
      >
        {restore ? (
          <>
            <Text variant="subheadline" tone="secondary">
              {restore.name}: {restore.entries} entries
              {restore.created ? `, made ${restore.created.slice(0, 10)}` : ''}. Everything
              currently in the vault is replaced.
            </Text>
            <TextInput
              style={styles.passphraseInput}
              value={restorePassphrase}
              onChangeText={setRestorePassphrase}
              placeholder="Backup passphrase"
              accessibilityLabel="Backup passphrase"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={busy !== 'import'}
            />
            {progress && busy === 'import' ? (
              <Text variant="footnote" tone="secondary" accessibilityLiveRegion="polite">
                Restoring {progress.done} of {progress.total}
              </Text>
            ) : null}
            <Button
              label="Restore"
              onPress={importVault}
              loading={busy === 'import'}
              disabled={!restorePassphrase}
            />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="label" tone="tertiary" style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      <Card>{children}</Card>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  section: {
    gap: theme.spacing.xs,
  },
  sectionTitle: {
    paddingHorizontal: theme.spacing.xxs,
  },
  chips: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
  sheetActions: {
    gap: theme.spacing.xs,
  },
  passphraseInput: {
    minHeight: theme.touchTarget,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    fontSize: 17,
  },
}));
