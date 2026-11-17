export const DEFAULT_DATABASE_NAME = 'securevault.db';
// Which file holds the index; a restore writes a new file and points here.
export const DATABASE_FILE_ENTRY = '_database_file';
export const DATABASE_KEY_ENTRY = '_database_key';
export const LEGACY_INDEX_ENTRY = '_documents_metadata';
export const LEGACY_IMPORTED_ENTRY = '_legacy_index_imported';
// The index under any name a restore gave it, with its SQLite side files.
export const INDEX_FILE = /^securevault(-\d+)?\.db(-wal|-shm|-journal)?$/;
// Only these hold an index; a side file left without its database does not.
export const MAIN_INDEX_FILE = /^securevault(-\d+)?\.db$/;
