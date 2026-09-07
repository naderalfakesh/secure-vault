import type { DocumentMetadata } from '@/types';

import type { DocumentRepository } from './DocumentRepository';

/**
 * Imports the prototype's single-JSON index into SQLite. Idempotent: rows that
 * already exist are skipped, so a crash halfway through is safe to retry.
 * Returns how many documents were imported.
 */
export async function migrateLegacyIndex(
  legacy: DocumentMetadata | null,
  repository: DocumentRepository,
): Promise<number> {
  if (!legacy) return 0;
  let imported = 0;
  for (const doc of Object.values(legacy.documents)) {
    if (await repository.get(doc.id)) continue;
    await repository.insert({
      id: doc.id,
      title: doc.title || 'Untitled document',
      category: doc.category,
      tags: doc.tags ?? [],
      ocrText: doc.ocrText,
      thumbnailKey: doc.thumbnailKey,
      fileKey: doc.fileKey,
      fileType: doc.fileType,
      fileSize: doc.fileSize ?? 0,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt ?? doc.createdAt,
    });
    imported += 1;
  }
  return imported;
}
