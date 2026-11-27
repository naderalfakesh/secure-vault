import type { Locale } from 'expo-localization';

import type { en } from './en';

/** Every key in the English source table. */
export type StringKey = keyof typeof en;

/** A table for another language: the same keys; a missing one falls back to English. */
export type StringTable = Partial<Record<StringKey, string>>;

/** Keys that come in plural forms, named without their `.one` / `.other` suffix. */
export type PluralKey = {
  [K in StringKey]: K extends `${infer Base}.other` ? Base : never;
}[StringKey];

export type StringParams = Record<string, string | number>;

export type Language = { table: StringTable; direction: 'ltr' | 'rtl' };

export type ResolvedLocale = {
  /** The table's language, e.g. "en". */
  language: string;
  /** BCP 47 tag for dates and plural rules, e.g. "en-GB". */
  tag: string;
  direction: 'ltr' | 'rtl';
  /** The numbering system the locale asks for, e.g. "arab" from "ar-EG-u-nu-arab". */
  numberingSystem: string | null;
};

export type DeviceLocale = Pick<Locale, 'languageTag' | 'languageCode'> &
  Partial<Pick<Locale, 'regionCode'>>;

/** The part of each key after `Scope.`, e.g. `KeysUnder<'scan'>` is `'page' | 'field.value' | …`. */
export type KeysUnder<Scope extends string> = StringKey extends infer K
  ? K extends `${Scope}.${infer Rest}`
    ? Rest
    : never
  : never;
