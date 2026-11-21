import { t } from '@/i18n';

import { ERROR_MESSAGES, resolveErrorMessage } from '../errorMessages';

describe('resolveErrorMessage', () => {
  it('speaks a code from the table', () => {
    expect(resolveErrorMessage({ code: 'BACKUP_BUSY' }, { fallback: 'fallback' })).toBe(
      t('backup.error.busy'),
    );
    expect(ERROR_MESSAGES.BACKUP_BUSY).toBe(t('backup.error.busy'));
  });

  it('lets an override win over the table', () => {
    const error = { code: 'BACKUP_BUSY' };
    expect(
      resolveErrorMessage(error, {
        fallback: 'fallback',
        overrides: { BACKUP_BUSY: 'Busy here.' },
      }),
    ).toBe('Busy here.');
  });

  it('speaks only the listed codes from the table', () => {
    const error = Object.assign(new Error('its own words'), { code: 'BACKUP_BUSY' });
    expect(resolveErrorMessage(error, { fallback: 'fallback', codes: ['KEY_INVALIDATED'] })).toBe(
      'its own words',
    );
  });

  it('shows the error message when nothing speaks for its code', () => {
    expect(resolveErrorMessage(new Error('The OS said no'), { fallback: 'fallback' })).toBe(
      'The OS said no',
    );
    expect(resolveErrorMessage({ code: 'UNKNOWN' }, { fallback: 'fallback', overrides: {} })).toBe(
      'fallback',
    );
  });

  it('lets the caller vet or refuse the message', () => {
    const error = new Error('Pick a file');
    expect(
      resolveErrorMessage(error, { fallback: 'fallback', vetMessage: (m) => m.toUpperCase() }),
    ).toBe('PICK A FILE');
    expect(resolveErrorMessage(error, { fallback: 'fallback', vetMessage: () => undefined })).toBe(
      'fallback',
    );
  });

  it('falls back for anything that is not an error with text', () => {
    expect(resolveErrorMessage(new Error(''), { fallback: 'fallback' })).toBe('fallback');
    expect(resolveErrorMessage('nope', { fallback: 'fallback' })).toBe('fallback');
    expect(resolveErrorMessage({ code: 'toString' }, { fallback: 'fallback' })).toBe('fallback');
  });
});
