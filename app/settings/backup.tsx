import { useCallback, useEffect, useRef, useState } from 'react';
import { router, Stack } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Platform, ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, Card, Group, Icon, ListRow, Screen, Text, useToast } from '@/components/ui';
import { backupCopy as copy, lastCreatedLine } from '@/features/backup/backupCopy';
import { CreateBackupSheet } from '@/features/backup/CreateBackupSheet';
import { loadLastBackup } from '@/features/backup/lastBackup';
import { type PickedBackup, RestoreSheet } from '@/features/backup/RestoreSheet';
import { useSession } from '@/features/session/SessionProvider';
import { useBackupActivity } from '@/hooks/useBackupActivity';
import { backupService, describeBackupError } from '@/services/BackupService';
import { documentService } from '@/services/DocumentService';

/**
 * "Choose another file" opens the picker only once the restore sheet's modal
 * is gone: iOS presents the picker on the top view controller, and one being
 * dismissed takes the picker down with it without telling expo-document-picker,
 * whose in-progress flag then refuses every later pick until a relaunch. iOS
 * reports the dismissal; this is the fallback if it never comes, and the
 * delay on Android, where the picker is its own activity.
 */
const SHEET_GONE_FALLBACK_MS = Platform.OS === 'ios' ? 1000 : 250;
/** The one retry after the picker said another pick was still in progress. */
const PICKER_RETRY_MS = 600;

const PICKER_OPTIONS = { type: '*/*', copyToCacheDirectory: true } as const;

function pickerBusy(error: unknown): boolean {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  return (
    code === 'ERR_PICKING_IN_PROGRESS' ||
    (typeof message === 'string' && /picking in progress/i.test(message))
  );
}

/** Opens the system picker, once more after a short wait if a pick is still closing. */
async function openPicker(): Promise<DocumentPicker.DocumentPickerResult> {
  try {
    return await DocumentPicker.getDocumentAsync(PICKER_OPTIONS);
  } catch (error) {
    if (!pickerBusy(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, PICKER_RETRY_MS));
    return DocumentPicker.getDocumentAsync(PICKER_OPTIONS);
  }
}

/**
 * Settings › Backup (handover §6 J6): create a backup, and the app's only
 * restore entry (G11). Nothing outside this screen starts a restore, and no
 * route, link or file type opens it with a file; it reads no parameters.
 */
