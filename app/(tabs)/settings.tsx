import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Alert, ScrollView, Share, Switch, TextInput, View } from 'react-native';
import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles';

import { Button, Card, Chip, Icon, ListRow, Screen, Sheet, Text, useToast } from '@/components/ui';
import { useSession } from '@/features/session/SessionProvider';
import { AUTO_LOCK_OPTIONS, autoLockDescription, autoLockLabel } from '@/features/session/settings';
import { selectIntelligence } from '@/features/intelligence';
import { useVault } from '@/hooks/useVault';
import { documentService } from '@/services/DocumentService';

type Appearance = 'system' | 'light' | 'dark';

const APP_VERSION = '2.0.0';

export default function SettingsScreen() {
  const vault = useVault();
  const toast = useToast();
  const { lock, settings, updateSettings, biometry } = useSession();
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

  const [exportSheet, setExportSheet] = useState<string | null>(null);
  const [importSheet, setImportSheet] = useState(false);
  const [importText, setImportText] = useState('');
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

  const exportVault = useCallback(async () => {
    setBusy('export');
    try {
      setExportSheet(await vault.exportEncrypted());
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : 'Could not export the vault.',
        tone: 'danger',
      });
    } finally {
      setBusy(null);
    }
  }, [vault, toast]);

  const copyExport = useCallback(async () => {
    if (!exportSheet) return;
    await Clipboard.setStringAsync(exportSheet);
    setExportSheet(null);
    toast.show({ message: 'Backup copied to the clipboard', tone: 'success' });
  }, [exportSheet, toast]);

  const shareExport = useCallback(async () => {
    if (!exportSheet) return;
    try {
      await Share.share({ title: 'SecureVault backup', message: exportSheet });
      setExportSheet(null);
    } catch {
      // Share sheet dismissed.
    }
  }, [exportSheet]);

  const importVault = useCallback(async () => {
    const text = importText.trim();
    if (!text) return;
    setBusy('import');
    try {
      await vault.importEncrypted(text);
      await documentService.reload();
      setImportSheet(false);
      setImportText('');
      toast.show({ message: 'Vault restored', tone: 'success' });
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : 'Could not restore the vault.',
        tone: 'danger',
      });
    } finally {
      setBusy(null);
    }
  }, [importText, vault, toast]);

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
              for (const key of await vault.getAllKeys()) {
                await vault.delete(key).catch(() => {});
              }
              await documentService.clearCache();
              toast.show({ message: 'Vault emptied' });
              lock();
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
  }, [vault, toast, lock]);

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
            onPress={exportVault}
            disabled={busy !== null}
          />
          <ListRow
            icon="restore"
            title="Restore from backup"
            subtitle="Replaces everything in this vault"
            onPress={() => setImportSheet(true)}
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
        visible={exportSheet !== null}
        onClose={() => setExportSheet(null)}
        title="Export vault"
      >
        <Text variant="subheadline" tone="secondary">
          The backup stays encrypted. Only this device&apos;s key can read it, until
          passphrase-protected backups arrive.
        </Text>
        <View style={styles.sheetActions}>
          <Button label="Copy to clipboard" onPress={copyExport} />
          <Button label="Share" variant="secondary" onPress={shareExport} />
        </View>
      </Sheet>

      <Sheet
        visible={importSheet}
        onClose={() => setImportSheet(false)}
        title="Restore from backup"
        dismissable={busy !== 'import'}
      >
        <Text variant="subheadline" tone="secondary">
          Paste a backup exported from this device. Everything currently in the vault is replaced.
        </Text>
        <TextInput
          style={styles.importInput}
          multiline
          value={importText}
          onChangeText={setImportText}
          placeholder="Paste backup data"
          accessibilityLabel="Backup data"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button
          label="Restore"
          onPress={importVault}
          loading={busy === 'import'}
          disabled={!importText.trim()}
        />
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
  importInput: {
    minHeight: 120,
    maxHeight: 200,
    padding: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    ...theme.typography.footnote,
    textAlignVertical: 'top',
  },
}));
