import { File, Paths } from 'expo-file-system';

import { AppError } from '@/utils/AppError';
import ExpoVaultModule from '@modules/expo-vault';

import { pdfCoverName } from './cacheNames';
import { IMPORT_COPY_PREFIX, IMPORT_COPY_TIMEOUT_MS, THUMBNAIL_MAX_PIXELS } from './constants';
import { cacheLocation, toPath, toUri } from './helpers';
import { discardImportCopy } from './residue';

/** First page of a PDF as a JPEG in the cache, or null when it cannot be rendered. */
export async function renderPdfCover(
  cacheUri: string,
  pdfPath: string,
  id: string,
): Promise<string | null> {
  const { path } = cacheLocation(cacheUri, pdfCoverName(id));
  const [cover] = await ExpoVaultModule.renderPdfPages(pdfPath, THUMBNAIL_MAX_PIXELS, path);
  return cover ? toPath(cover.uri) : null;
}

/** The size of a local file in bytes, or 0 when it cannot be read. */
export function measureFileSize(path: string): number {
  try {
    return new File(toUri(path)).size || 0;
  } catch {
    return 0;
  }
}

/**
 * Copies a `content://` source into the cache so the native module can read a
 * path. No picker hands one over today (each copies into its own cache folder
 * first), but the scanner's page URIs come from Google Play services, whose
 * scheme the app does not control. The copy goes through expo-file-system,
 * which reads the provider with the content resolver: SDK 58's global fetch
 * refuses the scheme.
 */
export async function getLocalFilePath(cacheUri: string, uri: string): Promise<string> {
  if (uri.startsWith('/') || uri.startsWith('file://')) {
    return toPath(uri);
  }
  const tempFile = new File(Paths.cache, `${IMPORT_COPY_PREFIX}${Date.now()}`);
  const copying = new File(uri).copy(tempFile);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stalled = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new AppError('IMPORT_COPY_TIMEOUT', 'The file took too long to read.')),
      IMPORT_COPY_TIMEOUT_MS,
    );
  });
  try {
    await Promise.race([copying, stalled]);
    return toPath(tempFile.uri);
  } catch (e) {
    // A copy cut short by a read or write error is plaintext too. The copy
    // cannot be cancelled, so a stalled one is removed again once it settles.
    discardImportCopy(cacheUri, tempFile.uri);
    copying.then(
      () => discardImportCopy(cacheUri, tempFile.uri),
      () => discardImportCopy(cacheUri, tempFile.uri),
    );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
