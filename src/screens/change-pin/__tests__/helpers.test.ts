import { formatCountdown, LOCKOUT_BODY } from '@/features/auth/lockCopy';
import { t } from '@/i18n';

import { pinPrompt } from '../helpers';

describe('pinPrompt', () => {
  it('asks for the current PIN with nothing under it', () => {
    expect(pinPrompt('current', 0, null, null)).toEqual({
      lockedOut: false,
      alert: false,
      title: t('changePin.title.current'),
      subtitle: null,
    });
  });

  it('says the PIN is untouched on the later steps', () => {
    const prompt = pinPrompt('confirm', 0, null, null);
    expect(prompt.title).toBe(t('changePin.title.confirm'));
    expect(prompt.subtitle).toBe(t('changePin.untouched'));
    expect(prompt.alert).toBe(false);
  });

  it('shows this screen’s message before the session error, as an alert', () => {
    expect(pinPrompt('next', 0, 'same', 'session')).toMatchObject({
      alert: true,
      subtitle: 'same',
    });
    expect(pinPrompt('current', 0, null, 'session')).toMatchObject({
      alert: true,
      subtitle: 'session',
    });
  });

  it('shows the lockout on the first step only, without an alert', () => {
    expect(pinPrompt('current', 90, 'wrong', null)).toEqual({
      lockedOut: true,
      alert: false,
      title: t('lock.lockoutTitle', { time: formatCountdown(90) }),
      subtitle: LOCKOUT_BODY,
    });
    expect(pinPrompt('next', 90, null, null).lockedOut).toBe(false);
  });
});
