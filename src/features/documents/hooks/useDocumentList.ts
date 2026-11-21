import { useCallback, useEffect, useState } from 'react';

import { useMountedRef } from '@/hooks/useMountedRef';
import { t } from '@/i18n';
import { documentService } from '@/services/DocumentService';
import type { Document } from '@/types';
import { errorCode, plainErrorMessage } from '@/utils/errors';

type Loaded = { documents: Document[]; error: string | null };

async function load(): Promise<Loaded> {
  try {
    await documentService.initialize();
    return { documents: await documentService.getAllDocuments(), error: null };
  } catch (e: unknown) {
    // "Delete everything" leaves the index closed until setup: an empty list, not a failure.
    if (errorCode(e) === 'VAULT_EMPTIED') return { documents: [], error: null };
    // No stale rows under a failed index: their files may be gone.
    return { documents: [], error: plainErrorMessage(e, t('library.loadFailed.fallback')) };
  }
}

/**
 * The document list. It loads on mount and reloads silently after any write
 * the service reports; `refresh` reloads with the loading state.
 */
export function useDocumentList() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumped by the service after any write, so the list reloads silently.
  const [version, setVersion] = useState(0);
  const mountedRef = useMountedRef();

  useEffect(() => documentService.subscribe(() => setVersion((v) => v + 1)), []);

  const apply = useCallback((result: Loaded) => {
    setDocuments(result.documents);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void load().then((result) => {
      if (active) apply(result);
    });
    return () => {
      active = false;
    };
  }, [version, apply]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await load();
    if (mountedRef.current) apply(result);
  }, [apply, mountedRef]);

  return { documents, loading, error, refresh };
}
