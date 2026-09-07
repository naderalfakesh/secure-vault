import vault from '../../../modules/expo-vault';
import { DocumentCategory } from '../../types';
import { documentService } from '../DocumentService';

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
});
