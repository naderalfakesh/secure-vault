import { useCallback, useMemo, useState } from 'react';

import type { Document } from '@/types';

import { presentIds, toggleId } from '../helpers';

/** Multi-select: rows that leave the vault drop out of the selection. */
export function useSelection(documents: readonly Document[]) {
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());

  const selected = useMemo(() => presentIds(picked, documents), [picked, documents]);

  const start = useCallback((document?: Document) => {
    setSelecting(true);
    setPicked(new Set(document ? [document.id] : []));
  }, []);

  const stop = useCallback(() => {
    setSelecting(false);
    setPicked(new Set());
  }, []);

  const toggle = useCallback((document: Document) => {
    setPicked((current) => toggleId(current, document.id));
  }, []);

  const pick = useCallback((list: readonly Document[]) => {
    setPicked(new Set(list.map((document) => document.id)));
  }, []);

  return { selecting, selected, start, stop, toggle, pick };
}
