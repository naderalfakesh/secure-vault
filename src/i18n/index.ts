import { getLocales, type Locale } from 'expo-localization';

import { en } from './en';
import { LANGUAGES, resolveLocale } from './locale';
import type {
  DeviceLocale,
  KeysUnder,
  PluralKey,
  ResolvedLocale,
  StringKey,
  StringParams,
  StringTable,
} from './types';

export { isRTLLanguage, resolveLocale } from './locale';
export type {
  KeysUnder,
  PluralKey,
  ResolvedLocale,
  StringKey,
  StringParams,
  StringTable,
} from './types';

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
  return LANGUAGES[current.language]?.table[key] ?? en[key];
}

/** The string for `key`, with `{name}` placeholders filled from `params`. */
export function t(key: StringKey, params?: StringParams): string {
  return interpolate(lookup(key), params);
}

/** A lookup for one namespace of the table, taking the keys without their prefix. */
export function scopedText<Scope extends string>(scope: Scope) {
  return (key: KeysUnder<Scope>, params?: StringParams): string =>
    // TypeScript cannot prove that `${Scope}.${Rest}` is again a key; KeysUnder only ever yields suffixes of real keys.
    t(`${scope}.${key}` as StringKey, params);
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
  const table = LANGUAGES[current.language]?.table ?? en;
  const form = `${key}.${pluralCategory(count)}` as StringKey;
  const other = `${key}.other` as StringKey;
  const template = table[form] ?? table[other] ?? (en as StringTable)[form] ?? en[other];
  return interpolate(template, { count, ...params });
}
