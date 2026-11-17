import type { DocumentSuggestion } from '@/features/intelligence';
import { DocumentCategory } from '@/types';

import { detailsReducer, initialDetails } from '../detailsReducer';

const suggestion = (overrides: Partial<DocumentSuggestion> = {}): DocumentSuggestion => ({
  tags: [],
  fields: [],
  engine: 'heuristic',
  ...overrides,
});

describe('detailsReducer', () => {
  it('resets to empty details with the suggested title', () => {
    const edited = { ...initialDetails('Old'), tags: 'a', titleMissing: true, ocrText: 'text' };
    expect(detailsReducer(edited, { type: 'reset', title: 'Scan' })).toEqual(
      initialDetails('Scan'),
    );
    expect(initialDetails().category).toBe(DocumentCategory.OTHER);
  });

  it('keeps the read text', () => {
    const state = detailsReducer(initialDetails(), { type: 'read', ocrText: 'Passport' });
    expect(state.ocrText).toBe('Passport');
  });

  it('applies what the suggestion found and keeps the rest', () => {
    const start = { ...initialDetails('photo'), tags: 'mine' };
    const found = detailsReducer(start, {
      type: 'suggest',
      suggestion: suggestion({
        title: 'Passport',
        category: DocumentCategory.ID,
        tags: ['travel', 'id'],
        fields: [{ key: 'expiry', value: '2030-01-01', kind: 'date' }],
      }),
    });
    expect(found).toMatchObject({
      title: 'Passport',
      category: DocumentCategory.ID,
      categorySuggested: true,
      tags: 'travel, id',
    });
    expect(found.fields).toHaveLength(1);

    const nothing = detailsReducer(start, { type: 'suggest', suggestion: suggestion() });
    expect(nothing).toEqual({ ...start, fields: [] });
  });

  it('clears the missing-title error only once a title is typed', () => {
    const missing = detailsReducer(initialDetails(), { type: 'titleMissing' });
    expect(missing.titleMissing).toBe(true);
    expect(detailsReducer(missing, { type: 'title', title: '  ' }).titleMissing).toBe(true);
    const typed = detailsReducer(missing, { type: 'title', title: 'Visa' });
    expect(typed).toMatchObject({ title: 'Visa', titleMissing: false });
  });

  it('changes the collection without marking it suggested', () => {
    const state = detailsReducer(initialDetails(), {
      type: 'category',
      category: DocumentCategory.MEDICAL,
    });
    expect(state).toMatchObject({ category: DocumentCategory.MEDICAL, categorySuggested: false });
  });

  it('sets tags and removes a found value by key', () => {
    const start = {
      ...initialDetails(),
      fields: [
        { key: 'a', value: '1', kind: 'text' as const },
        { key: 'b', value: '2', kind: 'text' as const },
      ],
    };
    expect(detailsReducer(start, { type: 'tags', tags: 'x, y' }).tags).toBe('x, y');
    const removed = detailsReducer(start, { type: 'removeField', key: 'a' });
    expect(removed.fields.map((field) => field.key)).toEqual(['b']);
  });
});
