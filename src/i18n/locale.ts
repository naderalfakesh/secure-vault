import { en } from './en';
import type { DeviceLocale, Language, ResolvedLocale } from './types';

/**
 * The languages that have a table. English is the source and the only one
 * today; a translated table is added here with its direction, and the layout
 * follows it (see `layoutDirection`). Strings are never machine translated.
 */
export const LANGUAGES: Readonly<Record<string, Language>> = {
  en: { table: en, direction: 'ltr' },
};

/** Languages written right to left, so the layout mirrors once a table for one lands. */
const RTL_LANGUAGES = new Set(['ar', 'arc', 'ckb', 'dv', 'fa', 'he', 'ku', 'ps', 'sd', 'ur', 'yi']);

export function isRTLLanguage(languageCode: string | null | undefined): boolean {
  if (!languageCode) return false;
  return RTL_LANGUAGES.has(languageCode.toLowerCase());
}

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
    const language = code ? LANGUAGES[code] : undefined;
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
