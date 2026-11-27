import { BACKUP_STAGING_DIRECTORY } from '../backup/constants';

export const DECRYPTED_PREFIX = 'decrypted_';
export const THUMBNAIL_CACHE_PREFIX = 'thumb_';
export const PDF_PAGES_PREFIX = 'pages_';
export const UNDO_PREFIX = 'undo_';
export const SHARE_DIRECTORY = 'share';
// expo-sharing iOS staging dir; its own cleanup waits for the next share.
export const SHARING_STAGING_DIRECTORY = 'expo-sharing-tmp';
export const EXPORT_STAGING_DIRECTORY = BACKUP_STAGING_DIRECTORY;

export const CACHE_PREFIXES = [
  DECRYPTED_PREFIX,
  THUMBNAIL_CACHE_PREFIX,
  PDF_PAGES_PREFIX,
  UNDO_PREFIX,
] as const;

export const CACHE_DIRECTORIES = [
  SHARE_DIRECTORY,
  SHARING_STAGING_DIRECTORY,
  EXPORT_STAGING_DIRECTORY,
] as const;

export const decryptedName = (id: string, extension: string) =>
  `${DECRYPTED_PREFIX}${id}.${extension}`;
export const decryptedPageName = (id: string, page: number) =>
  `${DECRYPTED_PREFIX}${id}_p${page}.jpg`;
export const thumbnailName = (id: string) => `${THUMBNAIL_CACHE_PREFIX}${id}.jpg`;
export const pdfPagesName = (id: string) => `${PDF_PAGES_PREFIX}${id}`;
export const pdfCoverName = (id: string) => `${PDF_PAGES_PREFIX}${id}_cover`;
export const undoName = (id: string, extension: string) => `${UNDO_PREFIX}${id}.${extension}`;
export const undoPageName = (id: string, page: number) => `${UNDO_PREFIX}${id}_p${page}.jpg`;
