import { renderHook } from '@testing-library/react-native';
import { UnistylesRuntime } from 'react-native-unistyles';

import { statusBarStyleFor, useStatusBarStyle } from '../statusBarStyle';

// The Jest runtime is a plain object; the real one is read-only.
const runtime = UnistylesRuntime as { themeName?: string };

describe('status bar style', () => {
  const initial = runtime.themeName;

  afterEach(() => {
    runtime.themeName = initial;
  });

  it('puts light text on the dark theme and dark text on the light one', () => {
    expect(statusBarStyleFor('dark')).toBe('light');
    expect(statusBarStyleFor('light')).toBe('dark');
    expect(statusBarStyleFor(undefined)).toBe('dark');
  });

  it('follows the theme on screen, so a pinned Dark appearance gets light text', async () => {
    runtime.themeName = 'dark';

    const { result } = await renderHook(() => useStatusBarStyle());

    expect(result.current).toBe('light');
  });
});
