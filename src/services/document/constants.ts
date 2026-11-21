export const FILE_PREFIX = 'file_';
export const THUMB_PREFIX = 'thumb_';
export const PAGE_PREFIX = 'page_';
// Two-column grid cells are about 180 pt wide, so 512 px covers 3x screens.
export const THUMBNAIL_MAX_PIXELS = 512;
// Full-screen pages on a 3x phone; larger only costs memory in the viewer.
export const PAGE_MAX_PIXELS = 2048;
// How long the undo toast stays up, and how much longer the decrypted copies
// survive so a tap on a visible Undo always finds them.
export const UNDO_TOAST_MS = 5000;
export const UNDO_WINDOW_MS = 8000;
/**
 * Where the document picker copies a picked file when asked to: a UUID-named
 * file in `Caches/DocumentPicker` on iOS and `cacheDir/DocumentPicker` on
 * Android. An imported document's copy there is plaintext.
 */
export const PICKER_DIRECTORY = 'DocumentPicker';
/** expo-image-picker's copies of chosen and taken photos: `Caches/ImagePicker`, `cacheDir/ImagePicker`. */
export const IMAGE_PICKER_DIRECTORY = 'ImagePicker';
/** Where the ML Kit scanner client copies each page on Android: `cacheDir/mlkit_docscan_ui_client`. */
export const SCANNER_DIRECTORY = 'mlkit_docscan_ui_client';
/**
 * iOS's own copy of a file imported from Files (the picker runs `asCopy`):
 * `tmp/<bundle id>-Inbox/<original name>`, made before expo-document-picker
 * copies it again into its cache folder.
 */
export const APPLE_INBOX_DIRECTORY = 'com.naderalfakesh.securevault-Inbox';
export const IMPORT_DIRECTORIES = [PICKER_DIRECTORY, IMAGE_PICKER_DIRECTORY, SCANNER_DIRECTORY];
const UUID_PATTERN = '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}';
/** The iOS scanner module's pages in tmp: `scan_<batch UUID>_<index>.jpg`. */
export const SCAN_PAGE = new RegExp(`^scan_${UUID_PATTERN}_\\d+\\.jpg$`);
export const PREVIEW_PREFIX = 'pages_preview_';
export const PREVIEW_FOLDER = /^pages_preview_\d+$/;
/** `getLocalFilePath`'s plaintext copy of an Android `content://` file, directly in the cache. */
export const IMPORT_COPY_PREFIX = 'temp_import_';
export const IMPORT_COPY = /^temp_import_\d+$/;
/** How long a content provider may take to hand over a file before the save gives up. */
export const IMPORT_COPY_TIMEOUT_MS = 8000;

/**
 * Plaintext scratch that builds before the staging folders wrote and could
 * leave behind when killed. Nothing current writes these names.
 */
export const LEGACY_APPLE_TMP = [
  new RegExp(`^backup-${UUID_PATTERN}$`),
  new RegExp(`^${UUID_PATTERN}$`),
];
export const LEGACY_ANDROID_CACHE = /^backup-?\d+\.tmp$/;
export const LEGACY_ANDROID_FILES = /^vault-?\d+\.tmp$/;
