import { DocumentCategory } from '@/types';

import {
  extractFields,
  findDates,
  heuristicIntelligence,
  suggestCategory,
  suggestTitle,
} from './heuristic';

const passport = `REPUBLIC OF EXAMPLE
PASSPORT
Passport No: X1234567
Surname: DOE
Date of issue: 12 MAR 2020
Date of expiry: 12 MAR 2030`;

describe('heuristic intelligence', () => {
  it('finds dates in the common layouts and keeps them in order', () => {
    expect(
      findDates('Issued 2026-09-07, expires 07/09/2036, printed Sep 7, 2026').map((d) => d.date),
    ).toEqual(['2026-09-07', '2036-09-07', '2026-09-07']);
    expect(findDates('valid until 31 Feb 2030')).toEqual([]);
  });

  it('classifies by the strongest keyword signal', () => {
    expect(suggestCategory(passport)).toBe(DocumentCategory.ID);
    expect(suggestCategory('Invoice 42, total due, IBAN DE00')).toBe(DocumentCategory.FINANCE);
    expect(suggestCategory('Lease agreement between landlord and tenant')).toBe(
      DocumentCategory.LEGAL,
    );
    expect(suggestCategory('lorem ipsum')).toBeUndefined();
  });

  it('extracts expiry, issue, and document number', () => {
    expect(extractFields(passport)).toEqual([
      { key: 'expires', value: '2030-03-12', kind: 'date' },
      { key: 'issued', value: '2020-03-12', kind: 'date' },
      { key: 'number', value: 'X1234567', kind: 'text' },
    ]);
  });

  it('does not take the next label for a number when a card is read column by column', () => {
    const card =
      'Example Mutual\nMotor insurance certificate\nPolicy number\nPolicyholder\nVehicle\n' +
      'EXM-2026-004217\nAlex Sample\nValid 1 Jan 2026 to 31 Dec 2026';
    expect(extractFields(card).find((f) => f.key === 'number')).toBeUndefined();
    expect(extractFields('Policy number: EXM-2026-004217').find((f) => f.key === 'number')).toEqual(
      { key: 'number', value: 'EXM-2026-004217', kind: 'text' },
    );
  });

  it('falls back to the latest future date when no expiry keyword exists', () => {
    const fields = extractFields('Printed 2020-01-01. Renewal due 2031-06-30. Ref 2029-12-31.');
    expect(fields.find((f) => f.key === 'expires')?.value).toBe('2031-06-30');
  });

  it('suggests a short title from the first readable line', () => {
    expect(suggestTitle(passport)).toBe('Republic Of Example');
    expect(suggestTitle('Blue Cross member card')).toBe('Blue Cross member card');
    expect(suggestTitle('12345\n\n')).toBeUndefined();
  });

  it('returns an empty suggestion for empty text', async () => {
    expect(await heuristicIntelligence.suggest('   ')).toEqual({
      tags: [],
      fields: [],
      engine: 'heuristic',
    });
    const full = await heuristicIntelligence.suggest(passport);
    expect(full.category).toBe(DocumentCategory.ID);
    expect(full.tags).toEqual([DocumentCategory.ID, '2020']);
  });
});
