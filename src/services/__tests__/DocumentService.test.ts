import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';

import { closeDocumentStore, openDocumentStore } from '@/data/database';

import vault from '../../../modules/expo-vault';
import { DocumentCategory } from '../../types';
import { documentService, PICKER_DIRECTORY, shareFileName } from '../DocumentService';

const vaultMock = vault as unknown as { reset(): void };

const picked = { uri: '/tmp/passport.jpg', name: 'passport.jpg', type: 'image/jpeg', size: 2048 };

describe('DocumentService', () => {
  beforeEach(async () => {
    vaultMock.reset();
    // The next call opens a fresh, empty in-memory index.
    await closeDocumentStore();
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

  it("removes the vault module's thumbnail scratch file at lock and launch", async () => {
    const scratch = new File(Paths.cache, 'thumb_encrypt_0D2C');
    scratch.writeSync('jpeg');

    await documentService.clearCache();

    expect(scratch.exists).toBe(false);
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
