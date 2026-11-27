import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';

import { SECURE_STORE_ENTRIES, SECURE_STORE_OPTIONS } from '@/utils/secureStore';

export type AppearancePreference = 'system' | 'light' | 'dark';

export const APPEARANCE_OPTIONS: readonly AppearancePreference[] = ['system', 'light', 'dark'];

// Stored outside vault session settings so the lock screen can read it before unlock.
const ENTRY = SECURE_STORE_ENTRIES.appearance;

let current: AppearancePreference = 'system';
const listeners = new Set<() => void>();

export function sanitizeAppearance(value: unknown): AppearancePreference {
  return APPEARANCE_OPTIONS.find((option) => option === value) ?? 'system';
}

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

export async function setAppearance(preference: AppearancePreference): Promise<void> {
  applyAppearance(preference);
  await SecureStore.setItemAsync(ENTRY, preference, SECURE_STORE_OPTIONS).catch(() => {});
}

export async function loadAppearance(): Promise<AppearancePreference> {
  let stored: string | null = null;
  try {
    stored = await SecureStore.getItemAsync(ENTRY, SECURE_STORE_OPTIONS);
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

export function useAppearance(): AppearancePreference {
  return useSyncExternalStore(subscribe, getAppearance, getAppearance);
}
