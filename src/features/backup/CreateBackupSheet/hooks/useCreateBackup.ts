import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/ui';
import { sharePause, useSession } from '@/features/session/SessionProvider';
import { t } from '@/i18n';
import { backupService, passphraseProblem } from '@/services/BackupService';
import { formatFileSize } from '@/utils/format';

import { backupCopy as copy } from '../../backupCopy';
import { recordLastBackup } from '../../lastBackup';
import { saveBackupToDevice } from '../../saveToDevice';
import {
  CAN_SAVE,
  EXPORT_STOPPED,
  SAVE_INTERRUPTED,
  SHARE_INTERRUPTED,
  SHEET_DISMISS_MS,
} from '../constants';
import { exportFailure } from '../helpers';
import type { CreateBackupSheetProps, Destination, Stage } from '../types';

/**
 * The create flow: the two passphrase fields, the export with its progress,
 * then the hand-off to the share sheet or the save screen.
 */
export function useCreateBackup({ visible, onClose, onShared }: CreateBackupSheetProps) {
  const toast = useToast();
  const { withoutAutoLock, captureSession, postNotice } = useSession();
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [stage, setStage] = useState<Stage>({ name: 'form' });
  const [open, setOpen] = useState(visible);
  // The lock unmounts the hub while an export may still be running.
  const mounted = useRef(true);
  // Try again after a failed export goes where the first attempt was going.
  const lastDestination = useRef<Destination>('share');
  const preferred: Destination = CAN_SAVE() ? 'save' : 'share';

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Each opening starts with empty fields. `open` follows `visible` until the
  // export hands off, when the sheet closes itself before the share sheet.
  if (visible !== open) {
    setOpen(visible);
    if (visible) {
      setPassphrase('');
      setConfirmation('');
      setStage({ name: 'form' });
    }
  }

  const create = useCallback(
    async (destination: Destination) => {
      if (passphraseProblem(passphrase, confirmation) !== null) return;
      lastDestination.current = destination;
      const session = captureSession();
      const stillHere = () => mounted.current && session.current();
      setStage({ name: 'busy', done: 0, total: 1 });
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
            setPassphrase('');
            setConfirmation('');
            setStage({ name: 'form' });
            onClose();
            // Let the sheet's modal finish dismissing; presenting the share sheet
            // over a dismissing modal leaves iOS with neither on screen.
            await new Promise((resolve) => setTimeout(resolve, SHEET_DISMISS_MS));
            if (!mounted.current || !(await session.confirm()) || !mounted.current) {
              cancelled = true;
              return;
            }
            if (destination === 'save') {
              // The same encrypted container the share sheet hands out; the
              // service removes the staged copy once this returns or throws.
              let outcome: Awaited<ReturnType<typeof saveBackupToDevice>>;
              try {
                outcome = await saveBackupToDevice(backup.uri, backup.name, {
                  aroundPicker: (work) => withoutAutoLock(work),
                  stillCurrent: session.current,
                  ended: session.ended(),
                });
              } catch {
                // The provider's own text can name paths or accounts: one sentence instead.
                if (session.current()) {
                  toast.show({ message: copy['create.saveFailed'], tone: 'danger' });
                } else {
                  postNotice({ message: SAVE_INTERRUPTED });
                }
                return;
              }
              if (outcome === 'interrupted' || !session.current()) {
                postNotice({ message: SAVE_INTERRUPTED });
                return;
              }
              if (outcome === 'cancelled') {
                toast.show({ message: copy['create.saveCancelled'] });
                return;
              }
              const saved = new Date();
              await recordLastBackup(saved);
              if (mounted.current) onShared(saved);
              toast.show({
                message: t('backup.create.saved', {
                  count: backup.entries,
                  size: formatFileSize(backup.bytes),
                }),
                tone: 'success',
              });
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
            if (mounted.current) onShared(made);
            toast.show({
              message: t('backup.create.shared', {
                count: backup.entries,
                size: formatFileSize(backup.bytes),
              }),
              tone: 'success',
            });
          },
          (event) => {
            if (mounted.current) setStage({ name: 'busy', done: event.done, total: event.total });
          },
        );
      } catch (error) {
        if (stillHere()) setStage({ name: 'error', message: exportFailure(error) });
        else cancelled = true;
      } finally {
        if (cancelled) postNotice({ message: EXPORT_STOPPED });
      }
    },
    [
      passphrase,
      confirmation,
      captureSession,
      withoutAutoLock,
      postNotice,
      toast,
      onClose,
      onShared,
    ],
  );

  const retry = useCallback(() => void create(lastDestination.current), [create]);

  return {
    open,
    stage,
    passphrase,
    setPassphrase,
    confirmation,
    setConfirmation,
    preferred,
    create,
    retry,
  };
}
