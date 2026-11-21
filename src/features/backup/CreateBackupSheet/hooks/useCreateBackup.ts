import { useCallback, useRef, useState } from 'react';

import { useToast } from '@/components/ui';
import { useSessionActions } from '@/features/session/SessionProvider';
import { useMountedRef } from '@/hooks/useMountedRef';
import { t } from '@/i18n';
import { backupService, passphraseProblem } from '@/services/BackupService';
import { formatFileSize } from '@/utils/format';
import { wait } from '@/utils/time';

import { recordLastBackup } from '../../lastBackup';
import { CAN_SAVE, EXPORT_STOPPED, SHEET_DISMISS_MS } from '../constants';
import { exportFailure } from '../helpers';
import type { CreateBackupSheetProps, Destination, Stage } from '../types';
import { saveToDevice, shareBackup } from './handOff';

/**
 * The create flow: the two passphrase fields, the export with its progress,
 * then the hand-off to the share sheet or the save screen.
 */
export function useCreateBackup({ visible, onClose, onShared }: CreateBackupSheetProps) {
  const toast = useToast();
  const { withoutAutoLock, captureSession, postNotice } = useSessionActions();
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [stage, setStage] = useState<Stage>({ name: 'form' });
  const [open, setOpen] = useState(visible);
  // The lock unmounts the hub while an export may still be running.
  const mounted = useMountedRef();
  // Try again after a failed export goes where the first attempt was going.
  const lastDestination = useRef<Destination>('share');
  const preferred: Destination = CAN_SAVE() ? 'save' : 'share';

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
            await wait(SHEET_DISMISS_MS);
            if (!mounted.current || !(await session.confirm()) || !mounted.current) {
              cancelled = true;
              return;
            }
            const handOff = { backup, session, withoutAutoLock, postNotice, showToast: toast.show };
            const done = await (destination === 'save'
              ? saveToDevice(handOff)
              : shareBackup(handOff));
            if (!done) return;
            await recordLastBackup(done);
            if (mounted.current) onShared(done);
            toast.show({
              message: t(destination === 'save' ? 'backup.create.saved' : 'backup.create.shared', {
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
      mounted,
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
