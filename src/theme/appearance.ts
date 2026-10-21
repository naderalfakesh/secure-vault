import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';

/** The Appearance setting: follow the system, or pin light or dark. */
export type AppearancePreference = 'system' | 'light' | 'dark';

export const APPEARANCE_OPTIONS: readonly AppearancePreference[] = ['system', 'light', 'dark'];

// A display preference, nothing about the vault. It lives outside the session
// settings so the lock screen can use it before the vault is unlocked.
const ENTRY = 'securevault.appearance';
const storeOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

let current: AppearancePreference = 'system';
const listeners = new Set<() => void>();

export function sanitizeAppearance(value: unknown): AppearancePreference {
  return APPEARANCE_OPTIONS.find((option) => option === value) ?? 'system';
}

/** Applies a preference to Unistyles and to native UI (alerts, keyboards, status bar). */
export function applyAppearance(preference: AppearancePreference): void {
  current = preference;
  if (preference === 'system') {
    Appearance.setColorScheme('unspecified');
    UnistylesRuntime.setAdaptiveThemes(true);
  } else {
    Appearance.setColorScheme(preference);
    UnistylesRuntime.setAdaptiveThemes(false);
    UnistylesRuntime.setTheme(preference);
  }
  listeners.forEach((listener) => listener());
}

/** Applies and remembers a preference. A failed write keeps it for this run. */
export async function setAppearance(preference: AppearancePreference): Promise<void> {
  applyAppearance(preference);
  await SecureStore.setItemAsync(ENTRY, preference, storeOptions).catch(() => {});
}

/** Reads the stored preference at launch; anything unreadable means "system". */
export async function loadAppearance(): Promise<AppearancePreference> {
  let stored: string | null = null;
  try {
    stored = await SecureStore.getItemAsync(ENTRY, storeOptions);
  } catch {
    stored = null;
  }
  const preference = sanitizeAppearance(stored);
  applyAppearance(preference);
  return preference;
}

export function getAppearance(): AppearancePreference {
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The current Appearance setting, re-rendering when it changes. */
export function useAppearance(): AppearancePreference {
  return useSyncExternalStore(subscribe, getAppearance, getAppearance);
}
