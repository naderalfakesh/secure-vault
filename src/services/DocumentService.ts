// The document service lives in `./document`; this path stays for its callers.
export {
  APPLE_INBOX_DIRECTORY,
  documentService,
  default,
  IMAGE_PICKER_DIRECTORY,
  PICKER_DIRECTORY,
  SCANNER_DIRECTORY,
  shareFileName,
  UNDO_TOAST_MS,
  UNDO_WINDOW_MS,
} from './document';
export type { DeletedDocument, ShareCopy } from './document';
