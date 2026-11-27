import { DocumentCategory, type Document } from '@/types';

import { applyDocumentChanges, buildDocumentUpdate } from '../rows';

const baseDocument: Document = {
  id: 'doc-1',
  title: 'Passport',
  category: DocumentCategory.ID,
  tags: ['travel'],
  ocrText: 'REPUBLIC OF EXAMPLE',
  thumbnailKey: 'thumb_1',
  fileKey: 'file_1',
  fileType: 'image',
  fileSize: 1024,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('document update row builders', () => {
  it('builds a parameterized UPDATE containing only defined columns', () => {
    expect(
      buildDocumentUpdate('doc-1', { title: 'New Passport' }, '2026-02-01T00:00:00.000Z'),
    ).toEqual({
      sql: 'UPDATE documents SET title = ?, updated_at = ? WHERE id = ?',
      params: ['New Passport', '2026-02-01T00:00:00.000Z', 'doc-1'],
    });

    expect(buildDocumentUpdate('doc-1', { tags: ['id'] }, '2026-02-01T00:00:00.000Z')).toEqual({
      sql: 'UPDATE documents SET updated_at = ? WHERE id = ?',
      params: ['2026-02-01T00:00:00.000Z', 'doc-1'],
    });
  });

  it('merges only defined fields onto an existing document without clearing omitted ones', () => {
    const updated = applyDocumentChanges(
      baseDocument,
      { title: 'Renewed Passport', ocrText: undefined },
      '2026-02-01T00:00:00.000Z',
    );
    expect(updated.title).toBe('Renewed Passport');
    expect(updated.ocrText).toBe('REPUBLIC OF EXAMPLE');
    expect(updated.updatedAt).toBe('2026-02-01T00:00:00.000Z');
  });
});
