import { isolate } from '@/utils/bidi';
import { pluralize } from '@/utils/format';

/**
 * The J1 Scan and import strings (handover §6 J1, §7.8), keyed so a later
 * string table (§10.1, F17) can take them over unchanged.
 */
export const scanCopy = {
  'sources.title': 'Add a document',
  'sources.footer':
    'Pages are encrypted on this device before they’re saved. The original photo or file is left where it was.',
  'sources.scan.title': 'Scan with the camera',
  'sources.scan.subtitle': 'Finds the edges, straightens pages, captures several at once',
  'sources.camera.title': 'Take a photo',
  'sources.camera.subtitle': 'Best for cards and single pages',
  'sources.library.title': 'Choose from Photos',
  'sources.library.subtitle': 'A photo you already took',
  'sources.files.title': 'Import a file',
  'sources.files.subtitle': 'PDF or image from Files',
  'sources.files.retry': 'Choose another file',
  'sources.noCamera': 'This device has no camera',
  'sources.cameraDenied':
    'Camera access is off for SecureVault. Turn it on in Settings to scan, or add a photo or file instead.',
  'sources.openSettings': 'Open Settings',
  'sources.failed': 'Could not open that source.',
  /** "‹name› can't be added." follows the isolated file name. */
  'import.unsupported': 'can’t be added. Choose a PDF or an image (JPEG, PNG, HEIC).',
  /**
   * Reserved for the import size limit (D9, handover §12). The limit is not
   * decided, so nothing shows this and no file is refused for its size.
   */
  'import.tooLarge': 'This file is larger than [LIMIT]. Split it or choose a smaller file.',
  'review.discard': 'Discard',
  'review.continue': 'Continue',
  'review.addPages': 'Add pages',
  'review.hint': 'Touch and hold a page to move it.',
  'review.moveEarlier': 'Move earlier',
  'review.moveLater': 'Move later',
  'review.remove': 'Remove',
  'review.doneMoving': 'Done',
  'processing.reading': 'Reading the document',
  'processing.saving': 'Saving the document',
  'processing.footer': 'Runs on this device. Nothing is uploaded.',
  'processing.cancel': 'Cancel',
  'processing.done': 'Done',
  'processing.working': 'Working…',
  'processing.unstoppable': 'This can’t be stopped.',
  'processing.unstoppableDetail': 'Your pages are being encrypted and saved on this device.',
  'processing.failed': 'Could not save the document.',
  'processing.retry': 'Try again',
  'processing.backToDetails': 'Back to details',
  /** The files are saved and only the found values failed: leave without them. */
  'processing.openDocument': 'Open document',
  'step.ocr': 'Reading the text',
  'step.suggest': 'Suggesting details',
  'step.encrypt': 'Encrypting',
  'step.index': 'Saving to your vault',
  'details.title': 'New document',
  'details.back': 'Back',
  'details.titleField': 'Title',
  'details.titlePlaceholder': 'Passport, lease, receipt',
  'details.titleMissing': 'Give the document a title.',
  'details.collection': 'Collection',
  'details.suggested': 'suggested',
  'details.found': 'Found in the text',
  'details.foundHint': 'Guessed on this device. Tap × to remove a value.',
  'details.tags': 'Tags',
  'details.tagsPlaceholder': 'travel, family',
  'details.tagsHint': 'Separate with commas',
  'details.save': 'Save to vault',
  'saved.withText': 'Saved with searchable text',
  'saved.plain': 'Saved to your vault',
  'saved.view': 'View',
  close: 'Cancel',
} as const;

export type ScanCopyKey = keyof typeof scanCopy;

export function scanText(key: ScanCopyKey): string {
  return scanCopy[key];
}

/** "budget-final.numbers can’t be added. Choose a PDF…", with the name isolated. */
export function unsupportedFileMessage(name: string): string {
  return `${isolate(name)} ${scanCopy['import.unsupported']}`;
}

/** Review header: "3 pages". */
export function pageCount(count: number): string {
  return pluralize(count, 'page');
}

export function pageLabel(index: number): string {
  return `Page ${index + 1}`;
}

/** What a screen reader says for a page in the review grid. */
export function pagePosition(index: number, count: number, moving: boolean): string {
  return `Page ${index + 1} of ${count}${moving ? ', moving' : ''}`;
}

/** Spoken after a page moves: "Moved to page 2 of 3". */
export function movedTo(index: number, count: number): string {
  return `Moved to page ${index + 1} of ${count}`;
}

const fieldNames: Record<string, string> = { expires: 'Expires', issued: 'Issued', number: 'No.' };

/** A found value as a chip: "Expires 3 Jan 2027", "No. •••• 4821" (numbers are masked). */
export function foundFieldLabel(
  field: { key: string; value: string; kind: string },
  formatDate: (iso: string) => string,
): string {
  const name = fieldNames[field.key] ?? field.key;
  if (field.kind === 'date') return `${name} ${formatDate(field.value)}`;
  if (field.key === 'number') return `${name} •••• ${field.value.slice(-4)}`;
  return `${name} ${field.value}`;
}
