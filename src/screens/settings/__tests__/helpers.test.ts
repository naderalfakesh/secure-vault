import { TAB_BAR_BOTTOM, TAB_BAR_HEIGHT } from '@/components/ui';
import type { ModelInfo } from '@/features/intelligence';
import { t } from '@/i18n';

import { SCROLL_BOTTOM_GAP } from '../constants';
import {
  eraseSubject,
  eraseSubtitleKey,
  modelName,
  scrollBottomSpace,
  suggestionsSubtitle,
  totalCount,
  versionLabel,
} from '../helpers';

const nano = (status: ModelInfo['status']): ModelInfo => ({ engine: 'gemini-nano', status });

describe('settings helpers', () => {
  it('leaves room for the floating tab bar under the content', () => {
    expect(scrollBottomSpace(34)).toBe(TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + 34 + SCROLL_BOTTOM_GAP);
  });

  it('adds the build number only when the binary has one', () => {
    expect(versionLabel('1.2.0', '12')).toBe('1.2.0 (12)');
    expect(versionLabel('1.2.0', undefined)).toBe('1.2.0');
    expect(versionLabel('1.2.0', '')).toBe('1.2.0');
  });

  it('names what the erase removes', () => {
    expect(eraseSubject(null)).toBe(t('settings.erase.subjectAll'));
    expect(eraseSubject(0)).toBe(t('settings.erase.subjectAll'));
    expect(eraseSubject(1)).toBe(t('settings.erase.subjectOne'));
    expect(eraseSubject(7)).toBe(t('settings.erase.subjectMany', { count: 7 }));
  });

  it('adds up the per-category counts', () => {
    expect(totalCount({})).toBe(0);
    expect(totalCount({ passport: 2, other: 3, receipt: undefined })).toBe(5);
  });

  it('names the on-device model by its maker', () => {
    expect(modelName('gemini-nano')).toBe(t('settings.suggestions.geminiNano'));
    expect(modelName('apple-foundation-models')).toBe(t('settings.suggestions.appleModel'));
  });

  it('says which engine suggests details, and the model state when on text patterns', () => {
    const nanoName = { engine: t('settings.suggestions.geminiNano') };
    expect(suggestionsSubtitle('', null, false)).toBe(t('settings.suggestions.checking'));
    expect(suggestionsSubtitle('gemini-nano', null, false)).toBe(
      t('settings.suggestions.model', nanoName),
    );
    expect(suggestionsSubtitle('heuristic', null, false)).toBe(t('settings.suggestions.heuristic'));
    expect(suggestionsSubtitle('heuristic', nano('unavailable'), false)).toBe(
      t('settings.suggestions.heuristic'),
    );
    expect(suggestionsSubtitle('heuristic', nano('downloadable'), false)).toBe(
      t('settings.suggestions.modelMissing', nanoName),
    );
    expect(suggestionsSubtitle('heuristic', nano('downloadable'), true)).toBe(
      t('settings.suggestions.modelDownloading', nanoName),
    );
    expect(suggestionsSubtitle('heuristic', nano('downloading'), false)).toBe(
      t('settings.suggestions.modelDownloading', nanoName),
    );
  });

  it('says why the erase row is disabled', () => {
    expect(eraseSubtitleKey(null, null)).toBe('settings.erase.subtitle');
    expect(eraseSubtitleKey('clear', null)).toBe('settings.erase.erasing');
    expect(eraseSubtitleKey(null, 'erase')).toBe('settings.erase.erasing');
    expect(eraseSubtitleKey(null, 'export')).toBe('settings.erase.waitExport');
    expect(eraseSubtitleKey(null, 'restore')).toBe('settings.erase.waitRestore');
  });
});
