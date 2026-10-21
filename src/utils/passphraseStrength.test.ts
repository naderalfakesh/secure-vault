import { estimatePassphraseStrength } from './passphraseStrength';

describe('estimatePassphraseStrength', () => {
  it('rates empty, short, and repeated input as nothing or weak', () => {
    expect(estimatePassphraseStrength('')).toBe(0);
    expect(estimatePassphraseStrength('abc12')).toBe(1);
    expect(estimatePassphraseStrength('aaaaaaaaaaaa')).toBe(1);
    expect(estimatePassphraseStrength('password')).toBe(1);
  });

  it('rewards length and variety', () => {
    expect(estimatePassphraseStrength('sunlight42')).toBe(2);
    expect(estimatePassphraseStrength('Tr0ub4dor&3')).toBe(3);
    expect(estimatePassphraseStrength('correct horse battery staple')).toBe(4);
  });

  it('counts any script', () => {
    expect(estimatePassphraseStrength('قمر فوق جبل الشيخ ٢٠٢٦')).toBe(4);
  });
});
