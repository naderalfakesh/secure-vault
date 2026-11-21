import { File } from 'expo-file-system';

import { documentService } from '@/services/DocumentService';

/** How many decrypted thumbnail URIs the in-memory cache keeps before dropping the oldest. */
const THUMBNAIL_CACHE_MAX_SIZE = 50;

const cache = new Map<string, string>();

/**
 * A document's decrypted thumbnail URI, or null when it has none. Locking the
 * app deletes the decrypted files, so a remembered URI counts only while its
 * file is still there.
 */
export async function getThumbnail(id: string): Promise<string | null> {
  const cached = cache.get(id);
  if (cached !== undefined) {
    if (new File(cached).exists) return cached;
    cache.delete(id);
  }

  const uri = await documentService.getDocumentThumbnail(id);
  if (uri) {
    if (cache.size >= THUMBNAIL_CACHE_MAX_SIZE) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(id, uri);
  }
  return uri;
}
