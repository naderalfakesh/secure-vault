import { useCallback, useEffect, useRef, useState } from 'react';

import { DEFAULT_SETTINGS, type SecuritySettings, sessionStorage } from '../settings';

/** The security settings, with the auto-lock limit current for the app-state listener. */
export function useSecuritySettings() {
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SETTINGS);
  const autoLockRef = useRef(settings.autoLockSeconds);
  useEffect(() => {
    autoLockRef.current = settings.autoLockSeconds;
  }, [settings.autoLockSeconds]);

  /** Reads the settings again once the vault is open. */
  const loadProtectedState = useCallback(async () => {
    setSettings(await sessionStorage.loadSettings());
  }, []);

  const updateSettings = useCallback(
    async (changes: Partial<SecuritySettings>) => {
      const next = { ...settings, ...changes };
      setSettings(next);
      await sessionStorage.saveSettings(next).catch(() => {});
    },
    [settings],
  );

  return { settings, setSettings, autoLockRef, loadProtectedState, updateSettings };
}
