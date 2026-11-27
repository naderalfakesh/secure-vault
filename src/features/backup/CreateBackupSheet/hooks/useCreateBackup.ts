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

export function useCreateBackup({ visible, onClose, onShared }: CreateBackupSheetProps) {
  const toast = useToast();
  const { withoutAutoLock, captureSession, postNotice } = useSessionActions();
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [stage, setStage] = useState<Stage>({ name: 'form' });
  const [open, setOpen] = useState(visible);
  const mounted = useMountedRef();
  const lastDestination = useRef<Destination>('share');
  const preferred: Destination = CAN_SAVE() ? 'save' : 'share';

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
            // Presenting a share sheet over a dismissing iOS modal leaves neither on screen.
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
