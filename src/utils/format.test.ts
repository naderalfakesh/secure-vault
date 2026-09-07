import { formatDate, formatFileSize, pluralize } from './format';

describe('format', () => {
  it('formats sizes in the unit a person expects', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(2.7 * 1024 * 1024)).toBe('2.7 MB');
    expect(formatFileSize(-1)).toBe('');
  });

  it('pluralizes counts', () => {
    expect(pluralize(1, 'document')).toBe('1 document');
    expect(pluralize(0, 'document')).toBe('0 documents');
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatDate('not-a-date')).toBe('');
    expect(formatDate('2026-09-07T00:00:00.000Z', 'en-US')).toMatch(/Sep \d+, 2026/);
  });
});
