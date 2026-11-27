import { appLocale } from './index';

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EXTENDED_ARABIC_INDIC = '۰۱۲۳۴۵۶۷۸۹';

// Visual glyph mapping only; underlying PIN input remains ASCII digits.
export function displayDigit(digit: string, numberingSystem = appLocale().numberingSystem): string {
  const value = Number(digit);
  if (!/^\d$/.test(digit)) return digit;
  if (numberingSystem === 'arab') return ARABIC_INDIC[value] ?? digit;
  if (numberingSystem === 'arabext') return EXTENDED_ARABIC_INDIC[value] ?? digit;
  return digit;
}
