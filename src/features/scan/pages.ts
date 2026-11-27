import { t } from '@/i18n';
import { formatDate } from '@/utils/format';

type ImportKind = 'pdf' | 'image';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif']);
const EXTENSIONS: Record<string, ImportKind> = {
  pdf: 'pdf',
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  heic: 'image',
  heif: 'image',
};

const GENERIC_TYPES = new Set([
  'application/octet-stream',
  'binary/octet-stream',
  'application/unknown',
  'application/x-unknown',
  '*/*',
]);

function specificType(mimeType: string | null | undefined): string | null {
  const type = mimeType?.toLowerCase().trim();
  return type && !GENERIC_TYPES.has(type) ? type : null;
}

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

export function mimeTypeFor(name: string, kind: ImportKind): string {
  if (kind === 'pdf') return 'application/pdf';
  const extension = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'heic' || extension === 'heif') return `image/${extension}`;
  return 'image/jpeg';
}

export function importMimeType(
  name: string,
  mimeType: string | null | undefined,
  kind: ImportKind,
): string {
  return specificType(mimeType) ?? mimeTypeFor(name, kind);
}

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

// Picker/media-store IDs and placeholders that should fall back to a date-based title.
const ID_ONLY = [
  /^\d+$/,
  /^[a-z_]+:\d+$/i,
  /^content:\/\//i,
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  /^scan-\d+(-\d+)?$/,
];

export function suggestedTitleFor(name: string | null | undefined, now: Date = new Date()): string {
  const trimmed = (name ?? '').trim();
  const stem = /^content:\/\//i.test(trimmed) ? trimmed : stripExtension(trimmed).trim();
  if (!stem || ID_ONLY.some((pattern) => pattern.test(stem))) {
    return t('scan.defaultPhotoTitle', { date: formatDate(now.toISOString()) });
  }
  return stem;
}
