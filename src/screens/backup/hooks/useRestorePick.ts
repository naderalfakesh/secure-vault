import type * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/ui';
import { backupCopy as copy } from '@/features/backup/backupCopy';
import type { PickedBackup } from '@/features/backup/RestoreSheet';
import { useSession } from '@/features/session/SessionProvider';
import { backupService, describeBackupError } from '@/services/BackupService';
import { documentService } from '@/services/DocumentService';

import { SHEET_GONE_FALLBACK_MS } from '../constants';
import { errorCode } from '../helpers';
import { openPicker } from '../picker';

/** Picking a backup file, the restore sheet it opens, and "Choose another file". */
export function useRestorePick() {
  const toast = useToast();
  const { withoutAutoLock, captureSession } = useSession();
  // The lock unmounts this screen while a restore may still be running.
  const mounted = useRef(true);
  const [restore, setRestore] = useState<PickedBackup | null>(null);
  // Each pick starts a fresh sheet; closing keeps the same one so its modal
  // can report that it has gone (the pick after "Choose another file" waits).
  const [sheetKey, setSheetKey] = useState(0);
  const pickWhenGone = useRef(false);
  const goneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
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
        const code = errorCode(e);
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

  return { restore, sheetKey, pickBackup, closeRestore, chooseAnother, sheetGone, restored };
}
