import { I18nManager } from 'react-native';

import { applyLayoutDirection, wantsRTL } from '../direction';
import { displayDigit } from '../digits';
import { en, namespaces } from '../en';
import { appLocale, isRTLLanguage, resolveLocale, setAppLocaleForTesting, t, tp } from '../index';

const english = [{ languageTag: 'en-US', languageCode: 'en' }];

afterEach(() => setAppLocaleForTesting(english));

describe('string table', () => {
  it('keeps every namespace key unique, so no spread hides another', () => {
    const total = Object.values(namespaces).reduce(
      (sum, table) => sum + Object.keys(table).length,
      0,
    );
    expect(Object.keys(en)).toHaveLength(total);
  });

  it('keys each string by its namespace', () => {
    for (const [name, table] of Object.entries(namespaces)) {
      for (const key of Object.keys(table)) expect(key.startsWith(`${name}.`)).toBe(true);
    }
  });

  it('has no empty strings and pairs every plural form with an .other', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim()).not.toBe('');
      const plural = /^(.*)\.(zero|one|two|few|many)$/.exec(key);
      if (plural) expect(en).toHaveProperty([`${plural[1]}.other`]);
    }
  });
});

describe('t and tp', () => {
  it('fills placeholders and leaves unknown ones', () => {
    expect(t('common.cancel')).toBe('Cancel');
    expect(t('format.expired', { date: '3 Jan 2026' })).toBe('Expired 3 Jan 2026');
    expect(t('format.expired')).toBe('Expired {date}');
  });

  it('picks the plural form from the locale rules', () => {
    expect(tp('format.pages', 1)).toBe('1 page');
    expect(tp('format.pages', 2)).toBe('2 pages');
    expect(tp('format.pages', 0)).toBe('0 pages');
  });
});

describe('locale', () => {
  it('falls back to English when no table matches, keeping the layout left to right', () => {
    const locale = resolveLocale([{ languageTag: 'ar-SA', languageCode: 'ar' }]);
    expect(locale).toMatchObject({ language: 'en', direction: 'ltr' });
  });

  it('keeps the phone region for an English locale', () => {
    expect(resolveLocale([{ languageTag: 'en-GB', languageCode: 'en' }]).tag).toBe('en-GB');
  });

  it('reads a requested numbering system', () => {
    setAppLocaleForTesting([{ languageTag: 'en-u-nu-arab', languageCode: 'en' }]);
    expect(appLocale().numberingSystem).toBe('arab');
  });

  it('knows which languages run right to left', () => {
    expect(isRTLLanguage('ar')).toBe(true);
    expect(isRTLLanguage('he')).toBe(true);
    expect(isRTLLanguage('en')).toBe(false);
    expect(isRTLLanguage(null)).toBe(false);
  });
});

describe('PIN digits', () => {
  it('stay Western Arabic numerals by default', () => {
    expect(displayDigit('7', null)).toBe('7');
  });

  it('follow a locale that asks for Arabic-Indic digits', () => {
    expect(displayDigit('7', 'arab')).toBe('٧');
    expect(displayDigit('0', 'arabext')).toBe('۰');
  });
});

describe('layout direction', () => {
  it('stays left to right while English is the only table', () => {
    setAppLocaleForTesting([{ languageTag: 'ar-EG', languageCode: 'ar' }]);
    expect(wantsRTL()).toBe(false);
  });

  it('asks React Native to mirror only when the direction changes', () => {
    const allow = jest.spyOn(I18nManager, 'allowRTL');
    const force = jest.spyOn(I18nManager, 'forceRTL');
    applyLayoutDirection();
    expect(allow).not.toHaveBeenCalled();
    expect(force).not.toHaveBeenCalled();
  });

  it('mirrors in a development RTL preview', () => {
    process.env.EXPO_PUBLIC_RTL_PREVIEW = '1';
    try {
      const allow = jest.spyOn(I18nManager, 'allowRTL').mockImplementation(() => {});
      const force = jest.spyOn(I18nManager, 'forceRTL').mockImplementation(() => {});
      applyLayoutDirection();
      expect(allow).toHaveBeenCalledWith(true);
      expect(force).toHaveBeenCalledWith(true);
    } finally {
      delete process.env.EXPO_PUBLIC_RTL_PREVIEW;
    }
  });
});
