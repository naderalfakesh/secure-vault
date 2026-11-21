import * as Sharing from 'expo-sharing';

import type { ToastOptions } from '@/components/ui';
import type { SessionCapture, SessionContextValue } from '@/features/session/SessionProvider';
import { sharePause } from '@/features/session/SessionProvider';
import type { BackupResult } from '@/services/BackupService';

import { backupCopy as copy } from '../../backupCopy';
import { saveBackupToDevice } from '../../saveToDevice';
import { SAVE_INTERRUPTED, SHARE_INTERRUPTED } from '../constants';

/** What the hand-off of a finished container needs from the session and the screen. */
type HandOffContext = {
  backup: BackupResult;
  session: SessionCapture;
  withoutAutoLock: SessionContextValue['withoutAutoLock'];
  postNotice: SessionContextValue['postNotice'];
  showToast: (options: ToastOptions) => void;
};

/**
 * Writes the container to a folder the person picks. Every outcome that is not
 * a save is reported here; resolves with the save time only when it was saved.
 * The same encrypted container the share sheet hands out; the service removes
 * the staged copy once the export callback returns or throws.
 */
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
    // The provider's own text can name paths or accounts: one sentence instead.
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

/**
 * Opens the system share sheet for the container. Resolves with the time it
 * was shared, or null when the session ended first.
 */
export async function shareBackup({
  backup,
  session,
  withoutAutoLock,
  postNotice,
}: HandOffContext): Promise<Date | null> {
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
    return null;
  }
  return new Date();
}
