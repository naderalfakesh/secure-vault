import { describeBackupError, MIN_PASSPHRASE_LENGTH } from '@/services/BackupService';

import { backupCopy as copy } from '../backupCopy';
import { SPECIFIC_EXPORT_ERRORS } from './constants';
import type { Stage } from './types';

export function exportFailure(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : null;
  return typeof code === 'string' && SPECIFIC_EXPORT_ERRORS.has(code)
    ? describeBackupError(error)
    : copy['create.failed'];
}

/** The two enforced rules, and whether the repeat matches. */
export function passphraseChecks(passphrase: string, confirmation: string) {
  const characters = Array.from(passphrase);
  return {
    longEnough: characters.length >= MIN_PASSPHRASE_LENGTH,
    varied: characters.length > 0 && new Set(characters).size > 1,
    matches: confirmation.length > 0 && confirmation === passphrase,
  };
}

/** Whole percent of the export done; zero outside the busy step. */
export function exportPercent(stage: Stage): number {
  return stage.name === 'busy' && stage.total > 0
    ? Math.round((stage.done / stage.total) * 100)
    : 0;
}
