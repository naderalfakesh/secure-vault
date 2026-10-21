import { useCallback } from 'react';

import { useToast } from '@/components/ui';
import { useSession } from '@/features/session/SessionProvider';
import { type DeletedDocument, documentService, UNDO_TOAST_MS } from '@/services/DocumentService';
import type { Document } from '@/types';
import { isolate } from '@/utils/bidi';

const quoted = (title: string) => `“${isolate(title)}”`;

/**
 * Delete without a confirmation, then offer Undo with a countdown (handover
 * §6 J7). This uses the service's existing undo window; the deferred,
 * plaintext-free delete (§8 F8) replaces it later.
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
            message: 'The vault locked before anything was deleted. Nothing was changed.',
          });
          return 0;
        }
        postNotice({
          message:
            `The vault locked while deleting. ${deleted.length === 1 ? '1 document was' : `${deleted.length} documents were`} deleted and can’t be brought back.` +
            (kept > 0 ? ` The ${kept === 1 ? 'other is' : 'others are'} still in your vault.` : ''),
        });
        return deleted.length;
      }

      if (failed.length > 0) {
        toast.show({
          message:
            failed.length === 1
              ? `Couldn’t delete ${quoted(failed[0].title)}. It’s still in your vault.`
              : `Couldn’t delete ${failed.length} documents. They’re still in your vault.`,
          tone: 'danger',
        });
        if (deleted.length === 0) return 0;
      }
      if (deleted.length === 0) return 0;

      const single = deleted.length === 1 ? deleted[0].document.title : null;
      toast.show({
        message: single ? `${quoted(single)} deleted` : `${deleted.length} documents deleted`,
        icon: 'trash',
        countdown: true,
        durationMs: UNDO_TOAST_MS,
        action: {
          label: 'Undo',
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
                      ? `Couldn’t bring back ${quoted(missing[0])}.`
                      : `Couldn’t bring back ${missing.length} documents.`,
                  tone: 'danger',
                });
                return;
              }
              toast.show({
                message: single
                  ? `${quoted(single)} is back`
                  : `${deleted.length} documents are back`,
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
