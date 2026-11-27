export const FILE_PREFIX = 'file_';
export const THUMB_PREFIX = 'thumb_';
export const PAGE_PREFIX = 'page_';
export const THUMBNAIL_MAX_PIXELS = 512;
export const PAGE_MAX_PIXELS = 2048;
export const UNDO_TOAST_MS = 5000;
export const UNDO_WINDOW_MS = 8000;
export const PICKER_DIRECTORY = 'DocumentPicker';
export const IMAGE_PICKER_DIRECTORY = 'ImagePicker';
export const SCANNER_DIRECTORY = 'mlkit_docscan_ui_client';
// iOS Files picker (asCopy) writes here in tmp before expo-document-picker copies it into cache.
export const APPLE_INBOX_DIRECTORY = 'com.naderalfakesh.securevault-Inbox';
export const IMPORT_DIRECTORIES = [PICKER_DIRECTORY, IMAGE_PICKER_DIRECTORY, SCANNER_DIRECTORY];
const UUID_PATTERN = '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}';
export const SCAN_PAGE = new RegExp(`^scan_${UUID_PATTERN}_\\d+\\.jpg$`);
export const PREVIEW_PREFIX = 'pages_preview_';
export const PREVIEW_FOLDER = /^pages_preview_\d+$/;
export const IMPORT_COPY_PREFIX = 'temp_import_';
export const IMPORT_COPY = /^temp_import_\d+$/;
export const IMPORT_COPY_TIMEOUT_MS = 8000;

// Scratch filename patterns left by older builds before dedicated staging folders.
export const LEGACY_APPLE_TMP = [
  new RegExp(`^backup-${UUID_PATTERN}$`),
  new RegExp(`^${UUID_PATTERN}$`),
];
export const LEGACY_ANDROID_CACHE = /^backup-?\d+\.tmp$/;
export const LEGACY_ANDROID_FILES = /^vault-?\d+\.tmp$/;
