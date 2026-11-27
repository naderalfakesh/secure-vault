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
    if (errorCode(e) === 'VAULT_EMPTIED') return { documents: [], error: null };
    return { documents: [], error: plainErrorMessage(e, t('library.loadFailed.fallback')) };
  }
}

export function useDocumentList() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
