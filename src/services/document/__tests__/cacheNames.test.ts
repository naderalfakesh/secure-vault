import {
  decryptedName,
  decryptedPageName,
  EXPORT_STAGING_DIRECTORY,
  pdfCoverName,
  pdfPagesName,
  SHARE_DIRECTORY,
  SHARING_STAGING_DIRECTORY,
  thumbnailName,
  undoName,
  undoPageName,
} from '../cacheNames';
import { isClearableCacheEntry } from '../helpers';

describe('plaintext cache names', () => {
  const names = {
    decrypted: [decryptedName('abc', 'pdf'), 'decrypted_abc.pdf'],
    decryptedImage: [decryptedName('abc', 'jpg'), 'decrypted_abc.jpg'],
    decryptedPage: [decryptedPageName('abc', 2), 'decrypted_abc_p2.jpg'],
    thumbnail: [thumbnailName('abc'), 'thumb_abc.jpg'],
    pdfPages: [pdfPagesName('abc'), 'pages_abc'],
    pdfCover: [pdfCoverName('abc'), 'pages_abc_cover'],
    undo: [undoName('abc', 'pdf'), 'undo_abc.pdf'],
    undoPage: [undoPageName('abc', 3), 'undo_abc_p3.jpg'],
  };

  it.each(Object.entries(names))('builds %s exactly as the files are named on disk', (_, pair) => {
    const [built, expected] = pair;
    expect(built).toBe(expected);
  });

  it.each(Object.entries(names))('sweeps %s', (_, pair) => {
    expect(isClearableCacheEntry(pair[0] ?? '')).toBe(true);
  });

  it('sweeps the folders that hold plaintext too', () => {
    expect(SHARE_DIRECTORY).toBe('share');
    expect(SHARING_STAGING_DIRECTORY).toBe('expo-sharing-tmp');
    expect(EXPORT_STAGING_DIRECTORY).toBe('backup-staging');
    for (const name of [SHARE_DIRECTORY, SHARING_STAGING_DIRECTORY, EXPORT_STAGING_DIRECTORY]) {
      expect(isClearableCacheEntry(name)).toBe(true);
    }
  });
});
