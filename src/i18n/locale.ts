import { en } from './en';
import type { DeviceLocale, Language, ResolvedLocale } from './types';

export const LANGUAGES: Readonly<Record<string, Language>> = {
  en: { table: en, direction: 'ltr' },
};

const RTL_LANGUAGES = new Set(['ar', 'arc', 'ckb', 'dv', 'fa', 'he', 'ku', 'ps', 'sd', 'ur', 'yi']);

export function isRTLLanguage(languageCode: string | null | undefined): boolean {
  if (!languageCode) return false;
  return RTL_LANGUAGES.has(languageCode.toLowerCase());
}

function regionOf(locale: DeviceLocale | undefined): string | null {
  if (!locale) return null;
  const region =
    locale.regionCode ??
    /^[a-z]{2,3}(?:-[A-Za-z]{4})?-([A-Z]{2}|\d{3})\b/i.exec(locale.languageTag)?.[1];
  return region ? region.toUpperCase() : null;
}

function englishTag(region: string | null): string {
  if (!region) return 'en';
  try {
    return Intl.getCanonicalLocales(`en-${region}`)[0] ?? 'en';
  } catch {
    return 'en';
  }
}

// Preserves device region on English fallback so date formats match the phone's region (e.g. en-DE).
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