export default function BackupScreen() {
  const toast = useToast();
  const { withoutAutoLock, captureSession } = useSession();
  // The lock unmounts this screen while an export or restore may still be running.
  const mounted = useRef(true);
  const [lastBackup, setLastBackup] = useState<Date | null>(null);
  const [creating, setCreating] = useState(false);
  const [restore, setRestore] = useState<PickedBackup | null>(null);
  // Each pick starts a fresh sheet; closing keeps the same one so its modal
  // can report that it has gone (the pick after "Choose another file" waits).
  const [sheetKey, setSheetKey] = useState(0);
  const pickWhenGone = useRef(false);
  const goneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // An export or restore, this screen's or one started before the last lock,
  // holds the service's one slot; nothing else may start until it ends.
  const running = useBackupActivity();
  const blocked = running !== null;
  const earlier = !creating && restore === null ? running : null;

  useEffect(() => {
    mounted.current = true;
    let active = true;
    loadLastBackup().then((date) => {
      if (active) setLastBackup(date);
    });
    return () => {
      active = false;
      mounted.current = false;
      if (goneTimer.current) clearTimeout(goneTimer.current);
    };
  }, []);

  const openRestore = useCallback((picked: PickedBackup) => {
    setSheetKey((key) => key + 1);
    setRestore(picked);
  }, []);

  // Picks a file, moves the picker's copy out of the purgeable cache, reads
  // its header, and only then asks for the passphrase. The kept copy is
  // removed once the restore is done or the sheet closes, and by the lock
  // sweep otherwise. A cancelled picker says nothing.
  const pickBackup = useCallback(async () => {
    const session = captureSession();
    let picked: string | null = null;
    let pickedName = '';
    let result: DocumentPicker.DocumentPickerResult;
    try {
      result = await withoutAutoLock(openPicker);
    } catch {
      // Never the module's text: a plain sentence, and the next tap tries again.
      if (mounted.current && session.current()) {
        toast.show({ message: copy['picker.failed'], tone: 'danger' });
      }
      return;
    }
    try {
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      documentService.discardSystemImportCopy(asset.name);
      picked = asset.uri;
      pickedName = asset.name;
      // Out of the purgeable cache before anything reads it; the cache copy goes.
      const uri = await backupService.keepPickedFile(asset.uri);
      picked = uri;
      const info = await backupService.inspectBackup(uri);
      if (!mounted.current || !session.current()) {
        backupService.discardPickedFile(uri);
        return;
      }
      openRestore({
        uri,
        name: asset.name,
        entries: info.entries,
        created: info.created,
      });
    } catch (e) {
      if (picked) backupService.discardPickedFile(picked);
      if (mounted.current && session.current()) {
        const code = (e as { code?: unknown } | null)?.code;
        if (code === 'BACKUP_UNSUPPORTED' && picked) {
          // A backup from a newer version: said in the restore sheet, like
          // every other restore outcome. The picker's copy is already gone.
          openRestore({
            uri: picked,
            name: pickedName,
            entries: 0,
            created: '',
            problem: describeBackupError(e),
          });
          return;
        }
        toast.show({
          // A file that is not a backup at all: a toast, no sheet.
          message: code === 'BACKUP_INVALID' ? copy['picker.notBackup'] : describeBackupError(e),
          tone: 'danger',
        });
      }
    }
  }, [toast, withoutAutoLock, captureSession, openRestore]);

  const closeRestore = useCallback(() => {
    if (restore) backupService.discardPickedFile(restore.uri);
    setRestore(null);
  }, [restore]);

  const sheetGone = useCallback(() => {
    if (goneTimer.current) clearTimeout(goneTimer.current);
    goneTimer.current = null;
    if (!pickWhenGone.current) return;
    pickWhenGone.current = false;
    if (mounted.current) void pickBackup();
  }, [pickBackup]);

  const chooseAnother = useCallback(() => {
    if (pickWhenGone.current) return;
    pickWhenGone.current = true;
    closeRestore();
    goneTimer.current = setTimeout(sheetGone, SHEET_GONE_FALLBACK_MS);
  }, [closeRestore, sheetGone]);

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
          label={copy['hub.back']}
          variant="plain"
          size="md"
          icon="back"
          onPress={() => router.back()}
        />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="largeTitle" accessibilityRole="header" style={styles.title}>
          {copy['hub.title']}
        </Text>

        <Card padded style={styles.card}>
          <View style={styles.cardIcon}>
            <Icon name="archive" size={22} tone="accent" />
          </View>
          <Text variant="title3" accessibilityRole="header">
            {copy['hub.card.title']}
          </Text>
          <Text variant="subheadline" tone="secondary">
            {copy['hub.card.body']}
          </Text>
          <Button
            label={copy['hub.create']}
            icon="export"
            onPress={() => setCreating(true)}
            disabled={blocked}
          />
          {earlier === 'export' ? (
            <Text variant="footnote" tone="secondary" style={styles.centred}>
              {copy['hub.exportRunning']}
            </Text>
          ) : lastBackup ? (
            <Text variant="footnote" tone="tertiary" style={styles.centred}>
              {lastCreatedLine(lastBackup)}
            </Text>
          ) : null}
        </Card>

        <Group header={copy['hub.restore.header']} footer={copy['hub.footnote']}>
          <ListRow
            icon="restore"
            tint="danger"
            title={copy['hub.restore.title']}
            subtitle={
              earlier === 'restore' ? copy['hub.restoreRunning'] : copy['hub.restore.subtitle']
            }
            onPress={pickBackup}
            disabled={blocked}
          />
        </Group>
      </ScrollView>

      <CreateBackupSheet
        visible={creating}
        onClose={() => setCreating(false)}
        onShared={setLastBackup}
      />
      <RestoreSheet
        key={sheetKey}
        backup={restore}
        onClose={closeRestore}
        onChooseAnother={chooseAnother}
        onRestored={restored}
        onDismissed={sheetGone}
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
}));
