import type * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/ui';
import { backupCopy as copy } from '@/features/backup/backupCopy';
import type { PickedBackup } from '@/features/backup/RestoreSheet';
import { useSessionActions } from '@/features/session/SessionProvider';
import { useMountedRef } from '@/hooks/useMountedRef';
import { backupService, describeBackupError } from '@/services/BackupService';
import { documentService } from '@/services/DocumentService';
import { errorCode } from '@/utils/errors';

import { SHEET_GONE_FALLBACK_MS } from '../constants';
import { openPicker } from '../picker';

export function useRestorePick() {
  const toast = useToast();
  const { withoutAutoLock, captureSession } = useSessionActions();
  const mounted = useMountedRef();
  const [restore, setRestore] = useState<PickedBackup | null>(null);
  // Keep the same sheet key on close so its modal fires onDismissed before "Choose another file" opens the picker.
  const [sheetKey, setSheetKey] = useState(0);
  const pickWhenGone = useRef(false);
  const goneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (goneTimer.current) clearTimeout(goneTimer.current);
    };
  }, []);

  const openRestore = useCallback((picked: PickedBackup) => {
    setSheetKey((key) => key + 1);
    setRestore(picked);
  }, []);

  const pickBackup = useCallback(async () => {
    const session = captureSession();
    let picked: string | null = null;
    let pickedName = '';
    let result: DocumentPicker.DocumentPickerResult;
    try {
      result = await withoutAutoLock(openPicker);
    } catch {
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
      // Move out of the OS purgeable cache before reading the header.
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
          message: code === 'BACKUP_INVALID' ? copy['picker.notBackup'] : describeBackupError(e),
          tone: 'danger',
        });
      }
    }
  }, [toast, withoutAutoLock, captureSession, openRestore, mounted]);

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
  }, [pickBackup, mounted]);

  const chooseAnother = useCallback(() => {
    if (pickWhenGone.current) return;
    pickWhenGone.current = true;
    closeRestore();
    goneTimer.current = setTimeout(sheetGone, SHEET_GONE_FALLBACK_MS);
  }, [closeRestore, sheetGone]);

  const restored = useCallback(() => {
    setRestore(null);
    router.navigate('/');
  }, []);

  return { restore, sheetKey, pickBackup, closeRestore, chooseAnother, sheetGone, restored };
}
