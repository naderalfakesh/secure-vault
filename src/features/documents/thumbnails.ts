import { File } from 'expo-file-system';

import { documentService } from '@/services/DocumentService';

const THUMBNAIL_CACHE_MAX_SIZE = 50;

const cache = new Map<string, string>();

// Lock sweeps decrypted files on disk, so verify a cached URI still exists.
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
