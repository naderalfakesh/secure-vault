import { useCallback } from 'react';

import { useToast } from '@/components/ui';
import { useSession } from '@/features/session/SessionProvider';
import { type DeletedDocument, documentService, UNDO_TOAST_MS } from '@/services/DocumentService';
import type { Document } from '@/types';
import { t, tp } from '@/i18n';
import { isolate } from '@/utils/bidi';

const quoted = (title: string) => t('library.delete.quoted', { title: isolate(title) });

/**
 * Delete without a confirmation, then offer Undo with a countdown, using the
 * service's undo window.
 */
export function useDeleteWithUndo() {
  const toast = useToast();
  const { captureSession, postNotice } = useSession();

  return useCallback(
    async (documents: readonly Document[]): Promise<number> => {
      const session = captureSession();
      const deleted: DeletedDocument[] = [];
      const failed: Document[] = [];
      for (const document of documents) {
        // Each delete decrypts an undo copy; none may be written once the vault locked.
        if (!session.current()) break;
        try {
          const result = await documentService.deleteDocumentWithUndo(document.id);
          if (result) deleted.push(result);
        } catch {
          failed.push(document);
        }
      }

      if (!session.current()) {
        // The lock sweep may have run before the last undo copy was written;
        // sweep again unless a new session has already been unlocked. Undo is
        // gone with the copies, so the outcome waits for the next unlock.
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
        toast.show({
          message:
            failed.length === 1
              ? t('library.delete.failedOne', { title: quoted(failed[0].title) })
              : t('library.delete.failedMany', { count: failed.length }),
          tone: 'danger',
        });
        if (deleted.length === 0) return 0;
      }
      if (deleted.length === 0) return 0;

      const single = deleted.length === 1 ? deleted[0].document.title : null;
      toast.show({
        message: single
          ? t('library.delete.doneOne', { title: quoted(single) })
          : t('library.delete.doneMany', { count: deleted.length }),
        icon: 'trash',
        countdown: true,
        durationMs: UNDO_TOAST_MS,
        action: {
          label: t('library.delete.undo'),
          onPress: () => {
            void (async () => {
              const missing: string[] = [];
              for (const item of deleted) {
                try {
                  await documentService.restoreDocument(item);
                } catch {
                  missing.push(item.document.title);
                }
              }
              if (missing.length > 0) {
                toast.show({
                  message:
                    missing.length === 1
                      ? t('library.delete.restoreFailedOne', { title: quoted(missing[0]) })
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
            })();
          },
        },
      });
      return deleted.length;
    },
    [toast, captureSession, postNotice],
  );
}
