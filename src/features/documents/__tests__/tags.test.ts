import { formatTags, parseTags } from '../tags';

describe('parseTags', () => {
  it('splits on commas, trims and drops blanks', () => {
    expect(parseTags(' a ,, b ,')).toEqual(['a', 'b']);
    expect(parseTags(' travel, ,id ,  ')).toEqual(['travel', 'id']);
    expect(parseTags('')).toEqual([]);
  });
});

describe('formatTags', () => {
  it('round-trips through the comma-separated field', () => {
    expect(formatTags(['travel', 'family'])).toBe('travel, family');
    expect(parseTags(formatTags(['travel', 'family']))).toEqual(['travel', 'family']);
    expect(formatTags([])).toBe('');
  });
});
