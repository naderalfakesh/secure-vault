import { useUnistyles } from 'react-native-unistyles';

export type StatusBarStyle = 'light' | 'dark';

/** Status bar text for a theme: light text on the dark theme, dark text otherwise. */
export function statusBarStyleFor(themeName: string | undefined): StatusBarStyle {
  return themeName === 'dark' ? 'light' : 'dark';
}

/**
 * The status bar style for the theme on screen. It follows the theme, not the
 * system scheme: with Appearance pinned to Dark on a phone in light mode, the
 * system's own choice left dark clock text on the dark background.
 */
export function useStatusBarStyle(): StatusBarStyle {
  const { rt } = useUnistyles();
  return statusBarStyleFor(rt.themeName);
}
