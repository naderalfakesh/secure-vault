import type { BackupProgress } from '@modules/expo-vault';

export interface BackupResult {
  uri: string;
  name: string;
  entries: number;
  bytes: number;
}

export type ProgressListener = (progress: BackupProgress) => void;

/**
 * A restore's progress with its phase signal. `wiped` turns true on the first
 * Restoring (`import`) event and stays true for the rest of the restore, a
 * retry after a new key prompt included: from then on the previous vault may
 * be gone, so nothing may say it is unchanged and it can no longer be
 * cancelled. `cancelling` is true while an accepted cancel still stands; it
 * turns false when the module refuses the repeated request (it had passed
 * its last cancel point), and the restore then goes on to its own outcome.
 */
export type RestoreProgress = BackupProgress & { wiped: boolean; cancelling: boolean };
export type RestoreProgressListener = (progress: RestoreProgress) => void;

/** The restore that holds the slot: its phase signal and whether a cancel was asked for. */
export interface RestoreRun {
  /** Names this restore to the module, so a cancel can only ever reach it. */
  id: string;
  wiped: boolean;
  cancelRequested: boolean;
  /**
   * For "Stopped at entry X of N": the entry after the last one the Restoring
   * pass finished, numbered like its progress (the check entry is entry 1).
   */
  lastRestored: { entry: number; total: number } | null;
}

/** Work that must never overlap another: each one rewrites the vault or the backup folders. */
export type BackupOperation = 'export' | 'restore' | 'erase';
