export const DATABASE_ENTRY = 'database';
export const BACKUP_STAGING_DIRECTORY = 'backup-staging';
export const RESTORE_STAGING_DIRECTORY = 'restore-staging';
export const BACKUP_DIRECTORY = 'backup';
// Stored in Documents rather than purgeable cache so low-storage cleanup cannot drop a picked backup mid-restore.
export const RESTORE_SOURCE_DIRECTORY = 'restore-source';
export const RESTORE_SOURCE_FILE = 'picked.svbackup';

export const BACKUP_BRAND = 'SecureVault';
export const BACKUP_EXTENSION = '.svbackup';
