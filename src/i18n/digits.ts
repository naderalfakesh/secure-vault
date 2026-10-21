import { appLocale } from './index';

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EXTENDED_ARABIC_INDIC = '۰۱۲۳۴۵۶۷۸۹';

/**
 * A digit as the keypad shows it. PIN digits are Western Arabic numerals
 * unless the locale asks for another numbering system (e.g. "ar-EG-u-nu-arab").
 * Only the glyph changes: the key still enters the same digit.
 */
export function displayDigit(digit: string, numberingSystem = appLocale().numberingSystem): string {
  const value = Number(digit);
  if (!/^\d$/.test(digit)) return digit;
  if (numberingSystem === 'arab') return ARABIC_INDIC[value];
  if (numberingSystem === 'arabext') return EXTENDED_ARABIC_INDIC[value];
  return digit;
}
