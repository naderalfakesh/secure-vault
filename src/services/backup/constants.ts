/** The container entry that carries the encrypted SQLite index. */
export const DATABASE_ENTRY = 'database';
/**
 * Cache folder where the vault module decrypts one entry at a time while it
 * writes a backup. It is emptied before and after every export and by the
 * lock and launch sweep in `DocumentService.clearCache`, so an export that is
 * killed mid-entry leaves at most one entry behind, and only until then.
 */
export const BACKUP_STAGING_DIRECTORY = 'backup-staging';
/**
 * Cache folder for a restore's payload copies and decrypted entries. The
 * module empties it before and after every restore, `replaceVault` removes
 * it, and `sweepCache` removes it at launch and at any lock with no restore
 * running, so a restore killed mid-entry leaves plaintext only until the next
 * launch.
 */
export const RESTORE_STAGING_DIRECTORY = 'restore-staging';
/** Cache folder of finished containers, the index copy, and the restore extras. */
export const BACKUP_DIRECTORY = 'backup';
/**
 * Folder in the app's documents (Android `files`, iOS `Documents`) that the
 * document picker's copy of a backup is moved into before it is inspected.
 * The cache is purgeable: under low storage Android's storage service and
 * iOS may delete a picked backup there while its restore sheet is open. The
 * vault module removes this exact folder without following links, and
 * `sweepCache` removes it at lock and launch like the cache folders.
 */
export const RESTORE_SOURCE_DIRECTORY = 'restore-source';
/** The picked backup's name inside `RESTORE_SOURCE_DIRECTORY`; the picker's own name never reaches the disk. */
export const RESTORE_SOURCE_FILE = 'picked.svbackup';

/** The brand and the extension are never translated; only the middle is. */
export const BACKUP_BRAND = 'SecureVault';
export const BACKUP_EXTENSION = '.svbackup';
