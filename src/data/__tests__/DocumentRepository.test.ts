import { DocumentCategory, type DocumentMetadata } from '../../types';
import { DocumentRepository, toFtsQuery } from '../DocumentRepository';
import { migrateLegacyIndex } from '../migrateLegacyIndex';
import { applyMigrations, SCHEMA_VERSION } from '../schema';
import type { SqlDatabase } from '../sql';
import { openTestDatabase } from '../testing/betterSqlite';

function doc(id: string, overrides: Partial<Parameters<DocumentRepository['insert']>[0]> = {}) {
  return {
    id,
    title: `Document ${id}`,
    category: DocumentCategory.OTHER,
    tags: [],
    thumbnailKey: `thumb_${id}`,
    fileKey: `file_${id}`,
    fileType: 'image' as const,
    fileSize: 1000,
    createdAt: `2026-09-0${id}T10:00:00.000Z`,
    ...overrides,
  };
}

describe('DocumentRepository', () => {
  let db: SqlDatabase;
  let repo: DocumentRepository;

  beforeEach(async () => {
    db = openTestDatabase();
    await applyMigrations(db);
    repo = new DocumentRepository(db);
  });

  afterEach(async () => {
    await db.close();
  });

  it('applies migrations once and records the schema version', async () => {
    expect(await applyMigrations(db)).toBe(SCHEMA_VERSION);
    const row = await db.first<{ user_version: number }>('PRAGMA user_version');
    expect(row?.user_version).toBe(SCHEMA_VERSION);
  });

  it('round-trips a document with tags and text', async () => {
    await repo.insert(
      doc('1', {
        title: 'Passport',
        category: DocumentCategory.ID,
        tags: ['travel', 'id, with comma'],
        ocrText: 'Republic of Example',
      }),
    );

    const saved = await repo.get('1');
    expect(saved).toMatchObject({
      title: 'Passport',
      tags: ['travel', 'id, with comma'],
      ocrText: 'Republic of Example',
    });
    expect(await repo.count()).toBe(1);
    expect(await repo.countByCategory()).toEqual({ [DocumentCategory.ID]: 1 });
  });

  it('lists newest first, filters by category, and orders recent by update time', async () => {
    await repo.insert(doc('1', { category: DocumentCategory.LEGAL }));
    await repo.insert(doc('2', { category: DocumentCategory.MEDICAL }));
    await repo.insert(doc('3', { category: DocumentCategory.LEGAL }));

    expect((await repo.list()).map((d) => d.id)).toEqual(['3', '2', '1']);
    expect((await repo.list(DocumentCategory.LEGAL)).map((d) => d.id)).toEqual(['3', '1']);

    await repo.update('1', { title: 'Renamed lease' });
    expect((await repo.recent(2)).map((d) => d.id)).toEqual(['1', '3']);
  });

  it('searches titles, tags, and extracted text with prefix matching and diacritics folded', async () => {
    await repo.insert(
      doc('1', {
        title: 'Lease agreement',
        tags: ['home'],
        ocrText: 'Tenant agrees to pay rent monthly',
      }),
    );
    await repo.insert(doc('2', { title: 'Résumé', tags: ['work'] }));
    await repo.insert(doc('3', { title: 'Receipt' }));

    expect((await repo.search('rent')).map((d) => d.id)).toEqual(['1']);
    expect((await repo.search('hom')).map((d) => d.id)).toEqual(['1']);
    expect((await repo.search('resume')).map((d) => d.id)).toEqual(['2']);
    expect((await repo.search('lease agree')).map((d) => d.id)).toEqual(['1']);
    expect(await repo.search('nothing here')).toEqual([]);
    expect((await repo.search('   ')).length).toBe(3);
  });

  it('keeps the search index in sync with updates and deletes', async () => {
    await repo.insert(doc('1', { title: 'Old title' }));
    await repo.update('1', { title: 'Insurance card', tags: ['car'] });
    expect((await repo.search('old')).length).toBe(0);
    expect((await repo.search('car')).map((d) => d.id)).toEqual(['1']);

    expect(await repo.remove('1')).toBe(true);
    expect(await repo.remove('1')).toBe(false);
    expect(await repo.search('insurance')).toEqual([]);
    expect(await db.first('SELECT * FROM tags')).toBeNull();
  });

  it('stores extracted fields and finds expiring documents', async () => {
    await repo.insert(doc('1', { title: 'Passport' }));
    await repo.insert(doc('2', { title: 'Visa' }));
    await repo.setFields('1', [
      { key: 'expires', value: '2026-12-01', kind: 'date' },
      { key: 'number', value: 'X123', kind: 'text' },
    ]);
    await repo.setFields('2', [{ key: 'expires', value: '2027-06-01', kind: 'date' }]);

    expect(await repo.getFields('1')).toEqual([
      { key: 'expires', value: '2026-12-01', kind: 'date' },
      { key: 'number', value: 'X123', kind: 'text' },
    ]);
    const soon = await repo.expiring('expires', '2026-12-31');
    expect(soon.map((row) => [row.document.id, row.date])).toEqual([['1', '2026-12-01']]);
  });

  describe('search snippets (FTS5 snippet())', () => {
    it('marks the matched words in the page text with context either side', async () => {
      await repo.insert(
        doc('1', {
          title: 'Lease agreement',
          ocrText:
            'This agreement is made between the landlord and the tenant. The lease term begins on 1 March 2026 and runs for one year from that date onwards.',
        }),
      );

      const [hit] = await repo.searchWithSnippets('marc');

      expect(hit?.document.id).toBe('1');
      const parts = hit?.snippet ?? [];
      expect(parts.filter((part) => part.match).map((part) => part.text)).toEqual(['March']);
      const text = parts.map((part) => part.text).join('');
      expect(text).toContain('begins on 1 March 2026');
      // Long text is cut to a window with an ellipsis, never sent whole.
      expect(text.startsWith('…') || text.endsWith('…')).toBe(true);
      expect(text).not.toMatch(/[\u0002\u0003]/);
    });

    it('starts and ends the window on whole words when a word was split into tokens', async () => {
      await repo.insert(
        doc('1', {
          title: 'Passport',
          ocrText:
            'ONE TWO THREE FOUR FIVE SIX SEVEN EIGHT ELECTRON-IC DOCUMENT PASSPORT NUMBER X1234567 NATIONALITY EXAMPLIAN DATE OF BIRTH 01 JAN-UARY 1990 SEX F',
        }),
      );

      const [hit] = await repo.searchWithSnippets('nationality');
      const text = (hit?.snippet ?? []).map((part) => part.text).join('');

      expect(text).toBe(
        '…DOCUMENT PASSPORT NUMBER X1234567 NATIONALITY EXAMPLIAN DATE OF BIRTH 01…',
      );
    });

    it('marks every query word and folds diacritics like the search does', async () => {
      await repo.insert(doc('1', { title: 'Visa', ocrText: 'Entrée permise jusqu’au 3 janvier' }));

      const [hit] = await repo.searchWithSnippets('entree janv');

      expect(hit?.snippet?.filter((part) => part.match).map((part) => part.text)).toEqual([
        'Entrée',
        'janvier',
      ]);
    });

    it('gives no snippet when only the title or tags match', async () => {
      await repo.insert(
        doc('1', { title: 'Passport', tags: ['travel'], ocrText: 'Republic of Example' }),
      );
      await repo.insert(doc('2', { title: 'Travel insurance' }));

      const hits = await repo.searchWithSnippets('travel');

      expect(hits.map((hit) => [hit.document.id, hit.snippet])).toEqual([
        ['2', null],
        ['1', null],
      ]);
      expect((await repo.searchWithSnippets('passport'))[0]?.snippet).toBeNull();
    });

    it('returns full documents with their tags and nothing for an empty query', async () => {
      await repo.insert(doc('1', { title: 'Lease', tags: ['home', 'rent'], ocrText: 'rent' }));

      const [hit] = await repo.searchWithSnippets('rent');

      expect(hit?.document).toMatchObject({ id: '1', title: 'Lease', tags: ['home', 'rent'] });
      expect(await repo.searchWithSnippets('  ')).toEqual([]);
      expect(await repo.searchWithSnippets('"*')).toEqual([]);
    });
  });

  describe('ordering', () => {
    beforeEach(async () => {
      await repo.insert(doc('1', { title: 'Passport', ocrText: 'card' }));
      await repo.insert(doc('2', { title: 'Visa', ocrText: 'card' }));
      await repo.insert(doc('3', { title: 'Lease', ocrText: 'card' }));
      await repo.insert(doc('4', { title: 'Receipt', ocrText: 'card' }));
      await repo.setFields('1', [{ key: 'expires', value: '2027-01-03', kind: 'date' }]);
      await repo.setFields('2', [
        { key: 'expires', value: '2026-11-30', kind: 'date' },
        { key: 'issued', value: '2020-01-01', kind: 'date' },
      ]);
      // Not an expiry date: a number field and another date key are ignored.
      await repo.setFields('3', [
        { key: 'number', value: '0001', kind: 'text' },
        { key: 'issued', value: '2001-01-01', kind: 'date' },
      ]);
    });

    it('sorts by the expiry date in the fields table, undated documents last and newest first', async () => {
      expect((await repo.list(null, 'expiry')).map((d) => d.id)).toEqual(['2', '1', '4', '3']);
      expect(
        (await repo.searchWithSnippets('card', 'expiry')).map((hit) => hit.document.id),
      ).toEqual(['2', '1', '4', '3']);
    });

    it('sorts newest and oldest added', async () => {
      expect((await repo.list(null, 'newest')).map((d) => d.id)).toEqual(['4', '3', '2', '1']);
      expect((await repo.list(null, 'oldest')).map((d) => d.id)).toEqual(['1', '2', '3', '4']);
      expect(
        (await repo.searchWithSnippets('card', 'oldest')).map((hit) => hit.document.id),
      ).toEqual(['1', '2', '3', '4']);
    });

    it('keeps one row per document when sorting by expiry', async () => {
      expect(await repo.list(null, 'expiry')).toHaveLength(4);
      expect((await repo.list(null, 'expiry'))[0]).toMatchObject({ id: '2', title: 'Visa' });
    });
  });

  it('neutralises FTS syntax in user input', () => {
    expect(toFtsQuery('pass 20')).toBe('"pass"* AND "20"*');
    expect(toFtsQuery('"OR" * drop')).toBe('"OR"* AND "drop"*');
    expect(toFtsQuery('   ')).toBe('');
  });
});

