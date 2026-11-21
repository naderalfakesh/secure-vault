import { useCallback, useState } from 'react';

import { useToast } from '@/components/ui';
import { parseTags } from '@/features/documents/tags';
import { t } from '@/i18n';
import { documentService } from '@/services/DocumentService';
import { type Document, DocumentCategory } from '@/types';
import { plainErrorMessage } from '@/utils/errors';

import { draftFromDocument } from '../helpers';
import type { Draft } from '../types';

/** The edit form in the details sheet: title, collection and tags. */
export function useDocumentEditor(
  document: Document | null,
  onSaved: (document: Document) => void,
) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    title: '',
    category: DocumentCategory.OTHER,
    tags: '',
  });
  const [titleError, setTitleError] = useState(false);

  const openEditor = useCallback(() => {
    if (!document) return;
    setDraft(draftFromDocument(document));
    setTitleError(false);
    setEditing(true);
  }, [document]);

  const closeEditor = useCallback(() => setEditing(false), []);

  const changeDraft = useCallback((next: Draft) => {
    setDraft(next);
    if (next.title.trim()) setTitleError(false);
  }, []);

  const saveEdits = useCallback(async () => {
    if (!document) return;
    const title = draft.title.trim();
    if (!title) {
      setTitleError(true);
      return;
    }
    const tags = parseTags(draft.tags);
    try {
      const updated = await documentService.updateDocument(document.id, {
        title,
        category: draft.category,
        tags,
      });
      if (updated) onSaved(updated);
      setEditing(false);
      toast.show({ message: t('viewer.edit.saved'), tone: 'success' });
    } catch (e) {
      toast.show({
        message: plainErrorMessage(e, t('viewer.edit.failed')),
        tone: 'danger',
      });
    }
  }, [document, draft, toast, onSaved]);

  return { editing, draft, titleError, openEditor, closeEditor, changeDraft, saveEdits };
}
