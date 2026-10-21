/** What an imported file is, or null when SecureVault can't add it. */
export type ImportKind = 'pdf' | 'image';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif']);
const EXTENSIONS: Record<string, ImportKind> = {
  pdf: 'pdf',
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  heic: 'image',
  heif: 'image',
};

/** Types that say only "some bytes"; the extension knows more. */
const GENERIC_TYPES = new Set([
  'application/octet-stream',
  'binary/octet-stream',
  'application/unknown',
  'application/x-unknown',
  '*/*',
]);

/** The reported type when it says what the file is, otherwise null. */
function specificType(mimeType: string | null | undefined): string | null {
  const type = mimeType?.toLowerCase().trim();
  return type && !GENERIC_TYPES.has(type) ? type : null;
}

/**
 * A PDF or a JPEG, PNG or HEIC image (handover §6 J1 import error). A
 * specific reported type wins; the extension decides when no type, or only a
 * generic binary type, is reported.
 */
export function importKind(name: string, mimeType: string | null | undefined): ImportKind | null {
  const type = specificType(mimeType);
  if (type) {
    if (type === 'application/pdf') return 'pdf';
    return IMAGE_TYPES.has(type) ? 'image' : null;
  }
  const dot = name.lastIndexOf('.');
  if (dot < 0) return null;
  return EXTENSIONS[name.slice(dot + 1).toLowerCase()] ?? null;
}

/** The MIME type a kind is saved under when the picker reported none. */
export function mimeTypeFor(name: string, kind: ImportKind): string {
  if (kind === 'pdf') return 'application/pdf';
  const extension = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'heic' || extension === 'heif') return `image/${extension}`;
  return 'image/jpeg';
}

/** The type a picked file is saved under: the reported one when specific. */
export function importMimeType(
  name: string,
  mimeType: string | null | undefined,
  kind: ImportKind,
): string {
  return specificType(mimeType) ?? mimeTypeFor(name, kind);
}

/** Moves the item at `index` one place earlier (-1) or later (+1); out of range is a no-op. */
export function movePage<T>(pages: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= pages.length || target < 0 || target >= pages.length) {
    return [...pages];
  }
  const next = [...pages];
  const [page] = next.splice(index, 1);
  next.splice(target, 0, page as T);
  return next;
}

export function stripExtension(name: string): string {
  return name.replace(/\.[^/.]+$/, '');
}
