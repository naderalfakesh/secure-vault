import * as SecureStore from 'expo-secure-store';
import { Appearance } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';

import { getAppearance, loadAppearance, sanitizeAppearance, setAppearance } from './appearance';

describe('appearance', () => {
  beforeEach(() => {
    (SecureStore as unknown as { __reset: () => void }).__reset();
    jest.restoreAllMocks();
  });

  it('accepts only the three options', () => {
    expect(sanitizeAppearance('dark')).toBe('dark');
    expect(sanitizeAppearance('sepia')).toBe('system');
    expect(sanitizeAppearance(null)).toBe('system');
  });

  it('pins a theme over the system one and remembers it', async () => {
    const adaptive = jest.spyOn(UnistylesRuntime, 'setAdaptiveThemes');
    const setTheme = jest.spyOn(UnistylesRuntime, 'setTheme');
    const scheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});

    await setAppearance('dark');

    expect(adaptive).toHaveBeenLastCalledWith(false);
    expect(setTheme).toHaveBeenLastCalledWith('dark');
    expect(scheme).toHaveBeenLastCalledWith('dark');
    expect(getAppearance()).toBe('dark');
    expect(await loadAppearance()).toBe('dark');
  });

  it('follows the system again when set back', async () => {
    const adaptive = jest.spyOn(UnistylesRuntime, 'setAdaptiveThemes');
    const scheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});

    await setAppearance('system');

    expect(adaptive).toHaveBeenLastCalledWith(true);
    expect(scheme).toHaveBeenLastCalledWith('unspecified');
    expect(await loadAppearance()).toBe('system');
  });

  it('falls back to the system theme when the store cannot be read', async () => {
    jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
    jest.spyOn(SecureStore, 'getItemAsync').mockRejectedValueOnce(new Error('locked'));

    expect(await loadAppearance()).toBe('system');
  });
});
