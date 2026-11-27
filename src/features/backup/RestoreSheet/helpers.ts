import { AppError } from '@/utils/AppError';

import type { RestoreOutcome } from '../backupCopy';
import type { PickedBackup, Stage } from './types';

export const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

export function initialStage(backup: PickedBackup | null): Stage {
  return backup?.problem
    ? { name: 'outcome', outcome: { kind: 'close', message: backup.problem } }
    : { name: 'inspect', outcome: null };
}

export function stageForOutcome(outcome: RestoreOutcome): Stage {
  return outcome.kind === 'inspect' ? { name: 'inspect', outcome } : { name: 'outcome', outcome };
}

export function startingProgress(entries: number): Extract<Stage, { name: 'running' }> {
  return {
    name: 'running',
    progress: { phase: 'verify', done: 0, total: entries + 1, wiped: false, cancelling: false },
  };
}

export function cancelledError(): AppError {
  return new AppError('BACKUP_CANCELLED', 'cancelled');
}
