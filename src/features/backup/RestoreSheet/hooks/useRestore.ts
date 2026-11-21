import { useCallback, useRef, useState } from 'react';

import { useToast } from '@/components/ui';
import { useSessionActions } from '@/features/session/SessionProvider';
import { useMountedRef } from '@/hooks/useMountedRef';
import { t } from '@/i18n';
import { backupService, describeBackupErrorPlainly } from '@/services/BackupService';

import { backupCopy as copy, restoreOutcome } from '../../backupCopy';
import {
  cancelledError,
  initialStage,
  nextFrame,
  stageForOutcome,
  startingProgress,
} from '../helpers';
import type { RestoreSheetProps, Stage } from '../types';

type UseRestoreOptions = Pick<RestoreSheetProps, 'backup' | 'onRestored'>;

/** The passphrase, the restore with its progress and cancel, and how it ended. */
export function useRestore({ backup, onRestored }: UseRestoreOptions) {
  const toast = useToast();
  const { captureSession, postNotice } = useSessionActions();
  const [passphrase, setPassphrase] = useState('');
  const [stage, setStage] = useState<Stage>(() => initialStage(backup));
  const [cancelling, setCancelling] = useState(false);
  const mounted = useMountedRef();
  // Set between the Restore press and the native call, so a Cancel in that frame counts.
  const startingRef = useRef<{ cancelled: boolean } | null>(null);

  // A closed sheet stays mounted until its modal is gone; it keeps no passphrase.
  if (!backup && passphrase) setPassphrase('');

  const restore = useCallback(async () => {
    if (!backup || !passphrase) return;
    const session = captureSession();
    const stillHere = () => mounted.current && session.current();
    setCancelling(false);
    setStage(startingProgress(backup.entries));
    // The module starts only once Checking is on screen. Drawing it right
    // after the tap is the JavaScript thread's busiest moment, and the iOS
    // check of a small backup is over in about 100 ms: started first, it ended
    // under that render, its Checking events arrived together afterwards, and
    // Cancel could only reach it past its last cancel point.
    const starting = { cancelled: false };
    startingRef.current = starting;
    await nextFrame();
    startingRef.current = null;
    if (!stillHere() || starting.cancelled) {
      if (mounted.current) {
        setCancelling(false);
        setStage(stageForOutcome(restoreOutcome(cancelledError())));
      }
      return;
    }
    try {
      const entries = await backupService.restoreBackup(backup.uri, passphrase, (event) => {
        if (!mounted.current) return;
        setStage({ name: 'running', progress: event });
        // The module refused the cancel: the restore goes on to its own outcome.
        if (!event.cancelling) setCancelling(false);
      });
      backupService.discardPickedFile(backup.uri);
      const message = t('backup.restore.done', { count: entries });
      if (stillHere()) {
        setPassphrase('');
        toast.show({ message, tone: 'success' });
        onRestored(entries);
      } else {
        postNotice({ message, tone: 'success' });
      }
    } catch (error) {
      if (stillHere()) {
        setStage(stageForOutcome(restoreOutcome(error)));
      } else {
        backupService.discardPickedFile(backup.uri);
        postNotice({
          message: describeBackupErrorPlainly(error, copy['restore.stoppedBehindLock']),
          tone: 'danger',
        });
      }
    } finally {
      if (mounted.current) setCancelling(false);
    }
  }, [backup, passphrase, captureSession, postNotice, toast, onRestored, mounted]);

  const cancel = useCallback(() => {
    if (startingRef.current) {
      startingRef.current.cancelled = true;
      setCancelling(true);
      return;
    }
    if (backupService.cancelRestore()) setCancelling(true);
  }, []);

  return { passphrase, setPassphrase, stage, cancelling, restore, cancel };
}
