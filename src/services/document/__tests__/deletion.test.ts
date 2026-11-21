import { File } from 'expo-file-system';

import { documentDatabase } from '@/data/database';
import { vaultMock } from '@/testing/vault';
import vault from '@modules/expo-vault';

import { documentService } from '../../DocumentService';
import { UNDO_WINDOW_MS } from '../constants';

const picked = { uri: '/tmp/passport.jpg', name: 'passport.jpg', type: 'image/jpeg', size: 2048 };

/** A document with two pages, and the vault keys of its files. */
async function addWithPages() {
  const doc = await documentService.addDocument(picked, { title: 'Passport' });
  const { repository } = await documentDatabase.open();
  await repository.setPages(doc.id, ['page-1', 'page-2']);
  await vault.putFile('page-1', '/tmp/page-1');
  await vault.putFile('page-2', '/tmp/page-2');
  return { doc, keys: { page: 'page-1', thumbnail: doc.thumbnailKey, main: doc.fileKey } };
}

/** Makes `deleteFile` fail for one key and records every key it was asked to remove. */
function failDeleteOf(key: string) {
  const real = vault.deleteFile.bind(vault);
  const attempted: string[] = [];
  const spy = jest.spyOn(vault, 'deleteFile').mockImplementation(async (target) => {
    attempted.push(target);
    if (target === key) throw new Error('disk busy');
    return real(target);
  });
  return { attempted, spy };
}

describe('deleting a document', () => {
  beforeEach(async () => {
    vaultMock.reset();
    await documentDatabase.close();
    documentDatabase.allow();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(['page', 'thumbnail', 'main'] as const)(
    'keeps the row when the %s cannot be removed, and a second delete finishes the job',
    async (which) => {
      const { doc, keys } = await addWithPages();
      const failing = failDeleteOf(keys[which]);

      await expect(documentService.deleteDocument(doc.id)).rejects.toMatchObject({
        code: 'DELETE_INCOMPLETE',
      });

      expect(failing.attempted).toEqual(expect.arrayContaining(['page-1', 'page-2']));
      expect(failing.attempted).toEqual(expect.arrayContaining([doc.thumbnailKey, doc.fileKey]));
      expect(failing.attempted.at(-1)).toBe(doc.fileKey);
      expect(await documentService.getDocument(doc.id)).not.toBeNull();

      failing.spy.mockRestore();
      await expect(documentService.deleteDocument(doc.id)).resolves.toBe(true);
      expect(await documentService.getDocument(doc.id)).toBeNull();
      expect(await vault.getAllKeys()).not.toEqual(
        expect.arrayContaining([doc.fileKey, doc.thumbnailKey, 'page-1', 'page-2']),
      );
    },
  );

  it('leaves no undo copy in the cache and starts no timer when the delete fails', async () => {
    const { doc, keys } = await addWithPages();
    const written: string[] = [];
    jest.spyOn(vault, 'getFile').mockImplementation(async (_key, destPath) => {
      new File(`file://${destPath}`).writeSync('decrypted');
      written.push(destPath);
      return destPath;
    });
    failDeleteOf(keys.thumbnail);
    const timers = jest.spyOn(global, 'setTimeout');

    await expect(documentService.deleteDocumentWithUndo(doc.id)).rejects.toMatchObject({
      code: 'DELETE_INCOMPLETE',
    });

    expect(written.length).toBeGreaterThan(0);
    for (const path of written) expect(new File(`file://${path}`).exists).toBe(false);
    expect(timers.mock.calls.filter(([, delay]) => delay === UNDO_WINDOW_MS)).toHaveLength(0);
    expect(await documentService.getDocument(doc.id)).not.toBeNull();
  });
});

describe('"Delete everything"', () => {
  beforeEach(async () => {
    vaultMock.reset();
    await documentDatabase.close();
    documentDatabase.allow();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects when an encrypted document is left behind, and a second attempt can finish', async () => {
    const { doc } = await addWithPages();
    const failing = failDeleteOf(doc.fileKey);
    const failingEntry = jest.spyOn(vault, 'delete');

    await expect(documentService.eraseEverything()).rejects.toMatchObject({
      code: 'ERASE_INCOMPLETE',
      message: expect.stringMatching(/^"Delete everything" did not finish/),
    });
    expect(failingEntry).toHaveBeenCalled();
    expect(await vault.getAllKeys()).toContain(doc.fileKey);

    failing.spy.mockRestore();
    documentDatabase.allow();
    await expect(documentService.eraseEverything()).resolves.toBeUndefined();
    expect(await vault.getAllKeys()).toEqual([]);
  });

  it('resolves when nothing is left', async () => {
    await addWithPages();

    await expect(documentService.eraseEverything()).resolves.toBeUndefined();
    expect(await vault.getAllKeys()).toEqual([]);
  });
});
