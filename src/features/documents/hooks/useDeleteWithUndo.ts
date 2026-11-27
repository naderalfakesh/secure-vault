import { useCallback } from 'react';

import { useToast } from '@/components/ui';
import { useSessionActions } from '@/features/session/SessionProvider';
import { t, tp } from '@/i18n';
import { type DeletedDocument, documentService, UNDO_TOAST_MS } from '@/services/DocumentService';
import type { Document } from '@/types';
import { isolate } from '@/utils/bidi';

const quoted = (title: string) => t('library.delete.quoted', { title: isolate(title) });

function singleTitle(deleted: readonly DeletedDocument[]): string | null {
  const [only, second] = deleted;
  return only && !second ? only.document.title : null;
}

async function undoDelete(
  deleted: readonly DeletedDocument[],
  toast: ReturnType<typeof useToast>,
): Promise<void> {
  const single = singleTitle(deleted);
  const missing: string[] = [];
  for (const item of deleted) {
    try {
      await documentService.restoreDocument(item);
    } catch {
      missing.push(item.document.title);
    }
  }
  if (missing.length > 0) {
    const [firstMissing] = missing;
    toast.show({
      message:
        missing.length === 1 && firstMissing !== undefined
          ? t('library.delete.restoreFailedOne', { title: quoted(firstMissing) })
          : t('library.delete.restoreFailedMany', { count: missing.length }),
      tone: 'danger',
    });
    return;
  }
  toast.show({
    message: single
      ? t('library.delete.backOne', { title: quoted(single) })
      : t('library.delete.backMany', { count: deleted.length }),
    tone: 'success',
  });
}

export function useDeleteWithUndo() {
  const toast = useToast();
  const { captureSession, postNotice } = useSessionActions();

  return useCallback(
    async (documents: readonly Document[]): Promise<number> => {
      const session = captureSession();
      const deleted: DeletedDocument[] = [];
      const failed: Document[] = [];
      for (const document of documents) {
        // Stop before decrypting further undo copies once the vault has locked.
        if (!session.current()) break;
        try {
          const result = await documentService.deleteDocumentWithUndo(document.id);
          if (result) deleted.push(result);
        } catch {
          failed.push(document);
        }
      }

      if (!session.current()) {
        // Re-sweep cache in case the last undo copy landed after the lock sweep.
        if (!captureSession().current()) documentService.clearCache().catch(() => {});
        const kept = documents.length - deleted.length;
        if (deleted.length === 0) {
          postNotice({
            message: t('library.delete.lockedNothing'),
          });
          return 0;
        }
        postNotice({
          message:
            tp('library.delete.lockedSome', deleted.length) +
            (kept > 0 ? tp('library.delete.othersKept', kept) : ''),
        });
        return deleted.length;
      }

      if (failed.length > 0) {
        const [firstFailed] = failed;
        toast.show({
          message:
            failed.length === 1 && firstFailed
              ? t('library.delete.failedOne', { title: quoted(firstFailed.title) })
              : t('library.delete.failedMany', { count: failed.length }),
          tone: 'danger',
        });
      }
      if (deleted.length === 0) return 0;

      const single = singleTitle(deleted);
      toast.show({
        message: single
          ? t('library.delete.doneOne', { title: quoted(single) })
          : t('library.delete.doneMany', { count: deleted.length }),
        icon: 'trash',
        countdown: true,
        durationMs: UNDO_TOAST_MS,
        action: { label: t('library.delete.undo'), onPress: () => void undoDelete(deleted, toast) },
      });
      return deleted.length;
    },
    [toast, captureSession, postNotice],
  );
}
