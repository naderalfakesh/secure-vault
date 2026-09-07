import { autoLockDescription, autoLockLabel, DEFAULT_SETTINGS, sanitizeSettings } from './settings';

describe('security settings', () => {
  it('falls back to defaults for unknown values', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ autoLockSeconds: 42, privacyScreen: 'yes' })).toEqual(
      DEFAULT_SETTINGS,
    );
    expect(
      sanitizeSettings({ autoLockSeconds: 900, privacyScreen: false, biometricsForShare: true }),
    ).toEqual({
      autoLockSeconds: 900,
      privacyScreen: false,
      biometricsForShare: true,
    });
  });

  it('labels the auto-lock options in plain words', () => {
    expect(autoLockLabel(0)).toBe('Immediately');
    expect(autoLockLabel(60)).toBe('1 minute');
    expect(autoLockDescription(0)).toBe('As soon as you leave the app');
    expect(autoLockDescription(300)).toBe('After 5 minutes in the background');
    expect(autoLockDescription(-1)).toBe('Stays open until you lock it');
    expect(autoLockLabel(900)).toBe('15 minutes');
    expect(autoLockLabel(-1)).toBe('Never');
  });
});
