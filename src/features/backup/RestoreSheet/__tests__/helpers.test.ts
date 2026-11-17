import { restoreOutcome } from '../../backupCopy';
import { cancelledError, initialStage, stageForOutcome, startingProgress } from '../helpers';

const picked = { uri: 'file:///b.svbackup', name: 'b.svbackup', entries: 4, created: '' };

describe('restore sheet helpers', () => {
  it('opens on the inspect step, or on the problem of a file it cannot restore', () => {
    expect(initialStage(null)).toEqual({ name: 'inspect', outcome: null });
    expect(initialStage(picked)).toEqual({ name: 'inspect', outcome: null });
    expect(initialStage({ ...picked, problem: 'Too new' })).toEqual({
      name: 'outcome',
      outcome: { kind: 'close', message: 'Too new' },
    });
  });

  it('sends an inspect outcome back to the passphrase and ends on any other', () => {
    const cancelled = restoreOutcome(cancelledError());
    expect(cancelled.kind).toBe('inspect');
    expect(stageForOutcome(cancelled)).toEqual({ name: 'inspect', outcome: cancelled });
    const close = { kind: 'close' as const, message: 'No' };
    expect(stageForOutcome(close)).toEqual({ name: 'outcome', outcome: close });
  });

  it('starts at Checking with the check entry counted', () => {
    expect(startingProgress(4)).toEqual({
      name: 'running',
      progress: { phase: 'verify', done: 0, total: 5, wiped: false, cancelling: false },
    });
  });

  it('stands a cancel before the native call for BACKUP_CANCELLED', () => {
    expect(cancelledError()).toMatchObject({ message: 'cancelled', code: 'BACKUP_CANCELLED' });
  });
});
