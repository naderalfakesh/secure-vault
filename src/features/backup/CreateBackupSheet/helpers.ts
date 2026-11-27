import { isLongEnough, isVaried, matchesConfirmation } from '@/services/backup/passphrase';
import { describeBackupError } from '@/services/BackupService';
import { errorCode } from '@/utils/errors';

import { backupCopy as copy } from '../backupCopy';
import { SPECIFIC_EXPORT_ERRORS } from './constants';
import type { Stage } from './types';

export function exportFailure(error: unknown): string {
  const code = errorCode(error);
  return code && SPECIFIC_EXPORT_ERRORS.has(code)
    ? describeBackupError(error)
    : copy['create.failed'];
}

export function passphraseChecks(passphrase: string, confirmation: string) {
  return {
    longEnough: isLongEnough(passphrase),
    varied: isVaried(passphrase),
    matches: matchesConfirmation(passphrase, confirmation),
  };
}

export function exportPercent(stage: Stage): number {
  return stage.name === 'busy' && stage.total > 0
    ? Math.round((stage.done / stage.total) * 100)
    : 0;
}
