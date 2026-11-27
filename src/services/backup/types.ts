import type { BackupProgress } from '@modules/expo-vault';

export interface BackupResult {
  uri: string;
  name: string;
  entries: number;
  bytes: number;
}

export type ProgressListener = (progress: BackupProgress) => void;

// wiped latches true on first 'import' event (past cancel point); cancelling clears if native rejects a late cancel.
export type RestoreProgress = BackupProgress & { wiped: boolean; cancelling: boolean };
export type RestoreProgressListener = (progress: RestoreProgress) => void;

export interface RestoreRun {
  id: string;
  wiped: boolean;
  cancelRequested: boolean;
  lastRestored: { entry: number; total: number } | null;
}

export type BackupOperation = 'export' | 'restore' | 'erase';
