import type { ModelInfo } from '@/features/intelligence';
import { type StringKey, t } from '@/i18n';
import type { BackupOperation } from '@/services/BackupService';

import type { SettingsBusy } from './types';

/** "1.0.0 (12)": the version, with the build number when the binary has one. */
export function versionLabel(version: string, build: string | undefined): string {
  return build ? `${version} (${build})` : version;
}

export function eraseSubject(count: number | null): string {
  if (count === null || count === 0) return t('settings.erase.subjectAll');
  if (count === 1) return t('settings.erase.subjectOne');
  return t('settings.erase.subjectMany', { count });
}

/** Every document in the vault, from the per-category counts. */
export function totalCount(counts: Partial<Record<string, number>>): number {
  return Object.values(counts).reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

/** The on-device model by the name its maker uses. */
export function modelName(engine: string): string {
  return engine === 'gemini-nano'
    ? t('settings.suggestions.geminiNano')
    : t('settings.suggestions.appleModel');
}

/** What the Suggestions row says about the engine in use and the on-device model. */
export function suggestionsSubtitle(
  engine: string,
  model: ModelInfo | null,
  downloading: boolean,
): string {
  if (engine === 'heuristic') {
    if (model && (downloading || model.status === 'downloading')) {
      return t('settings.suggestions.modelDownloading', { engine: modelName(model.engine) });
    }
    if (model?.status === 'downloadable') {
      return t('settings.suggestions.modelMissing', { engine: modelName(model.engine) });
    }
    return t('settings.suggestions.heuristic');
  }
  return engine
    ? t('settings.suggestions.model', { engine: modelName(engine) })
    : t('settings.suggestions.checking');
}

/**
 * A disabled row says why (ListRow): the erase waits for the backup work
 * holding the slot, or is itself running.
 */
export function eraseSubtitleKey(busy: SettingsBusy, running: BackupOperation | null): StringKey {
  if (busy === 'clear' || running === 'erase') return 'settings.erase.erasing';
  if (running === 'export') return 'settings.erase.waitExport';
  if (running === 'restore') return 'settings.erase.waitRestore';
  return 'settings.erase.subtitle';
}
