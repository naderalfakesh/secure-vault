import { useCallback, useEffect, useRef, useState } from 'react';
import { router, Stack } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { ScrollView, View } from 'react-native';
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
    };
  }, []);

  // Picks a file, reads its header, and only then asks for the passphrase.
  // The picker's copy is removed once the restore is done or the sheet closes,
  // and by the lock sweep otherwise. A cancelled picker says nothing.
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
          // A file that is not a backup at all: a toast, no sheet.
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
}));
