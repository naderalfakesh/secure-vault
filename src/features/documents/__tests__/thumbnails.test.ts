import { File } from 'expo-file-system';

import { documentService } from '@/services/DocumentService';

import { getThumbnail } from '../thumbnails';

jest.mock('@/services/DocumentService', () => ({
  documentService: { getDocumentThumbnail: jest.fn() },
}));

const decrypt = documentService.getDocumentThumbnail as jest.Mock;
const existing = new Set<string>();

beforeEach(() => {
  decrypt.mockReset();
  existing.clear();
  jest.spyOn(File.prototype, 'exists', 'get').mockImplementation(function (this: File) {
    return existing.has(this.uri);
  });
});

describe('getThumbnail', () => {
  it('decrypts on a miss and returns the cached uri while its file exists', async () => {
    decrypt.mockResolvedValue('file:///cache/thumb_a.jpg');
    existing.add('file:///cache/thumb_a.jpg');

    expect(await getThumbnail('hit')).toBe('file:///cache/thumb_a.jpg');
    expect(await getThumbnail('hit')).toBe('file:///cache/thumb_a.jpg');
    expect(decrypt).toHaveBeenCalledTimes(1);
  });

  it('decrypts again once the cached file is gone', async () => {
    decrypt.mockResolvedValueOnce('file:///cache/thumb_b.jpg');
    existing.add('file:///cache/thumb_b.jpg');
    await getThumbnail('evicted');

    existing.clear();
    decrypt.mockResolvedValueOnce('file:///cache/thumb_b2.jpg');
    expect(await getThumbnail('evicted')).toBe('file:///cache/thumb_b2.jpg');
    expect(decrypt).toHaveBeenCalledTimes(2);
  });

  it('does not cache a document without a thumbnail', async () => {
    decrypt.mockResolvedValue(null);

    expect(await getThumbnail('none')).toBeNull();
    expect(await getThumbnail('none')).toBeNull();
    expect(decrypt).toHaveBeenCalledTimes(2);
  });
});
