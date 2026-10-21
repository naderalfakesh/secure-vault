import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';
import { Alert, Linking, Platform, ScrollView, TextInput, View } from 'react-native';
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
import { sharePause, useSession } from '@/features/session/SessionProvider';
import { autoLockLabel } from '@/features/session/settings';
import { biometryName } from '@/features/auth/lockCopy';
import { selectIntelligence } from '@/features/intelligence';
import { useBackupActivity } from '@/hooks/useBackupActivity';
import {
  backupService,
  describeBackupError,
  describeBackupErrorPlainly,
  passphraseProblem,
} from '@/services/BackupService';
import type { BackupProgress } from '../../modules/expo-vault';
import { documentService } from '@/services/DocumentService';
import { type AppearancePreference, setAppearance, useAppearance } from '@/theme/appearance';
import { formatFileSize } from '@/utils/format';

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

// The vault locked while the share sheet was still open or never appeared.
const SHARE_INTERRUPTED =
  'SecureVault locked while you were sharing. The temporary copy was removed.';

// Shown once the vault is unlocked; it names nothing about the vault.
const EXPORT_STOPPED =
  'The backup was cancelled before it could be shared. Nothing left the vault.';

export default function SettingsScreen() {
  const toast = useToast();
  const {
    lock,
    settings,
    updateSettings,
    biometry,
    eraseVault,
    withoutAutoLock,
    captureSession,
    postNotice,
  } = useSession();
  // The Delete everything sheet, with the number of documents it erases.
  const [erase, setErase] = useState<{ count: number | null } | null>(null);
  const insets = useSafeAreaInsets();
  const bottomSpace = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + insets.bottom + 24;
  const [engine, setEngine] = useState<string>('');
  // The lock unmounts this screen while an export or restore may still be running.
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

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
  const [progress, setProgress] = useState<{
    phase?: BackupProgress['phase'];
    done: number;
    total: number;
  } | null>(null);
  // Shown inside the open sheet; a toast would sit behind it.
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'export' | 'import' | 'clear' | null>(null);
  // An export or restore started before the last lock may still be running
  // after this screen mounts again; nothing else may start until it ends.
  const running = useBackupActivity();
  const blocked = busy !== null || running !== null;
  const earlier = busy === null ? running : null;

  const openExport = useCallback(() => {
    setPassphrase('');
    setConfirmation('');
    setSheetError(null);
    setExportSheet(true);
  }, []);

  // Writes the container, hands it to the share sheet, and removes the copy
  // once the sheet closes. The passphrase never leaves this screen. A backup
  // finished after the vault locked, or after this screen went away, is
  // deleted unshared: the share sheet is system UI and would open over the
  // lock screen.
  const exportVault = useCallback(async () => {
    const problem = passphraseProblem(passphrase, confirmation);
    if (problem) {
      setSheetError(problem);
      return;
    }
    const session = captureSession();
    const stillHere = () => mounted.current && session.current();
    setSheetError(null);
    setBusy('export');
    setProgress({ done: 0, total: 1 });
    let cancelled = false;
    try {
      // The service removes the container once this returns or throws.
      await backupService.exportBackup(
        passphrase,
        async (backup) => {
          if (!stillHere()) {
            cancelled = true;
            return;
          }
          setExportSheet(false);
          setPassphrase('');
          setConfirmation('');
          // Let the sheet's modal finish dismissing; presenting the share sheet
          // over a dismissing modal leaves iOS with neither on screen.
          await new Promise((resolve) => setTimeout(resolve, 450));
          if (!mounted.current || !(await session.confirm()) || !mounted.current) {
            cancelled = true;
            return;
          }
          // A share that never settles must not keep the export, and its slot, open.
          await Promise.race([
            withoutAutoLock(
              () =>
                Sharing.shareAsync(backup.uri, {
                  dialogTitle: backup.name,
                  mimeType: 'application/octet-stream',
                  UTI: 'public.data',
                }),
              sharePause(),
            ),
            session.ended(),
          ]);
          if (!session.current()) {
            // It may have been shared already, so this says less than EXPORT_STOPPED.
            postNotice({ message: SHARE_INTERRUPTED });
            return;
          }
          toast.show({
            message: `Backup of ${backup.entries} entries (${formatFileSize(backup.bytes)}) shared`,
            tone: 'success',
          });
        },
        (event) => {
          if (mounted.current) setProgress(event);
        },
      );
    } catch (e) {
      if (stillHere()) setSheetError(describeBackupError(e, 'Could not create the backup.'));
      else cancelled = true;
    } finally {
      if (cancelled) postNotice({ message: EXPORT_STOPPED });
      if (mounted.current) {
        setProgress(null);
        setBusy(null);
      }
    }
  }, [passphrase, confirmation, toast, withoutAutoLock, captureSession, postNotice]);

  // Picks a file, reads its header, and only then asks for the passphrase.
  // The picker's copy is removed once the restore is done or the sheet closes,
  // and by the lock sweep otherwise.
  const pickBackup = useCallback(async () => {
    const session = captureSession();
    let picked: string | null = null;
    try {
      const result = await withoutAutoLock(() =>
        DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true }),
      );
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      documentService.discardSystemImportCopy(asset.name);
      picked = asset.uri;
      const info = await backupService.inspectBackup(asset.uri);
      if (!mounted.current || !session.current()) {
        backupService.discardPickedFile(asset.uri);
        return;
      }
      setRestorePassphrase('');
      setSheetError(null);
      setRestore({
        uri: asset.uri,
        name: asset.name,
        entries: info.entries,
        created: info.created,
      });
    } catch (e) {
      if (picked) backupService.discardPickedFile(picked);
      if (mounted.current && session.current()) {
        toast.show({ message: describeBackupError(e), tone: 'danger' });
      }
    }
  }, [toast, withoutAutoLock, captureSession]);

  const closeRestore = useCallback(() => {
    if (restore) backupService.discardPickedFile(restore.uri);
    setRestore(null);
  }, [restore]);

  // A restore is never cancelled by the lock: it keeps running so the vault is
  // never left half replaced, and reports its outcome after the next unlock.
  // The service refuses any other backup work until it ends.
  const importVault = useCallback(async () => {
    if (!restore || !restorePassphrase) return;
    const session = captureSession();
    const stillHere = () => mounted.current && session.current();
    setSheetError(null);
    setBusy('import');
    setProgress({ phase: 'verify', done: 0, total: 1 });
    try {
      const entries = await backupService.restoreBackup(restore.uri, restorePassphrase, (event) => {
        if (mounted.current) setProgress(event);
      });
      backupService.discardPickedFile(restore.uri);
      const message = `Vault restored: ${entries} entries`;
      if (stillHere()) {
        setRestore(null);
        setRestorePassphrase('');
        toast.show({ message, tone: 'success' });
      } else {
        postNotice({ message, tone: 'success' });
      }
    } catch (e) {
      if (stillHere()) {
        setSheetError(describeBackupError(e));
      } else {
        backupService.discardPickedFile(restore.uri);
        postNotice({
          message: describeBackupErrorPlainly(e, 'The restore did not finish. Try it again.'),
          tone: 'danger',
        });
      }
    } finally {
      if (mounted.current) {
        setProgress(null);
        setBusy(null);
      }
    }
  }, [restore, restorePassphrase, toast, captureSession, postNotice]);

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

        <Group header="Backup" separatorInset="content">
          <ListRow
            icon="backup"
            title="Export vault"
            subtitle={
              earlier === 'export'
                ? 'An export started earlier is still finishing'
                : 'Encrypted copy of every document and the index'
            }
            onPress={openExport}
            disabled={blocked}
          />
          <ListRow
            icon="restore"
            title="Restore from backup"
            subtitle={
              earlier === 'restore'
                ? 'A restore started earlier is still running'
                : 'Replaces everything in this vault'
            }
            onPress={pickBackup}
            disabled={blocked}
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
            subtitle={Platform.select({
              ios: 'Encrypted on this phone with AES-256-GCM. The key is kept by the iOS Keychain.',
              default:
                'Encrypted on this phone with AES-256-GCM. The key is kept by the Android Keystore.',
            })}
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
          returnKeyType="go"
          onSubmitEditing={exportVault}
        />
        {sheetError ? (
          <Text variant="footnote" tone="danger" accessibilityRole="alert">
            {sheetError}
          </Text>
        ) : null}
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
        onClose={closeRestore}
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
              returnKeyType="go"
              onSubmitEditing={importVault}
            />
            {sheetError ? (
              <Text variant="footnote" tone="danger" accessibilityRole="alert">
                {sheetError}
              </Text>
            ) : null}
            {progress && busy === 'import' ? (
              <Text variant="footnote" tone="secondary" accessibilityLiveRegion="polite">
                {progress.phase === 'verify' ? 'Checking' : 'Restoring'} {progress.done} of{' '}
                {progress.total}
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
