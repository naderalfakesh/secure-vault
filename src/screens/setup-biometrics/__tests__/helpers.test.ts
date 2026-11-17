import { stepBiometry } from '../helpers';

describe('stepBiometry', () => {
  it('names what the phone reports', () => {
    expect(stepBiometry({ state: 'available', kind: 'touchId' }, 'faceId')).toBe('touchId');
  });

  it('falls back to the session while the check is pending or finds nothing', () => {
    expect(stepBiometry(null, 'faceId')).toBe('faceId');
    expect(stepBiometry({ state: 'unavailable', kind: 'none' }, 'biometrics')).toBe('biometrics');
  });
});
