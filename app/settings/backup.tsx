import { useCallback, useEffect, useRef, useState } from 'react';
import { router, Stack } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { ScrollView, TextInput, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, Card, Group, Icon, ListRow, Screen, Sheet, Text, useToast } from '@/components/ui';
import { loadLastBackup, recordLastBackup } from '@/features/backup/lastBackup';
import { sharePause, useSession } from '@/features/session/SessionProvider';
import { useBackupActivity } from '@/hooks/useBackupActivity';
import { backupCopy as copy } from '@/features/backup/backupCopy';
import { type PickedBackup, RestoreSheet } from '@/features/backup/RestoreSheet';
import { backupService, describeBackupError, passphraseProblem } from '@/services/BackupService';
import { documentService } from '@/services/DocumentService';
import { formatDate, formatFileSize } from '@/utils/format';

// The vault locked while the share sheet was still open or never appeared.
const SHARE_INTERRUPTED =
  'SecureVault locked while you were sharing. The temporary copy was removed.';

// Shown once the vault is unlocked; it names nothing about the vault.
const EXPORT_STOPPED =
  'The backup was cancelled before it could be shared. Nothing left the vault.';

/**
 * Settings › Backup (handover §6 J6): create a backup, and the app's only
 * restore entry (G11). Nothing outside this screen starts a restore, and no
 * route, link or file type opens it with a file.
 */
export default function BackupScreen() {
  const toast = useToast();
  const { withoutAutoLock, captureSession, postNotice } = useSession();
  // The lock unmounts this screen while an export or restore may still be running.
  const mounted = useRef(true);
  const [lastBackup, setLastBackup] = useState<Date | null>(null);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    loadLastBackup().then((date) => {
      if (active) setLastBackup(date);
    });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, []);

  const [exportSheet, setExportSheet] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [restore, setRestore] = useState<PickedBackup | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  // Shown inside the open sheet; a toast would sit behind it.
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'export' | null>(null);
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
          const made = new Date();
          await recordLastBackup(made);
          if (mounted.current) setLastBackup(made);
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
      setRestore({
        uri: asset.uri,
        name: asset.name,
        entries: info.entries,
        created: info.created,
      });
    } catch (e) {
      if (picked) backupService.discardPickedFile(picked);
      if (mounted.current && session.current()) {
        const code = (e as { code?: unknown } | null)?.code;
        toast.show({
          // A file the picker returned that is not a backup at all: a toast, no sheet.
          message: code === 'BACKUP_INVALID' ? copy['picker.notBackup'] : describeBackupError(e),
          tone: 'danger',
        });
      }
    }
  }, [toast, withoutAutoLock, captureSession]);

  const closeRestore = useCallback(() => {
    if (restore) backupService.discardPickedFile(restore.uri);
    setRestore(null);
  }, [restore]);

  const chooseAnother = useCallback(() => {
    closeRestore();
    void pickBackup();
  }, [closeRestore, pickBackup]);

  const restored = useCallback(() => {
    setRestore(null);
    // The reloaded list is the outcome; the vault stays unlocked.
    router.navigate('/');
  }, []);

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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="largeTitle" accessibilityRole="header" style={styles.title}>
          Backup
        </Text>

        <Card padded style={styles.card}>
          <View style={styles.cardIcon}>
            <Icon name="archive" size={22} tone="accent" />
          </View>
          <Text variant="title3" accessibilityRole="header">
            One encrypted file, your passphrase
          </Text>
          <Text variant="subheadline" tone="secondary">
            A backup holds every document and the index, encrypted with a passphrase you choose.
            SecureVault never stores that passphrase, so nobody can open the backup without it,
            including you.
          </Text>
          <Button
            label="Create a backup"
            icon="export"
            onPress={openExport}
            disabled={blocked}
            accessibilityHint={
              earlier === 'export' ? 'An export started earlier is still finishing' : undefined
            }
          />
          {earlier === 'export' ? (
            <Text variant="footnote" tone="secondary" style={styles.centred}>
              An export started earlier is still finishing
            </Text>
          ) : lastBackup ? (
            <Text variant="footnote" tone="tertiary" style={styles.centred}>
              {`Last created on this phone: ${formatDate(lastBackup.toISOString())}`}
            </Text>
          ) : null}
        </Card>

        <Group
          header="Restore"
          footer="You decide where the file goes: Files, a computer or a drive. A backup made on iPhone restores on Android, and the other way round."
        >
          <ListRow
            icon="restore"
            tint="danger"
            title="Restore from a backup…"
            subtitle={
              earlier === 'restore'
                ? 'A restore started earlier is still running'
                : 'Replaces everything in this vault'
            }
            onPress={pickBackup}
            disabled={blocked}
          />
        </Group>
      </ScrollView>

      <Sheet
        visible={exportSheet}
        onClose={() => setExportSheet(false)}
        title="Encrypted backup"
        dismissable={busy !== 'export'}
      >
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

      <RestoreSheet
        key={restore?.uri ?? 'none'}
        backup={restore}
        onClose={closeRestore}
        onChooseAnother={chooseAnother}
        onRestored={restored}
      />
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
  card: {
    gap: theme.spacing.sm,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryMuted,
  },
  centred: {
    textAlign: 'center',
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
