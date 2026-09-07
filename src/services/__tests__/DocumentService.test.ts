import vault from '../../../modules/expo-vault';
import { DocumentCategory } from '../../types';
import { documentService, shareFileName } from '../DocumentService';

const vaultMock = vault as unknown as { reset(): void };

const picked = { uri: '/tmp/passport.jpg', name: 'passport.jpg', type: 'image/jpeg', size: 2048 };

describe('DocumentService', () => {
  beforeEach(async () => {
    vaultMock.reset();
    // reload closes the in-memory index and opens a fresh, empty one.
    await documentService.reload();
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

  it('previews photos as they are and pdfs through their rendered first page', async () => {
    expect(await documentService.previewForFile('/tmp/passport.jpg', 'image/jpeg')).toBe(
      '/tmp/passport.jpg',
    );
    expect(await documentService.previewForFile('/tmp/lease.pdf', 'application/pdf')).toMatch(
      /pages_preview_.*page_1\.jpg$/,
    );
  });
});
