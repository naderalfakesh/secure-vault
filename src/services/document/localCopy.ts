import { File, Paths } from 'expo-file-system';

import { AppError } from '@/utils/AppError';
import ExpoVaultModule from '@modules/expo-vault';

import { pdfCoverName } from './cacheNames';
import { IMPORT_COPY_PREFIX, IMPORT_COPY_TIMEOUT_MS, THUMBNAIL_MAX_PIXELS } from './constants';
import { cacheLocation, toPath, toUri } from './helpers';
import { discardImportCopy } from './residue';

export async function renderPdfCover(
  cacheUri: string,
  pdfPath: string,
  id: string,
): Promise<string | null> {
  const { path } = cacheLocation(cacheUri, pdfCoverName(id));
  const [cover] = await ExpoVaultModule.renderPdfPages(pdfPath, THUMBNAIL_MAX_PIXELS, path);
  return cover ? toPath(cover.uri) : null;
}

export function measureFileSize(path: string): number {
  try {
    return new File(toUri(path)).size || 0;
  } catch {
    return 0;
  }
}

// Copy Android content:// URIs via expo-file-system (ContentResolver); RN fetch rejects content://.
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
    // Uncancellable copy may still finish after timeout; clean up both now and on settle.
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
