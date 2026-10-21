import { getLocales, type Locale } from 'expo-localization';

import { en } from './en';

/** Every key in the English source table. */
export type StringKey = keyof typeof en;

/** A table for another language: the same keys; a missing one falls back to English. */
export type StringTable = Partial<Record<StringKey, string>>;

/** Keys that come in plural forms, named without their `.one` / `.other` suffix. */
export type PluralKey = {
  [K in StringKey]: K extends `${infer Base}.other` ? Base : never;
}[StringKey];

export type StringParams = Record<string, string | number>;

type Language = { table: StringTable; direction: 'ltr' | 'rtl' };

/**
 * The languages that have a table. English is the source and the only one
 * today; a translated table is added here with its direction, and the layout
 * follows it (see `layoutDirection`). Strings are never machine translated.
 */
const languages: Record<string, Language> = {
  en: { table: en, direction: 'ltr' },
};

/** Languages written right to left, so the layout mirrors once a table for one lands. */
const RTL_LANGUAGES = new Set(['ar', 'arc', 'ckb', 'dv', 'fa', 'he', 'ku', 'ps', 'sd', 'ur', 'yi']);

export function isRTLLanguage(languageCode: string | null | undefined): boolean {
  return Boolean(languageCode) && RTL_LANGUAGES.has(languageCode!.toLowerCase());
}

export type ResolvedLocale = {
  /** The table's language, e.g. "en". */
  language: string;
  /** BCP 47 tag for dates and plural rules, e.g. "en-GB". */
  tag: string;
  direction: 'ltr' | 'rtl';
  /** The numbering system the locale asks for, e.g. "arab" from "ar-EG-u-nu-arab". */
  numberingSystem: string | null;
};

type DeviceLocale = Pick<Locale, 'languageTag' | 'languageCode'> &
  Partial<Pick<Locale, 'regionCode'>>;

/** The region of a device locale: its own field, else the tag's ("de-DE" → "DE"). */
function regionOf(locale: DeviceLocale | undefined): string | null {
  if (!locale) return null;
  const region =
    locale.regionCode ??
    /^[a-z]{2,3}(?:-[A-Za-z]{4})?-([A-Z]{2}|\d{3})\b/i.exec(locale.languageTag)?.[1];
  return region ? region.toUpperCase() : null;
}

/** "en-DE" for English with the phone's German region, or plain "en". */
function englishTag(region: string | null): string {
  if (!region) return 'en';
  try {
    return Intl.getCanonicalLocales(`en-${region}`)[0] ?? 'en';
  } catch {
    return 'en';
  }
}

/**
 * The first of the phone's preferred languages that has a table, else
 * English. The tag keeps the phone's region either way, so dates follow the
 * user's region: "9 Oct" in en-GB, "Oct 9" in en-US, and "9 Oct 2026" in
 * en-DE on a German phone, which has no German table yet.
 */
export function resolveLocale(locales: readonly DeviceLocale[]): ResolvedLocale {
  for (const locale of locales) {
    const code = locale.languageCode?.toLowerCase();
    const language = code ? languages[code] : undefined;
    if (code && language) {
      return {
        language: code,
        tag: locale.languageTag || code,
        direction: language.direction,
        numberingSystem: /-u(?:-[a-z0-9]+)*-nu-([a-z0-9]+)/i.exec(locale.languageTag)?.[1] ?? null,
      };
    }
  }
  return {
    language: 'en',
    tag: englishTag(regionOf(locales[0])),
    direction: 'ltr',
    numberingSystem: null,
  };
}

function deviceLocales(): Locale[] {
  try {
    return getLocales();
  } catch {
    return [];
  }
}

let current: ResolvedLocale = resolveLocale(deviceLocales());

/** The locale the app speaks right now. */
export function appLocale(): ResolvedLocale {
  return current;
}

/** Tests only: speak as if the phone preferred these locales. */
export function setAppLocaleForTesting(locales: readonly DeviceLocale[]): void {
  current = resolveLocale(locales);
}

function interpolate(template: string, params?: StringParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

function lookup(key: StringKey): string {
  return languages[current.language]?.table[key] ?? en[key];
}

/** The string for `key`, with `{name}` placeholders filled from `params`. */
export function t(key: StringKey, params?: StringParams): string {
  return interpolate(lookup(key), params);
}

let pluralRules: { tag: string; rules: Intl.PluralRules | null } | null = null;

function pluralCategory(count: number): string {
  if (pluralRules?.tag !== current.tag) {
    let rules: Intl.PluralRules | null = null;
    try {
      rules = new Intl.PluralRules(current.tag);
    } catch {
      rules = null;
    }
    pluralRules = { tag: current.tag, rules };
  }
  if (pluralRules.rules) return pluralRules.rules.select(count);
  return count === 1 ? 'one' : 'other';
}

/**
 * The plural form of `key` for `count` ("{count} pages", "1 page"). The
 * locale's plural rules pick the form, so Arabic's six forms work once its
 * table has them; a form a table lacks falls back to `.other`.
 */
export function tp(key: PluralKey, count: number, params?: StringParams): string {
  const table = languages[current.language]?.table ?? en;
  const form = `${key}.${pluralCategory(count)}` as StringKey;
  const other = `${key}.other` as StringKey;
  const template = table[form] ?? table[other] ?? (en as StringTable)[form] ?? en[other];
  return interpolate(template, { count, ...params });
}
