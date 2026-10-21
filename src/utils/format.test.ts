import { tp } from '@/i18n';

import { formatDate, formatExpiry, formatFileSize, formatRelativeDate, joinParts } from './format';

describe('format', () => {
  it('formats sizes in the unit a person expects', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(2.7 * 1024 * 1024)).toBe('2.7 MB');
    expect(formatFileSize(-1)).toBe('');
  });

  it('pluralizes counts', () => {
    expect(tp('format.documents', 1)).toBe('1 document');
    expect(tp('format.documents', 0)).toBe('0 documents');
    expect(tp('format.entries', 2)).toBe('2 entries');
  });

  it('joins the parts of a meta line and drops empty ones', () => {
    expect(joinParts(['Identity', null, '2 pages', false, 'Today'])).toBe(
      'Identity · 2 pages · Today',
    );
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatDate('not-a-date')).toBe('');
    expect(formatDate('2026-09-07T00:00:00.000Z', 'en-US')).toMatch(/Sep \d+, 2026/);
  });
});

describe('relative dates', () => {
  const now = new Date(2026, 9, 21, 15, 0);

  it('names recent days and shortens older ones', () => {
    expect(formatRelativeDate(new Date(2026, 9, 21, 8).toISOString(), now)).toBe('Today');
    expect(formatRelativeDate(new Date(2026, 9, 20, 23).toISOString(), now)).toBe('Yesterday');
    expect(formatRelativeDate(new Date(2026, 9, 17).toISOString(), now, 'en-GB')).toBe('Sat');
    expect(formatRelativeDate(new Date(2026, 9, 9).toISOString(), now, 'en-GB')).toBe('9 Oct');
    expect(formatRelativeDate(new Date(2025, 8, 28).toISOString(), now, 'en-GB')).toBe(
      '28 Sept 2025',
    );
    expect(formatRelativeDate('nope', now)).toBe('');
  });

  it('words an expiry date', () => {
    expect(formatExpiry('2027-01-11', now)).toBe('Expires in 82 days');
    expect(formatExpiry('2026-10-21', now)).toBe('Expires today');
    expect(formatExpiry('2027-06-03', now, 'en-GB')).toBe('Expires 3 Jun 2027');
    expect(formatExpiry('2026-01-03', now, 'en-GB')).toBe('Expired 3 Jan 2026');
  });
});
