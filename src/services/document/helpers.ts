import { DAY_MS } from '@/utils/time';

import { CACHE_DIRECTORIES, CACHE_PREFIXES } from './cacheNames';
import { IMAGE_PICKER_DIRECTORY, IMPORT_COPY, SCANNER_DIRECTORY } from './constants';

export function toPath(uriOrPath: string): string {
  return uriOrPath.startsWith('file://') ? uriOrPath.replace('file://', '') : uriOrPath;
}

export function toUri(pathOrUri: string): string {
  return pathOrUri.startsWith('file://') ? pathOrUri : `file://${pathOrUri}`;
}

// iOS reports tmp under /private/var and other folders under /var.
export function canonicalPath(path: string): string {
  return path.replace(/^\/private\/var\//, '/var/');
}

export function comparablePath(uriOrPath: string): string {
  return canonicalPath(decodeURIComponent(toPath(uriOrPath)));
}

export function childName(path: string, folder: string): string | null {
  const prefix = folder.replace(/\/?$/, '/');
  if (!path.startsWith(prefix)) return null;
  const name = path.slice(prefix.length);
  if (!name || name.includes('/') || name === '.' || name === '..') return null;
  return name;
}

export function cacheLocation(cacheUri: string, filename: string) {
  const uri = `${cacheUri}${filename}`;
  return { uri, path: toPath(uri) };
}

export function isCachePath(cacheUri: string, path: string) {
  return path.startsWith(toPath(cacheUri));
}

export function renamedCopyPattern(name: string): RegExp {
  const dot = name.lastIndexOf('.');
  const [base, extension] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${literal(base)}[ -]\\d+${literal(extension)}$`);
}

export function isClearableCacheEntry(name: string): boolean {
  return (
    CACHE_PREFIXES.some((prefix) => name.startsWith(prefix)) ||
    IMPORT_COPY.test(name) ||
    CACHE_DIRECTORIES.some((directory) => directory === name) ||
    name === IMAGE_PICKER_DIRECTORY ||
    name === SCANNER_DIRECTORY
  );
}

export function expiryCutoff(days: number, now: number): string {
  return new Date(now + days * DAY_MS).toISOString().slice(0, 10);
}

export function shareFileName(title: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || 'document';
}
