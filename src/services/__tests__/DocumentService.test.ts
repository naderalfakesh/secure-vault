import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';

import { closeDocumentStore, openDocumentStore } from '@/data/database';

import vault from '../../../modules/expo-vault';
import { DocumentCategory } from '../../types';
import { documentService, PICKER_DIRECTORY, shareFileName } from '../DocumentService';

const vaultMock = vault as unknown as { reset(): void };

/** The vault mock keeps no files; stand in for the decrypted file the share copy is made from. */
function decryptedCopyOf(id: string) {
  const source = new File(Paths.cache, `decrypted_${id}.jpg`);
  source.writeSync('jpeg');
  jest.spyOn(documentService, 'getDocumentFile').mockResolvedValue(source.uri);
}

const picked = { uri: '/tmp/passport.jpg', name: 'passport.jpg', type: 'image/jpeg', size: 2048 };

describe('DocumentService', () => {
  beforeEach(async () => {
    vaultMock.reset();
    // The next call opens a fresh, empty in-memory index.
    await closeDocumentStore();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reloads without closing the connection a screen may still be querying', async () => {
    const { db, repository } = await openDocumentStore();
    const close = jest.spyOn(db, 'close');
    const listener = jest.fn();
    const unsubscribe = documentService.subscribe(listener);

    await documentService.reload();

    expect(close).not.toHaveBeenCalled();
    await expect(repository.list()).resolves.toEqual([]);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('measures a scan whose pages came without a size, every page counted', async () => {
    const folder = new Directory(Paths.cache, 'size-test');
    folder.create({ intermediates: true, idempotent: true });
    const first = new File(folder, 'page1.jpg');
    first.writeSync('x'.repeat(1500));
    const second = new File(folder, 'page2.jpg');
    second.writeSync('y'.repeat(700));

    const doc = await documentService.addDocument(
      [
        { uri: first.uri, name: 'scan-1.jpg', type: 'image/jpeg' },
        { uri: second.uri, name: 'scan-2.jpg', type: 'image/jpeg' },
      ],
      { title: 'Lease' },
    );

    expect(doc.fileSize).toBe(2200);
    expect((await documentService.getDocument(doc.id))?.fileSize).toBe(2200);
    folder.delete();
  });

  it('keeps the size the picker reported', async () => {
    const doc = await documentService.addDocument(picked, { title: 'Passport' });
    expect(doc.fileSize).toBe(2048);
  });

  it('stores documents in the encrypted index and notifies subscribers on every write', async () => {
    const listener = jest.fn();
    const unsubscribe = documentService.subscribe(listener);

    const doc = await documentService.addDocument(picked, {
      title: 'Passport',
      category: DocumentCategory.ID,
      tags: ['travel'],
    });
    expect(listener).toHaveBeenCalledTimes(1);

    await documentService.updateDocument(doc.id, { title: 'Passport 2030' });
    expect(listener).toHaveBeenCalledTimes(2);
    expect((await documentService.getDocument(doc.id))?.title).toBe('Passport 2030');

    await documentService.deleteDocument(doc.id);
    expect(listener).toHaveBeenCalledTimes(3);
    expect(await documentService.getAllDocuments()).toHaveLength(0);

    unsubscribe();
    await documentService.addDocument(picked, { title: 'Again' });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('searches titles, tags, and extracted text', async () => {
    await documentService.addDocument(picked, {
      title: 'Lease',
      category: DocumentCategory.LEGAL,
      tags: ['home'],
      ocrText: 'Tenant agrees to pay rent monthly',
    });
    await documentService.addDocument(picked, {
      title: 'Receipt',
      category: DocumentCategory.RECEIPTS,
    });

    expect((await documentService.searchDocuments('rent')).map((d) => d.title)).toEqual(['Lease']);
    expect((await documentService.searchDocuments('home')).map((d) => d.title)).toEqual(['Lease']);
    expect(await documentService.searchDocuments('nothing')).toHaveLength(0);
  });

  it('empties the image library caches with the decrypted files', async () => {
    const memory = jest.spyOn(Image, 'clearMemoryCache').mockResolvedValue(true);
    const disk = jest.spyOn(Image, 'clearDiskCache').mockResolvedValue(true);

    await documentService.clearCache();

    expect(memory).toHaveBeenCalledTimes(1);
    expect(disk).toHaveBeenCalledTimes(1);
    memory.mockRestore();
    disk.mockRestore();
  });

  it('still clears the decrypted files when the image library cannot clear its cache', async () => {
    const disk = jest.spyOn(Image, 'clearDiskCache').mockRejectedValue(new Error('busy'));

    await expect(documentService.clearCache()).resolves.toBeUndefined();
    disk.mockRestore();
  });

  it('still clears the decrypted files when "Delete everything" did not finish', async () => {
    const preview = new File(Paths.cache, 'decrypted_0D2C.jpg');
    preview.writeSync('jpeg');
    const listing = jest
      .spyOn(vault, 'getAllKeys')
      .mockRejectedValueOnce(
        Object.assign(new Error('not finished'), { code: 'ERASE_INCOMPLETE' }),
      );

    await expect(documentService.eraseEverything()).rejects.toMatchObject({
      code: 'ERASE_INCOMPLETE',
    });

    expect(preview.exists).toBe(false);
    listing.mockRestore();
  });

  it("removes the vault module's thumbnail scratch file at lock and launch", async () => {
    const scratch = new File(Paths.cache, 'thumb_encrypt_0D2C');
    scratch.writeSync('jpeg');

    await documentService.clearCache();

    expect(scratch.exists).toBe(false);
  });

  it('names an image copy .jpeg so the iOS share sheet shares it without a staged link', async () => {
    // expo-sharing hard-links a file whose extension differs from the declared
    // type's (public.jpeg wants .jpeg) into its own cache folder, which outlives
    // our discard.
    const doc = await documentService.addDocument(picked, { title: 'Passport' });
    decryptedCopyOf(doc.id);

    const copy = await documentService.prepareShareFile(doc.id);

    expect(copy?.uri).toMatch(/\/Passport\.jpeg$/);
    copy?.discard();
  });

  it('puts every share copy in a folder of its own so a content URI is never reused', async () => {
    // Android grants read access to the copy's content URI for every share
    // target; a later copy at the same path would inherit those grants.
    const doc = await documentService.addDocument(picked, { title: 'Passport' });
    decryptedCopyOf(doc.id);

    const first = await documentService.prepareShareFile(doc.id);
    first?.discard();
    const second = await documentService.prepareShareFile(doc.id);

    expect(first?.uri).not.toBe(second?.uri);
    expect(second?.uri).toContain('/share/');
    second?.discard();
    expect(new File(second!.uri).exists).toBe(false);
  });

  it('hands the copy folder to the native expiry, and cancels it on discard', async () => {
    // Android pauses JS timers behind the share chooser; the native expiry
    // deletes the copy on the main looper instead.
    const doc = await documentService.addDocument(picked, { title: 'Passport' });
    decryptedCopyOf(doc.id);
    const schedule = jest.spyOn(vault, 'scheduleShareExpiry');
    const cancel = jest.spyOn(vault, 'cancelShareExpiry');

    const copy = await documentService.prepareShareFile(doc.id);
    copy!.expireAfter(120_000);

    const folder = decodeURIComponent(copy!.uri.replace(/^file:\/\//, '')).replace(
      /\/Passport\.jpeg$/,
      '',
    );
    expect(schedule).toHaveBeenCalledWith(folder, 120_000);
    copy!.discard();
    expect(cancel).toHaveBeenCalledWith(folder);
  });

  it('removes the share copy folder without following links, on discard and after a failed copy', async () => {
    const doc = await documentService.addDocument(picked, { title: 'Passport' });
    decryptedCopyOf(doc.id);
    const remove = jest.spyOn(vault, 'removeTreeNoFollow');

    const copy = await documentService.prepareShareFile(doc.id);
    const folder = decodeURIComponent(copy!.uri.replace(/^file:\/\//, '')).replace(
      /\/Passport\.jpeg$/,
      '',
    );
    copy!.discard();
    expect(remove).toHaveBeenCalledWith(folder);
    expect(new Directory(`file://${folder}`).exists).toBe(false);

    remove.mockClear();
    jest
      .spyOn(documentService, 'getDocumentFile')
      .mockResolvedValue(new File(Paths.cache, 'decrypted_missing.jpg').uri);
    await expect(documentService.prepareShareFile(doc.id)).rejects.toThrow();
    expect(remove).toHaveBeenCalledWith(expect.stringMatching(/\/share\/[^/]+$/));
  });

  it('removes a partial share copy when the copy fails', async () => {
    const doc = await documentService.addDocument(picked, { title: 'Passport' });
    // A decrypted source that is not there: the copy throws mid-way.
    jest
      .spyOn(documentService, 'getDocumentFile')
      .mockResolvedValue(new File(Paths.cache, 'decrypted_missing.jpg').uri);

    await expect(documentService.prepareShareFile(doc.id)).rejects.toThrow();

    const share = new Directory(Paths.cache, 'share');
    expect(share.exists ? share.list() : []).toEqual([]);
  });

  it("removes expo-sharing's staged links at lock and launch", async () => {
    const staging = new Directory(Paths.cache, 'expo-sharing-tmp');
    staging.create({ intermediates: true, idempotent: true });
    const staged = new File(staging, 'Passport.jpg.jpeg');
    staged.writeSync('jpeg');

    await documentService.clearCache();

    expect(staged.exists).toBe(false);
  });

  it('leaves no document or vault entries behind when writing its pages fails', async () => {
    const { repository } = await openDocumentStore();
    const pages = [picked, { ...picked, uri: '/tmp/page-2.jpg', name: 'page-2.jpg' }];
    const setPages = jest
      .spyOn(repository, 'setPages')
      .mockRejectedValueOnce(new Error('index busy'));

    await expect(documentService.addDocument(pages, { title: 'Lease' })).rejects.toThrow(
      'index busy',
    );

    expect(await documentService.getAllDocuments()).toHaveLength(0);
    expect(await vault.getAllKeys()).toEqual([]);

    // A retry from the same pick makes exactly one document.
    await documentService.addDocument(pages, { title: 'Lease' });
    expect(await documentService.getAllDocuments()).toHaveLength(1);
    setPages.mockRestore();
  });

  it('names shared copies after the document and strips unsafe characters', () => {
    expect(shareFileName('Passport: Jane/Doe?')).toBe('Passport Jane Doe');
    expect(shareFileName('   ')).toBe('document');
    expect(shareFileName('x'.repeat(100))).toHaveLength(80);
  });

  it('rasterises pdf pages instead of returning the pdf itself', async () => {
    const doc = await documentService.addDocument(
      { uri: '/tmp/lease.pdf', name: 'lease.pdf', type: 'application/pdf', size: 4096 },
      { title: 'Lease' },
    );
    expect(doc.fileType).toBe('pdf');
    const pages = await documentService.getDocumentPages(doc.id);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatch(/pages_.*page_1\.jpg$/);
  });

  it('deletes with a snapshot that can restore the document under the same id', async () => {
    const doc = await documentService.addDocument(picked, {
      title: 'Passport',
      category: DocumentCategory.ID,
      tags: ['travel'],
    });
    await documentService.setFields(doc.id, [
      { key: 'expires', value: '2030-01-01', kind: 'date' },
    ]);

    const deleted = await documentService.deleteDocumentWithUndo(doc.id);
    expect(deleted?.document.id).toBe(doc.id);
    expect(deleted?.files[0]?.uri).toContain(`undo_${doc.id}`);
    expect(await documentService.getDocument(doc.id)).toBeNull();

    const restored = await documentService.restoreDocument(deleted!);
    expect(restored.id).toBe(doc.id);
    expect(restored.title).toBe('Passport');
    expect(restored.createdAt).toBe(doc.createdAt);
    expect(await documentService.getFields(doc.id)).toEqual([
      { key: 'expires', value: '2030-01-01', kind: 'date' },
    ]);
    expect(await documentService.getAllDocuments()).toHaveLength(1);
  });

  describe("the document picker's plaintext copies", () => {
    const pickerFolder = () => new Directory(Paths.cache, PICKER_DIRECTORY);
    const plantCopy = (name: string) => {
      if (!pickerFolder().exists) pickerFolder().create({ intermediates: true });
      const copy = new File(pickerFolder(), name);
      copy.writeSync('plaintext');
      return copy;
    };

    afterEach(() => {
      if (pickerFolder().exists) pickerFolder().delete();
    });

    it('removes the copy once the document is in the vault', async () => {
      const pdf = plantCopy('8F0C2A41-6B3D-4E8A-9F11-2C7D5E0B9A13.pdf');
      const photo = plantCopy('5A1E9C70-0D2B-4F6E-8C3A-7B4D1E2F3A90.jpg');

      await documentService.addDocument(
        { uri: pdf.uri, name: 'lease.pdf', type: 'application/pdf', size: 9 },
        { title: 'Lease' },
      );
      await documentService.addDocument(
        { uri: photo.uri, name: 'passport.jpg', type: 'image/jpeg', size: 9 },
        { title: 'Passport' },
      );

      expect(pdf.exists).toBe(false);
      expect(photo.exists).toBe(false);
    });

    it('keeps the copy for a retry when saving fails, and drops it when the screen lets go', async () => {
      const copy = plantCopy('0B7E3D52-1C4A-4B9F-A6E2-8D5F7C9A1B30.pdf');
      const spy = jest.spyOn(vault, 'putFile').mockRejectedValueOnce(new Error('disk full'));
      try {
        await expect(
          documentService.addDocument(
            { uri: copy.uri, name: 'lease.pdf', type: 'application/pdf' },
            { title: 'Lease' },
          ),
        ).rejects.toThrow('disk full');
      } finally {
        spy.mockRestore();
      }
      expect(copy.exists).toBe(true);

      documentService.discardPickedCopy(copy.uri);

      expect(copy.exists).toBe(false);
    });

    it('never removes a file outside the picker folder', async () => {
      const own = new File(Paths.document, 'lease.pdf');
      own.writeSync('plaintext');
      const lookalike = new Directory(Paths.cache, `${PICKER_DIRECTORY}-other`);
      lookalike.create();
      const neighbour = new File(lookalike, 'other.pdf');
      neighbour.writeSync('plaintext');
      const decoy = plantCopy('decoy.pdf');
      try {
        await documentService.addDocument(
          { uri: own.uri, name: 'lease.pdf', type: 'application/pdf' },
          { title: 'Own file' },
        );
        documentService.discardPickedCopy(own.uri);
        documentService.discardPickedCopy(neighbour.uri);
        // The mock file system never resolves `..` or `%2E%2E`, so assert the
        // guard refuses these before anything is deleted.
        const fileExists = jest.spyOn(File.prototype, 'exists', 'get');
        const fileDelete = jest.spyOn(File.prototype, 'delete');
        try {
          for (const uri of [
            `${pickerFolder().uri}../${PICKER_DIRECTORY}-other/other.pdf`,
            `${pickerFolder().uri}%2E%2E/${PICKER_DIRECTORY}-other/other.pdf`,
            `${pickerFolder().uri}%2e%2e%2F${PICKER_DIRECTORY}-other%2Fother.pdf`,
            `${pickerFolder().uri}%2E%2E`,
            pickerFolder().uri,
          ]) {
            documentService.discardPickedCopy(uri);
          }
          expect(fileExists).not.toHaveBeenCalled();
          expect(fileDelete).not.toHaveBeenCalled();
        } finally {
          fileExists.mockRestore();
          fileDelete.mockRestore();
        }

        expect(own.exists).toBe(true);
        expect(neighbour.exists).toBe(true);
        expect(pickerFolder().exists).toBe(true);
        expect(decoy.exists).toBe(true);
      } finally {
        own.delete();
        lookalike.delete();
      }
    });
  });

  it('previews photos as they are and pdfs through their rendered first page', async () => {
    expect(await documentService.previewForFile('/tmp/passport.jpg', 'image/jpeg')).toBe(
      '/tmp/passport.jpg',
    );
    expect(await documentService.previewForFile('/tmp/lease.pdf', 'application/pdf')).toMatch(
      /pages_preview_.*page_1\.jpg$/,
    );
  });
});
