import { DAY_MS } from '@/utils/time';

import { CACHE_DIRECTORIES, CACHE_PREFIXES } from './cacheNames';
import { IMAGE_PICKER_DIRECTORY, IMPORT_COPY, SCANNER_DIRECTORY } from './constants';

export function toPath(uriOrPath: string): string {
  return uriOrPath.startsWith('file://') ? uriOrPath.replace('file://', '') : uriOrPath;
}

export function toUri(pathOrUri: string): string {
  return pathOrUri.startsWith('file://') ? pathOrUri : `file://${pathOrUri}`;
}

/** iOS reports tmp under /private/var and the other folders under /var, the same place. */
export function canonicalPath(path: string): string {
  return path.replace(/^\/private\/var\//, '/var/');
}

/** Decoded, alias-free form of a file URI or path, for comparisons only. */
export function comparablePath(uriOrPath: string): string {
  return canonicalPath(decodeURIComponent(toPath(uriOrPath)));
}

/** The name of the entry at `path` when it sits directly inside `folder`, otherwise null. */
export function childName(path: string, folder: string): string | null {
  const prefix = folder.replace(/\/?$/, '/');
  if (!path.startsWith(prefix)) return null;
  const name = path.slice(prefix.length);
  if (!name || name.includes('/') || name === '.' || name === '..') return null;
  return name;
}

/** Where `filename` goes directly in the cache folder at `cacheUri`, as a URI and a path. */
export function cacheLocation(cacheUri: string, filename: string) {
  const uri = `${cacheUri}${filename}`;
  return { uri, path: toPath(uri) };
}

export function isCachePath(cacheUri: string, path: string) {
  return path.startsWith(toPath(cacheUri));
}

/**
 * Matches the names iOS gives a copy whose name is taken in the Inbox: a
 * space or a hyphen and a number before the extension ("scan 2.pdf" for
 * "scan.pdf").
 */
export function renamedCopyPattern(name: string): RegExp {
  const dot = name.lastIndexOf('.');
  const [base, extension] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${literal(base)}[ -]\\d+${literal(extension)}$`);
}

/** Whether an entry directly in the cache is decrypted or imported scratch that `clearCache` removes. */
export function isClearableCacheEntry(name: string): boolean {
  return (
    CACHE_PREFIXES.some((prefix) => name.startsWith(prefix)) ||
    IMPORT_COPY.test(name) ||
    CACHE_DIRECTORIES.some((directory) => directory === name) ||
    name === IMAGE_PICKER_DIRECTORY ||
    name === SCANNER_DIRECTORY
  );
}

/** The last day, YYYY-MM-DD in UTC, of a window of `days` from `now`. */
export function expiryCutoff(days: number, now: number): string {
  return new Date(now + days * DAY_MS).toISOString().slice(0, 10);
}

/** File-system safe name for a shared copy, e.g. "Passport (2026)" stays readable. */
export function shareFileName(title: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || 'document';
}
