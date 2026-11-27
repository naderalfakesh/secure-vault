import * as Sharing from 'expo-sharing';

import type { ToastOptions } from '@/components/ui';
import type { SessionActions, SessionCapture } from '@/features/session/SessionProvider';
import { sharePause } from '@/features/session/SessionProvider';
import type { BackupResult } from '@/services/BackupService';

import { backupCopy as copy } from '../../backupCopy';
import { saveBackupToDevice } from '../../saveToDevice';
import { SAVE_INTERRUPTED, SHARE_INTERRUPTED } from '../constants';

type HandOffContext = {
  backup: BackupResult;
  session: SessionCapture;
  withoutAutoLock: SessionActions['withoutAutoLock'];
  postNotice: SessionActions['postNotice'];
  showToast: (options: ToastOptions) => void;
};

export async function saveToDevice({
  backup,
  session,
  withoutAutoLock,
  postNotice,
  showToast,
}: HandOffContext): Promise<Date | null> {
  let outcome: Awaited<ReturnType<typeof saveBackupToDevice>>;
  try {
    outcome = await saveBackupToDevice(backup.uri, backup.name, {
      aroundPicker: (work) => withoutAutoLock(work),
      stillCurrent: session.current,
      ended: session.ended(),
    });
  } catch {
    if (session.current()) {
      showToast({ message: copy['create.saveFailed'], tone: 'danger' });
    } else {
      postNotice({ message: SAVE_INTERRUPTED });
    }
    return null;
  }
  if (outcome === 'interrupted' || !session.current()) {
    postNotice({ message: SAVE_INTERRUPTED });
    return null;
  }
  if (outcome === 'cancelled') {
    showToast({ message: copy['create.saveCancelled'] });
    return null;
  }
  return new Date();
}

export async function shareBackup({
  backup,
  session,
  withoutAutoLock,
  postNotice,
}: HandOffContext): Promise<Date | null> {
  // Race against session end so an abandoned share sheet can't hold the export slot open.
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
    postNotice({ message: SHARE_INTERRUPTED });
    return null;
  }
  return new Date();
}
