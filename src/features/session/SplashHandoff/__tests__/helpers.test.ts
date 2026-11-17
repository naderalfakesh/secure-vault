import { Appearance } from 'react-native';

import { pinnedDiffers, systemScheme } from '../helpers';

describe('systemScheme', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reads dark only when the system says dark', () => {
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('dark');
    expect(systemScheme()).toBe('dark');
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue(null);
    expect(systemScheme()).toBe('light');
  });
});

describe('pinnedDiffers', () => {
  it('is false while the app follows the system', () => {
    expect(pinnedDiffers('light', 'system')).toBe(false);
    expect(pinnedDiffers('dark', 'system')).toBe(false);
  });

  it('is true only when the pinned scheme is the other one', () => {
    expect(pinnedDiffers('light', 'dark')).toBe(true);
    expect(pinnedDiffers('dark', 'light')).toBe(true);
    expect(pinnedDiffers('dark', 'dark')).toBe(false);
  });
});