describe('migrateLegacyIndex', () => {
  it('imports the prototype JSON index once and skips rows that already exist', async () => {
    const db = openTestDatabase();
    await applyMigrations(db);
    const repo = new DocumentRepository(db);
    const legacy: DocumentMetadata = {
      version: 1,
      documents: {
        a: {
          id: 'a',
          title: 'Old passport',
          category: DocumentCategory.ID,
          tags: ['travel'],
          ocrText: 'Passport text',
          thumbnailKey: 'thumb_a',
          fileKey: 'file_a',
          fileType: 'image',
          fileSize: 12,
          createdAt: '2025-12-28T00:00:00.000Z',
          updatedAt: '2025-12-28T00:00:00.000Z',
        },
      },
    };

    expect(await migrateLegacyIndex(legacy, repo)).toBe(1);
    expect(await migrateLegacyIndex(legacy, repo)).toBe(0);
    expect(await migrateLegacyIndex(null, repo)).toBe(0);
    expect((await repo.search('passport')).map((d) => d.id)).toEqual(['a']);
    await db.close();
  });
});

describe('pages', () => {
  it('stores extra pages in order and drops them with the document', async () => {
    const db = openTestDatabase();
    await applyMigrations(db);
    const repo = new DocumentRepository(db);
    await repo.insert(doc('1'));
    await repo.setPages('1', ['page_1_1', 'page_1_2']);
    expect(await repo.getPages('1')).toEqual(['page_1_1', 'page_1_2']);
    await repo.remove('1');
    expect(await db.first('SELECT * FROM pages')).toBeNull();
    await db.close();
  });
});
