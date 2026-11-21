import { clampLockout, EMPTY_LOCKOUT, type LockoutState } from '@/features/auth/lockout';
import vault from '@modules/expo-vault';

import { interpretLaunchReads } from './helpers';
import { sessionStorage } from './settings';
import type { KeyRead } from './types';

/**
 * The stored lockout with any pause longer than its count earned capped and the
 * cap written back, so it ends instead of sliding with the clock; null when the
 * store could not be read.
 */
export async function loadCappedLockout(): Promise<LockoutState | null> {
  const stored = await sessionStorage.loadLockout();
  if (!stored) return null;
  const capped = clampLockout(stored, Date.now());
  if (capped !== stored) await sessionStorage.saveLockout(capped).catch(() => {});
  return capped;
}

/** Forgets the failures and the pause in memory and in the store; a store that refuses the write leaves the in-memory reset. */
export async function clearLockout(applyLockout: (next: LockoutState) => void): Promise<void> {
  applyLockout(EMPTY_LOCKOUT);
  await sessionStorage.saveLockout(EMPTY_LOCKOUT).catch(() => {});
}

/**
 * Everything launch reads before it picks a status; none of it needs the
 * device key. A PIN record its marker says was written but that the store no
 * longer returns is `unreadable` (`pinLost`) while a device key exists: a
 * vault, and a PIN guarding it, that the app cannot see. Without a key there
 * is no vault for it to guard (a device backup restored the marker without
 * the key), so it is absent. `allowLostPin` treats it as absent too, after
 * the owner passed the device key's own gate to set a new PIN.
 */
export async function readLaunchState(allowLostPin = false) {
  const [key, type, pin, storedLockout, entries] = await Promise.all([
    vault.hasVault().then(
      (exists): KeyRead => (exists ? 'present' : 'absent'),
      (): KeyRead => 'unreadable',
    ),
    vault.biometryType().catch(() => 'none' as const),
    sessionStorage.readPinRecord(),
    // Readable before the device key is authenticated, so a relaunch keeps
    // the attempt counter and any pause that is still running.
    loadCappedLockout(),
    // The listing reads the folder only and needs no device key; when it
    // fails, setup keeps saying the documents stay.
    vault.getAllKeys().then(
      (keys) => keys,
      () => null,
    ),
  ]);
  return { key, type, storedLockout, ...interpretLaunchReads(key, pin, entries, allowLostPin) };
}
