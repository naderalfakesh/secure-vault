import { BACKUP_STAGING_DIRECTORY } from '../backup/constants';

/**
 * Every name of a decrypted scratch file or folder the service puts directly
 * in the cache. `isClearableCacheEntry` (the sweep behind lock and launch) is
 * written from these same constants, so a new kind of name cannot be added
 * here without the sweep knowing it.
 */
export const DECRYPTED_PREFIX = 'decrypted_';
export const THUMBNAIL_CACHE_PREFIX = 'thumb_';
/** A PDF's rendered pages (a folder) and its cover. */
export const PDF_PAGES_PREFIX = 'pages_';
export const UNDO_PREFIX = 'undo_';
/** Folder of decrypted copies handed to the share sheet. */
export const SHARE_DIRECTORY = 'share';
/**
 * expo-sharing's iOS staging links (a share whose extension differs from its
 * declared type); its own cleanup waits for the next share.
 */
export const SHARING_STAGING_DIRECTORY = 'expo-sharing-tmp';
/** BackupService's export staging: a killed export can leave one entry here. */
export const EXPORT_STAGING_DIRECTORY = BACKUP_STAGING_DIRECTORY;

/** Prefixes the sweep removes, whatever follows. */
export const CACHE_PREFIXES = [
  DECRYPTED_PREFIX,
  THUMBNAIL_CACHE_PREFIX,
  PDF_PAGES_PREFIX,
  UNDO_PREFIX,
] as const;

/** Exact names the sweep removes. */
export const CACHE_DIRECTORIES = [
  SHARE_DIRECTORY,
  SHARING_STAGING_DIRECTORY,
  EXPORT_STAGING_DIRECTORY,
] as const;

export const decryptedName = (id: string, extension: string) =>
  `${DECRYPTED_PREFIX}${id}.${extension}`;
/** An extra page of an image document; `page` counts from 1. */
export const decryptedPageName = (id: string, page: number) =>
  `${DECRYPTED_PREFIX}${id}_p${page}.jpg`;
export const thumbnailName = (id: string) => `${THUMBNAIL_CACHE_PREFIX}${id}.jpg`;
export const pdfPagesName = (id: string) => `${PDF_PAGES_PREFIX}${id}`;
export const pdfCoverName = (id: string) => `${PDF_PAGES_PREFIX}${id}_cover`;
export const undoName = (id: string, extension: string) => `${UNDO_PREFIX}${id}.${extension}`;
export const undoPageName = (id: string, page: number) => `${UNDO_PREFIX}${id}_p${page}.jpg`;
