import { useUnistyles } from 'react-native-unistyles';

export type StatusBarStyle = 'light' | 'dark';

export function statusBarStyleFor(themeName: string | undefined): StatusBarStyle {
  return themeName === 'dark' ? 'light' : 'dark';
}

export function useStatusBarStyle(): StatusBarStyle {
  const { rt } = useUnistyles();
  return statusBarStyleFor(rt.themeName);
}
