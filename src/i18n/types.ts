import type { Locale } from 'expo-localization';

import type { en } from './en';

export type StringKey = keyof typeof en;

export type StringTable = Partial<Record<StringKey, string>>;

export type PluralKey = {
  [K in StringKey]: K extends `${infer Base}.other` ? Base : never;
}[StringKey];

export type StringParams = Record<string, string | number>;

export type Language = { table: StringTable; direction: 'ltr' | 'rtl' };

export type ResolvedLocale = {
  language: string;
  tag: string;
  direction: 'ltr' | 'rtl';
  numberingSystem: string | null;
};

export type DeviceLocale = Pick<Locale, 'languageTag' | 'languageCode'> &
  Partial<Pick<Locale, 'regionCode'>>;

export type KeysUnder<Scope extends string> = StringKey extends infer K
  ? K extends `${Scope}.${infer Rest}`
    ? Rest
    : never
  : never;
