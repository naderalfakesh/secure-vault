import type { RestoreOutcome } from '../backupCopy';
import type { PickedBackup, Stage } from './types';

/** Resolves after the next frame, once what was rendered before it is on screen. */
export const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

/** A file that cannot be restored opens on its problem; any other at the inspect step. */
export function initialStage(backup: PickedBackup | null): Stage {
  return backup?.problem
    ? { name: 'outcome', outcome: { kind: 'close', message: backup.problem } }
    : { name: 'inspect', outcome: null };
}

/** An inspect outcome goes back to the passphrase; any other ends the restore. */
export function stageForOutcome(outcome: RestoreOutcome): Stage {
  return outcome.kind === 'inspect' ? { name: 'inspect', outcome } : { name: 'outcome', outcome };
}

/** The first progress the sheet shows: Checking, nothing done yet. */
export function startingProgress(entries: number): Extract<Stage, { name: 'running' }> {
  return {
    name: 'running',
    progress: { phase: 'verify', done: 0, total: entries + 1, wiped: false, cancelling: false },
  };
}

/** The error a cancel before the native call stands for. */
export function cancelledError(): Error {
  return Object.assign(new Error('cancelled'), { code: 'BACKUP_CANCELLED' });
}
