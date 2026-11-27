import { useCallback, useEffect, useRef, useState } from 'react';

import { DEFAULT_SETTINGS, type SecuritySettings, sessionStorage } from '../settings';

export function useSecuritySettings() {
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SETTINGS);
  const autoLockRef = useRef(settings.autoLockSeconds);
  useEffect(() => {
    autoLockRef.current = settings.autoLockSeconds;
  }, [settings.autoLockSeconds]);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const loadProtectedState = useCallback(async () => {
    setSettings(await sessionStorage.loadSettings());
  }, []);

  const updateSettings = useCallback(async (changes: Partial<SecuritySettings>) => {
    const next = { ...settingsRef.current, ...changes };
    settingsRef.current = next;
    setSettings(next);
    await sessionStorage.saveSettings(next).catch(() => {});
  }, []);

  return { settings, setSettings, autoLockRef, loadProtectedState, updateSettings };
}
