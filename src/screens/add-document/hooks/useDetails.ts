import { useMemo, useReducer } from 'react';

import type { DocumentCategory } from '@/types';

import { detailsReducer, initialDetails } from '../detailsReducer';

export function useDetails() {
  const [details, dispatch] = useReducer(detailsReducer, '', initialDetails);

  const handlers = useMemo(
    () => ({
      setTitle: (title: string) => dispatch({ type: 'title', title }),
      setCategory: (category: DocumentCategory) => dispatch({ type: 'category', category }),
      setTags: (tags: string) => dispatch({ type: 'tags', tags }),
      removeField: (key: string) => dispatch({ type: 'removeField', key }),
    }),
    [],
  );

  return { details, dispatch, ...handlers };
}
