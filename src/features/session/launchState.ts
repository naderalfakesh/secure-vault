import { clampLockout, EMPTY_LOCKOUT, type LockoutState } from '@/features/auth/lockout';
import vault from '@modules/expo-vault';

import { interpretLaunchReads } from './helpers';
import { sessionStorage } from './settings';
import type { KeyRead } from './types';

export async function loadCappedLockout(): Promise<LockoutState | null> {
  const stored = await sessionStorage.loadLockout();
  if (!stored) return null;
  const capped = clampLockout(stored, Date.now());
  if (capped !== stored) await sessionStorage.saveLockout(capped).catch(() => {});
  return capped;
}

export async function clearLockout(applyLockout: (next: LockoutState) => void): Promise<void> {
  applyLockout(EMPTY_LOCKOUT);
  await sessionStorage.saveLockout(EMPTY_LOCKOUT).catch(() => {});
}

// Runs before device key authentication; getAllKeys only lists filenames.
export async function readLaunchState(allowLostPin = false) {
  const [key, type, pin, storedLockout, entries] = await Promise.all([
    vault.hasVault().then(
      (exists): KeyRead => (exists ? 'present' : 'absent'),
      (): KeyRead => 'unreadable',
    ),
    vault.biometryType().catch(() => 'none' as const),
    sessionStorage.readPinRecord(),
    loadCappedLockout(),
    vault.getAllKeys().then(
      (keys) => keys,
      () => null,
    ),
  ]);
  return { key, type, storedLockout, ...interpretLaunchReads(key, pin, entries, allowLostPin) };
}
