import { AppError } from '../AppError';
import { errorCode } from '../errors';

describe('AppError', () => {
  it('is an Error that carries a code, a message and a name', () => {
    const error = new AppError('BACKUP_BUSY', 'Another backup operation is still running.');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      name: 'AppError',
      code: 'BACKUP_BUSY',
      message: 'Another backup operation is still running.',
    });
  });

  it('keeps the failure behind it as its cause', () => {
    const cause = new Error('io');
    expect(new AppError('INDEX_CLOSED', 'Closed.', { cause }).cause).toBe(cause);
    expect(new AppError('INDEX_CLOSED', 'Closed.').cause).toBeUndefined();
  });

  it('is read by errorCode like a native error', () => {
    expect(errorCode(new AppError('VAULT_EMPTIED', 'Emptied.'))).toBe('VAULT_EMPTIED');
    expect(errorCode(Object.assign(new Error('native'), { code: 'KEY_LOCKED' }))).toBe(
      'KEY_LOCKED',
    );
  });
});
