import type { Document } from '@/types';

/** "Delete everything" leaves the index closed until setup; the list is simply empty. */
export function isEmptiedVault(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'VAULT_EMPTIED';
}

/** The list with `updates` applied to the document `id`, for an optimistic update. */
export function withUpdate(documents: Document[], id: string, updates: Partial<Document>) {
  return documents.map((doc) => (doc.id === id ? { ...doc, ...updates } : doc));
}

/** The list without the document `id`, for an optimistic delete. */
export function withoutDocument(documents: Document[], id: string) {
  return documents.filter((doc) => doc.id !== id);
}

/** Adds `uri` for `id` to `cache`, first dropping the oldest entry when it holds `maxSize`. */
export function rememberThumbnail(
  cache: Map<string, string>,
  id: string,
  uri: string,
  maxSize: number,
): void {
  // Manage cache size
  if (cache.size >= maxSize) {
    const firstKey = cache.keys().next().value;
    if (firstKey) {
      cache.delete(firstKey);
    }
  }
  cache.set(id, uri);
}
